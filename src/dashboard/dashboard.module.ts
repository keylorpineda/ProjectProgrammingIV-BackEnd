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
            ? { url: redisUrl, socket: { family: 4 }, ttl: 300000 }
            : {
                socket: {
                  host: configService.get<string>("REDIS_HOST", "localhost"),
                  port: configService.get<number>("REDIS_PORT", 6379),
                  family: 4,
                },
                password: configService.get<string>("REDIS_PASSWORD"),
                ttl: 300000,
              };
          
          const store = await redisStore(storeOptions);
          
          // Handle errors gracefully so they don't crash the entire NestJS app
          if (store && (store as any).client) {
            (store as any).client.on('error', (err: any) => {
              console.error('Cache Redis Error (Ignored):', err.message);
            });
          }

          return { store };
        } catch (err) {
          console.warn('Could not connect to Redis Cache, falling back to memory cache.');
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
