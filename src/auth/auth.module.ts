import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { Session } from "./entities/session.entity";
import { LoginAttempt } from "./entities/login-attempt.entity";
import { UserAccount } from "../users/entities/user-account.entity";
import { Camp } from "../camps/entities/camp.entity";
import { UsersModule } from "../users/users.module";
import { JwtStrategy } from "./strategies/jwt.strategy";
import { SessionActivityInterceptor } from "./interceptors/session-activity.interceptor";
import { SessionInactivityGuard } from "./guards/session-inactivity.guard";

@Module({
  imports: [
    TypeOrmModule.forFeature([Session, LoginAttempt, UserAccount, Camp]),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>("JWT_SECRET"),
        signOptions: { expiresIn: config.get<string>("JWT_EXPIRES_IN", "20m") },
      }),
      inject: [ConfigService],
    }),
    UsersModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    SessionActivityInterceptor,
    SessionInactivityGuard,
  ],
  exports: [
    AuthService,
    JwtModule,
    SessionActivityInterceptor,
    SessionInactivityGuard,
    TypeOrmModule, // ? Exportar para que Session repository est� disponible globalmente
  ],
})
export class AuthModule {}
