import type {
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Injectable } from "@nestjs/common";
import { Inject } from "@nestjs/common";
import type { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Session } from "../entities/session.entity";
import { JwtService } from "@nestjs/jwt";
import { REDIS_CLIENT } from "../../redis/redis.constants";
import { Redis } from "ioredis";

/**
 * Interceptor que actualiza last_activity en cada request autenticado
 * Esto permite trackear la actividad del usuario para logout autom�tico por inactividad
 */
@Injectable()
export class SessionActivityInterceptor implements NestInterceptor {
  constructor(
    @InjectRepository(Session)
    private readonly sessionRepo: Repository<Session>,
    private readonly jwtService: JwtService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    // Solo actualizar si hay token de autenticaci�n
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);

      try {
        const payload = this.jwtService.verify(token);
        const userId = payload.sub;

        // Actualizar TTL de inactividad en Redis en cada request (1200s = 20m)
        await this.redis.expire(`session:${userId}`, 1200).catch(() => {
          // Redis unavailable — session tracking degraded, continue normally
        });

        // Opcional: Actualizar last_activity en BD solo una vez cada cierto tiempo
        // para no sobrecargar PostgreSQL con UPDATEs en cada request.
        // Aqu lo mantenemos por consistencia si as se desea.
        await this.sessionRepo.update(
          { user_id: userId, is_active: true },
          { last_activity: new Date() },
        );
      } catch (error) {
        // Token inv�lido o expirado - no hacer nada, el guard JWT manejar� esto
      }
    }

    return next.handle().pipe(
      tap(() => {
        // Aqu� podr�amos agregar logs si fuera necesario
      }),
    );
  }
}
