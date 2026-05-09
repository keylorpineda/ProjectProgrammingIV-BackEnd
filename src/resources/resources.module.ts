import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ResourcesController } from "./resources.controller";
import { ResourcesService } from "./resources.service";
import { Resource } from "./entities/resource.entity";
import { Inventory } from "./entities/inventory.entity";
import { InventoryMovement } from "./entities/inventory-movement.entity";
import { DailyProduction } from "./entities/daily-production.entity";
import { DailyConsumption } from "./entities/daily-consumption.entity";
import { AuditLog } from "../common/entities/audit-log.entity";
import { Camp } from "../camps/entities/camp.entity";
import { Person } from "../users/entities/person.entity";
import { BullModule } from "@nestjs/bullmq";
import { DailyTasksProcessor } from "./processors/daily-tasks.processor";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Resource,
      Inventory,
      InventoryMovement,
      DailyProduction,
      DailyConsumption,
      AuditLog,
      Camp,
      Person,
    ]),
    BullModule.registerQueue({
      name: "daily-tasks",
    }),
  ],
  controllers: [ResourcesController],
  providers: [ResourcesService, DailyTasksProcessor],
  exports: [ResourcesService, TypeOrmModule],
})
export class ResourcesModule {}
