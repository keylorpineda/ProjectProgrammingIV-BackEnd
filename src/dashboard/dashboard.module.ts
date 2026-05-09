import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DashboardController } from "./dashboard.controller";
import { DashboardService } from "./dashboard.service";
import { DatabaseModule } from "../database/database.module";
import {
  CampPopulationSummaryView,
  InventoryStatusView,
  InventoryAlertView,
  TransferCampSummaryView,
  ExplorationSummaryView,
  PersonProfessionStatsView,
} from "../database/views";
import { CacheModule } from "@nestjs/cache-manager";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { redisStore } from "cache-manager-redis-yet";

@Module({
  imports: [
    DatabaseModule,
    TypeOrmModule.forFeature([
      CampPopulationSummaryView,
      InventoryStatusView,
      InventoryAlertView,
      TransferCampSummaryView,
      ExplorationSummaryView,
      PersonProfessionStatsView,
    ]),
    CacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        store: await redisStore({
          socket: {
            host: configService.get<string>("REDIS_HOST", "localhost"),
            port: configService.get<number>("REDIS_PORT", 6379),
          },
          password: configService.get<string>("REDIS_PASSWORD"),
          ttl: 300000, // 5 minutos por defecto en milisegundos (para redisStore puede ser ms o segn versión, asumo default ttl en ms/s)
        }),
      }),
    }),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
