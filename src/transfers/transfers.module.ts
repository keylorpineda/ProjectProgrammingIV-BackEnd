import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TransfersController } from "./transfers.controller";
import { TransfersService } from "./transfers.service";
import { RequestsService } from "./services/requests.service";
import { ApprovalsService } from "./services/approvals.service";
import { TransferExecutionService } from "./services/transfer-execution.service";
import { IntercampRequest } from "./entities/intercamp-request.entity";
import { RequestResourceDetail } from "./entities/request-resource-detail.entity";
import { RequestPersonDetail } from "./entities/request-person-detail.entity";
import { Approval } from "./entities/approval.entity";
import { Camp } from "../camps/entities/camp.entity";
import { Person } from "../users/entities/person.entity";
import { UserAccount } from "../users/entities/user-account.entity";
import { Inventory } from "../resources/entities/inventory.entity";
import { Resource } from "../resources/entities/resource.entity";
import { InventoryMovement } from "../resources/entities/inventory-movement.entity";
import { AuditLog } from "../common/entities/audit-log.entity";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      IntercampRequest,
      RequestResourceDetail,
      RequestPersonDetail,
      Approval,
      Camp,
      Person,
      UserAccount,
      Inventory,
      Resource,
      InventoryMovement,
      AuditLog,
    ]),
    NotificationsModule,
  ],
  controllers: [TransfersController],
  providers: [
    TransfersService,
    RequestsService,
    ApprovalsService,
    TransferExecutionService,
  ],
  exports: [TransfersService],
})
export class TransfersModule {}
