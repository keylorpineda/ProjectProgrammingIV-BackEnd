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

        // Solo escribir last_activity en BD una vez cada 5 minutos por usuario.
        // El TTL de Redis ya cubre la detección de inactividad en tiempo real;
        // el UPDATE de Postgres solo sirve para persistencia histórica.
        const dbUpdateKey = `session:db_update:${userId}`;
        const recentlyUpdated = await this.redis
          .get(dbUpdateKey)
          .catch(() => null);

        if (!recentlyUpdated) {
          await this.sessionRepo.update(
            { user_id: userId, is_active: true },
            { last_activity: new Date() },
          );
          await this.redis.set(dbUpdateKey, "1", "EX", 300).catch(() => {});
        }
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
