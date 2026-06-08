import type {
  NestModule,
  MiddlewareConsumer,
  OnApplicationBootstrap,
} from "@nestjs/common";
import { Module, Logger } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { CsrfMiddleware } from "./common/middleware/csrf.middleware";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { ScheduleModule } from "@nestjs/schedule";
import { JwtAuthGuard } from "./auth/guards/jwt-auth.guard";
import { RolesGuard } from "./auth/guards/roles.guard";
import { SessionInactivityGuard } from "./auth/guards/session-inactivity.guard";
import { SessionActivityInterceptor } from "./auth/interceptors/session-activity.interceptor";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { CampsModule } from "./camps/camps.module";
import { ResourcesModule } from "./resources/resources.module";
import { ExplorationsModule } from "./explorations/explorations.module";
import { TransfersModule } from "./transfers/transfers.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { AiModule } from "./ai/ai.module";
import { UploadModule } from "./upload/upload.module";
import { HealthModule } from "./health/health.module";
import { DatabaseModule } from "./database/database.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { RedisModule } from "./redis/redis.module";
import { BullModule } from "@nestjs/bullmq";
import { MailModule } from "./mail/mail.module";
import Redis from "ioredis";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ".env" }),

    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get<number>("THROTTLE_TTL", 60000),
          limit: config.get<number>("THROTTLE_LIMIT", 10),
        },
      ],
      inject: [ConfigService],
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: "postgres",
        host: config.get("DB_HOST"),
        port: config.get<number>("DB_PORT"),
        username: config.get("DB_USER"),
        password: config.get("DB_PASS"),
        database: config.get("DB_NAME"),
        autoLoadEntities: true,
        synchronize: config.get("NODE_ENV") === "development",
        ssl:
          config.get("NODE_ENV") === "production"
            ? { rejectUnauthorized: false }
            : false,
        logging: config.get("NODE_ENV") === "development",
        extra: {
          max: config.get<number>("DB_POOL_MAX", 20),
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 5000,
        },
      }),
      inject: [ConfigService],
    }),

    ScheduleModule.forRoot(),

    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => {
        const redisUrl = config.get("REDIS_URL");
        const client = redisUrl
          ? new Redis(redisUrl, { maxRetriesPerRequest: null })
          : new Redis({
              host: config.get("REDIS_HOST", "localhost"),
              port: config.get("REDIS_PORT", 6379),
              password: config.get("REDIS_PASSWORD"),
              maxRetriesPerRequest: null,
            });

        client.on("error", (err) => {
          console.error("BullMQ Redis error:", err.message);
        });

        return {
          connection: client,
        };
      },
      inject: [ConfigService],
    }),

    RedisModule,

    HealthModule,
    AuthModule,
    UsersModule,
    CampsModule,
    ResourcesModule,
    ExplorationsModule,
    TransfersModule,
    DashboardModule,
    AiModule,
    UploadModule,
    DatabaseModule,
    NotificationsModule,
    MailModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: SessionInactivityGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_INTERCEPTOR, useClass: SessionActivityInterceptor },
  ],
})
export class AppModule implements NestModule, OnApplicationBootstrap {
  private readonly logger = new Logger(AppModule.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CsrfMiddleware).forRoutes("*");
  }

  async onApplicationBootstrap() {
    // onApplicationBootstrap
  }
}
