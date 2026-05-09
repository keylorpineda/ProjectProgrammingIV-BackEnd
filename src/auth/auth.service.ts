import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { Inject } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { MoreThan, Repository } from "typeorm";
import * as bcrypt from "bcrypt";
import { LoginAttempt } from "./entities/login-attempt.entity";
import { Session } from "./entities/session.entity";
import { UserAccount } from "../users/entities/user-account.entity";
import { Camp } from "../camps/entities/camp.entity";
import { LoginDto } from "./dto/login.dto";
import { REDIS_CLIENT } from "../redis/redis.constants";
import { Redis } from "ioredis";

const SALT_ROUNDS = 12;
const MAX_LOGIN_ATTEMPTS = 1000;
const LOGIN_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(LoginAttempt)
    private readonly loginAttemptRepo: Repository<LoginAttempt>,
    @InjectRepository(Session)
    private readonly sessionRepo: Repository<Session>,
    @InjectRepository(UserAccount)
    private readonly userRepo: Repository<UserAccount>,
    @InjectRepository(Camp)
    private readonly campRepo: Repository<Camp>,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async login(
    dto: LoginDto,
    ipAddress: string,
    userAgent?: string,
  ): Promise<{
    access_token: string;
    refresh_token: string;
    user: {
      id: number;
      username: string;
      email: string;
      role: string;
      camp_id: number;
    };
  }> {
    const recentFailures = await this.countRecentFailures(ipAddress);
    if (recentFailures >= MAX_LOGIN_ATTEMPTS) {
      await this.logLoginAttempt({
        username: dto.username,
        ip_address: ipAddress,
        user_agent: userAgent,
        success: false,
        failure_reason: "Too many login attempts",
      });
      throw new UnauthorizedException(
        `Demasiados intentos fallidos. Intente de nuevo en ${LOGIN_ATTEMPT_WINDOW_MS / 60000} minutos`,
      );
    }

    const user = await this.userRepo.findOne({
      where: { username: dto.username },
      relations: ["role", "camp", "person"],
    });

    if (!user) {
      await this.logLoginAttempt({
        username: dto.username,
        ip_address: ipAddress,
        user_agent: userAgent,
        success: false,
        failure_reason: "User not found",
      });
      throw new UnauthorizedException("Credenciales inv�lidas");
    }

    const isPasswordValid = await this.verifyPassword(
      dto.password,
      user.password_hash,
    );

    if (!isPasswordValid) {
      await this.logLoginAttempt({
        username: dto.username,
        ip_address: ipAddress,
        user_agent: userAgent,
        success: false,
        failure_reason: "Invalid password",
        user_id: Number(user.id),
      });
      throw new UnauthorizedException("Credenciales inv�lidas");
    }

    const payload = {
      sub: user.id,
      username: user.username,
      email: user.email,
      role: user.role?.name,
      campId: user.camp_id,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get<string>("JWT_REFRESH_EXPIRES_IN", "7d"),
    });

    const tokenHash = await this.hashPassword(refreshToken);

    await this.sessionRepo.save(
      this.sessionRepo.create({
        user_id: Number(user.id),
        token_hash: tokenHash,
        last_activity: new Date(),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        is_active: true,
        auto_logout: false,
      }),
    );

    // Guardar sesin en Redis para timeout de inactividad de 20 mins (1200 seg)
    await this.redis.setex(`session:${user.id}`, 1200, "active");

    user.last_access = new Date();
    await this.userRepo.save(user);

    await this.logLoginAttempt({
      username: dto.username,
      ip_address: ipAddress,
      user_agent: userAgent,
      success: true,
      user_id: Number(user.id),
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: Number(user.id),
        username: user.username,
        email: user.email,
        role: user.role?.name ?? "unknown",
        camp_id: Number(user.camp_id),
      },
    };
  }

  async logout(userId: number, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      const sessions = await this.sessionRepo.find({
        where: { user_id: userId, is_active: true },
      });

      for (const session of sessions) {
        const isMatch = await this.verifyPassword(
          refreshToken,
          session.token_hash,
        );
        if (isMatch) {
          session.is_active = false;
          session.auto_logout = false;
          await this.sessionRepo.save(session);
          return;
        }
      }
    }

    await this.sessionRepo.update(
      { user_id: userId, is_active: true },
      { is_active: false, auto_logout: false },
    );

    // Eliminar sesin de Redis
    await this.redis.del(`session:${userId}`);
  }

  async refresh(refreshToken: string): Promise<{
    access_token: string;
    refresh_token: string;
  }> {
    let payload: any;

    try {
      payload = this.jwtService.verify(refreshToken);
    } catch (error) {
      throw new UnauthorizedException("Refresh token inv�lido o expirado");
    }

    const sessions = await this.sessionRepo.find({
      where: { user_id: payload.sub, is_active: true },
    });

    let validSession: Session | null = null;

    for (const session of sessions) {
      const isMatch = await this.verifyPassword(
        refreshToken,
        session.token_hash,
      );
      if (isMatch) {
        validSession = session;
        break;
      }
    }

    if (!validSession) {
      throw new UnauthorizedException("Sesi�n inv�lida o expirada");
    }

    if (new Date() > validSession.expires_at) {
      validSession.is_active = false;
      await this.sessionRepo.save(validSession);
      throw new UnauthorizedException("Sesi�n expirada");
    }

    const user = await this.userRepo.findOne({
      where: { id: payload.sub },
      relations: ["role"],
    });

    if (!user) {
      throw new UnauthorizedException("Usuario no encontrado");
    }

    const newPayload = {
      sub: user.id,
      username: user.username,
      email: user.email,
      role: user.role?.name,
      campId: user.camp_id,
    };

    const newAccessToken = this.jwtService.sign(newPayload);
    const newRefreshToken = this.jwtService.sign(newPayload, {
      expiresIn: this.configService.get<string>("JWT_REFRESH_EXPIRES_IN", "7d"),
    });

    const newTokenHash = await this.hashPassword(newRefreshToken);

    validSession.token_hash = newTokenHash;
    validSession.last_activity = new Date();
    validSession.expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await this.sessionRepo.save(validSession);

    // Actualizar sesin en Redis
    await this.redis.setex(`session:${user.id}`, 1200, "active");

    return {
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
    };
  }

  async switchCamp(
    userId: number,
    campId: number,
  ): Promise<{
    access_token: string;
    refresh_token: string;
    user: {
      id: number;
      username: string;
      email: string;
      role: string;
      camp_id: number;
    };
  }> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ["role", "camp", "person"],
    });

    if (!user) {
      throw new UnauthorizedException("Usuario no encontrado");
    }

    const camp = await this.campRepo.findOne({
      where: { id: campId, active: true },
    });

    if (!camp) {
      throw new NotFoundException(`Campamento con ID ${campId} no encontrado`);
    }

    user.camp_id = campId;
    user.last_access = new Date();
    await this.userRepo.save(user);

    const payload = {
      sub: user.id,
      username: user.username,
      email: user.email,
      role: user.role?.name,
      campId,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get<string>("JWT_REFRESH_EXPIRES_IN", "7d"),
    });

    const tokenHash = await this.hashPassword(refreshToken);

    await this.sessionRepo.update(
      { user_id: userId, is_active: true },
      { is_active: false, auto_logout: false },
    );

    await this.sessionRepo.save(
      this.sessionRepo.create({
        user_id: userId,
        token_hash: tokenHash,
        last_activity: new Date(),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        is_active: true,
        auto_logout: false,
      }),
    );

    // Actualizar sesin en Redis
    await this.redis.setex(`session:${userId}`, 1200, "active");

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: Number(user.id),
        username: user.username,
        email: user.email,
        role: user.role?.name ?? "unknown",
        camp_id: Number(campId),
      },
    };
  }

  async validateUser(userId: number): Promise<UserAccount | null> {
    return this.userRepo.findOne({
      where: { id: userId },
      relations: ["role", "camp", "person"],
    });
  }

  async logLoginAttempt(data: {
    username: string;
    ip_address: string;
    user_agent?: string;
    success: boolean;
    failure_reason?: string;
    user_id?: number;
  }): Promise<void> {
    const attempt = this.loginAttemptRepo.create(data);
    await this.loginAttemptRepo.save(attempt);
  }

  async countRecentFailures(
    ip_address: string,
    windowMs = LOGIN_ATTEMPT_WINDOW_MS,
  ): Promise<number> {
    return this.loginAttemptRepo.count({
      where: {
        ip_address,
        success: false,
        attempted_at: MoreThan(new Date(Date.now() - windowMs)),
      },
    });
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  async verifyPassword(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }

  /**
   * Verifica el estado de la sesi�n del usuario
   * Retorna informaci�n sobre actividad y tiempo restante antes del auto-logout
   */
  async checkSessionStatus(userId: number): Promise<{
    isActive: boolean;
    lastActivity: Date;
    minutesUntilExpiration: number;
    willExpireSoon: boolean;
  }> {
    const sessionExists = await this.redis.exists(`session:${userId}`);
    if (!sessionExists) {
      return {
        isActive: false,
        lastActivity: new Date(),
        minutesUntilExpiration: 0,
        willExpireSoon: false,
      };
    }

    const ttl = await this.redis.ttl(`session:${userId}`);
    const minutesRemaining = Math.max(0, Math.floor(ttl / 60));

    return {
      isActive: true,
      lastActivity: new Date(),
      minutesUntilExpiration: minutesRemaining,
      willExpireSoon: minutesRemaining <= 2,
    };
  }
}
