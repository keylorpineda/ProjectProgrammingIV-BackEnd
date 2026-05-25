import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DashboardController } from "./dashboard.controller";
import { DashboardService } from "./dashboard.service";
import { DatabaseModule } from "../database/database.module";
import {
  CampPopulationSummaryView,
  PersonStatusStatsView,
  InventoryStatusView,
  InventoryAlertView,
  TransferCampSummaryView,
  ExplorationSummaryView,
  PersonProfessionStatsView,
} from "../database/views";
import { CacheModule } from "@nestjs/cache-manager";
import { ConfigModule, ConfigService } from "@nestjs/config";

@Module({
  imports: [
    DatabaseModule,
    TypeOrmModule.forFeature([
      CampPopulationSummaryView,
      PersonStatusStatsView,
      InventoryStatusView,
      InventoryAlertView,
      TransferCampSummaryView,
      ExplorationSummaryView,
      PersonProfessionStatsView,
    ]),
    CacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        try {
          const { redisStore } = await import("cache-manager-redis-yet");
          const redisUrl = configService.get<string>("REDIS_URL");
          const storeOptions = redisUrl
            ? { url: redisUrl, ttl: 300000 }
            : {
                socket: {
                  host: configService.get<string>("REDIS_HOST", "localhost"),
                  port: configService.get<number>("REDIS_PORT", 6379),
                },
                password: configService.get<string>("REDIS_PASSWORD"),
                ttl: 300000,
              };
          return {
            store: await redisStore(storeOptions),
          };
        } catch {
          // Fallback to default in-memory store to avoid startup failures.
          return { ttl: 300000 };
        }
      },
    }),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
