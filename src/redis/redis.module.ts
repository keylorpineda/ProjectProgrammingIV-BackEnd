import { Global, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import { REDIS_CLIENT } from "./redis.constants";

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.get<string>("REDIS_URL");
        const client = redisUrl
          ? new Redis(redisUrl, { maxRetriesPerRequest: null })
          : new Redis({
              host: configService.get<string>("REDIS_HOST", "localhost"),
              port: configService.get<number>("REDIS_PORT", 6379),
              password: configService.get<string>("REDIS_PASSWORD"),
              maxRetriesPerRequest: null,
            });

        client.on("error", (err) => {
          console.error("Redis client error:", err.message);
        });

        return client;
      },
      inject: [ConfigService],
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
