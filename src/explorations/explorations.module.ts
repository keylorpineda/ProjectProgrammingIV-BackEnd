import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ExplorationsController } from "./explorations.controller";
import { ExplorationsService } from "./explorations.service";
import { Exploration } from "./entities/exploration.entity";
import { ExplorationPerson } from "./entities/exploration-person.entity";
import { ExplorationResource } from "./entities/exploration-resource.entity";
import { ResourcesModule } from "../resources/resources.module";
import { Person } from "../users/entities/person.entity";
import { AuditLog } from "../common/entities/audit-log.entity";
import { PythonAiService } from "../ai/services/python-ai.service";
import { RedisModule } from "../redis/redis.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Exploration,
      ExplorationPerson,
      ExplorationResource,
      Person,
      AuditLog,
    ]),
    ResourcesModule,
    RedisModule,
  ],
  controllers: [ExplorationsController],
  providers: [ExplorationsService, PythonAiService],
  exports: [ExplorationsService],
})
export class ExplorationsModule {}
