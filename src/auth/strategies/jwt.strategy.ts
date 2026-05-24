import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import { UsersService } from "../../users/users.service";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>("JWT_SECRET"),
    });
  }

  async validate(payload: {
    sub: number | string;
    username: string;
    role: string;
    email?: string;
    camp_id?: number | string | null;
  }) {
    const userId = Number(payload.sub);
    const user = await this.usersService.findUserById(userId);

    if (!user) {
      throw new UnauthorizedException(
        "Usuario no encontrado o sesi�n inv�lida",
      );
    }

    const campId = payload.camp_id == null ? null : Number(payload.camp_id);

    return {
      id: userId,
      userId,
      username: payload.username,
      email: payload.email,
      role: payload.role,
      camp_id: campId,
    };
  }
}
