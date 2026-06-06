import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { Inject } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Session } from "../entities/session.entity";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { REDIS_CLIENT } from "../../redis/redis.constants";
import { Redis } from "ioredis";

/**
 * Guard que valida si la sesi�n ha estado inactiva por m�s de 20 minutos
 * Si detecta inactividad, marca auto_logout y rechaza el request
 */
@Injectable()
export class SessionInactivityGuard implements CanActivate {
  constructor(
    @InjectRepository(Session)
    private readonly sessionRepo: Repository<Session>,
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Verificar si la ruta es p�blica
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      // Sin token - dejamos que JwtAuthGuard maneje esto
      return true;
    }

    const token = authHeader.substring(7);

    try {
      const payload = this.jwtService.verify(token);
      const userId = payload.sub;

      // Verificar en Redis si la sesión aún está activa (no ha expirado el TTL)
      let sessionExists: number;
      try {
        sessionExists = await this.redis.exists(`session:${userId}`);
      } catch {
        // Redis unavailable — allow the request through; JWT validity is enough
        return true;
      }

      if (!sessionExists) {
        await this.sessionRepo.update(
          { user_id: userId, is_active: true },
          { is_active: false, auto_logout: true },
        );

        throw new UnauthorizedException(
          "Su sesión ha expirado por inactividad o no existe. Por favor, inicie sesión nuevamente",
        );
      }

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      // Token inv�lido - dejamos que JwtAuthGuard maneje esto
      return true;
    }
  }
}
