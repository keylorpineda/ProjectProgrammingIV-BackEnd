import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { EntityManager } from "typeorm";
import { Repository, DataSource } from "typeorm";
import { Approval } from "../entities/approval.entity";
import { IntercampRequest } from "../entities/intercamp-request.entity";
import { UserAccount } from "../../users/entities/user-account.entity";
import { AuditLog } from "../../common/entities/audit-log.entity";
import type { ApprovalDto } from "../dto/approval.dto";
import { Inject } from "@nestjs/common";
import { REDIS_CLIENT } from "../../redis/redis.constants";
import { Redis } from "ioredis";

@Injectable()
export class ApprovalsService {
  constructor(
    @InjectRepository(Approval)
    private readonly approvalRepo: Repository<Approval>,
    @InjectRepository(IntercampRequest)
    private readonly requestRepo: Repository<IntercampRequest>,
    @InjectRepository(UserAccount)
    private readonly userRepo: Repository<UserAccount>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    private readonly dataSource: DataSource,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  private async invalidateCampDashboardCache(campId: number): Promise<void> {
    try {
      const keys = await this.redis.keys(`dashboard:metrics:${campId}:*`);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (err) {
      // Ignore
    }
  }

  async approveOrReject(
    request: IntercampRequest,
    userId: number,
    dto: ApprovalDto,
    outerManager?: EntityManager,
  ): Promise<{ approved: Approval; bothApproved: boolean }> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ["camp", "role"],
    });

    if (!user) {
      throw new NotFoundException(`Usuario con ID ${userId} no encontrado`);
    }

    const userCampId = user.camp_id;

    if (
      userCampId !== request.camp_origin_id &&
      userCampId !== request.camp_destination_id
    ) {
      throw new ForbiddenException(
        "Solo usuarios de los campamentos implicados pueden aprobar/rechazar",
      );
    }

    const existingApproval = request.approvals?.find(
      (a) => a.user_id === userId,
    );

    if (existingApproval) {
      throw new BadRequestException("Ya has registrado tu decisión");
    }

    const campRole =
      userCampId === request.camp_origin_id ? "origin" : "destination";

    const otherCampApprovalExists = request.approvals?.some(
      (a) =>
        a.status === "approved" &&
        ((campRole === "origin" &&
          a.user.camp_id === request.camp_destination_id) ||
          (campRole === "destination" &&
            a.user.camp_id === request.camp_origin_id)),
    );

    // La inserción del voto, el cambio de estado y la auditoría se confirman
    // juntos. Si el llamador proporciona outerManager, operamos dentro de su
    // transacción en lugar de abrir una nueva, de modo que approval + departure
    // sean atómicos cuando ambos campamentos han aprobado.
    const doWork = async (manager: EntityManager) => {
      const created = manager.create(Approval, {
        user_id: userId,
        entity_type: "intercamp_request",
        entity_id: Number(request.id),
        approval_date: new Date(),
        status: dto.status,
      });
      await manager.save(created);

      if (dto.status === "rejected") {
        request.status = "rejected";
        await manager.save(request);
        await manager.save(
          manager.create(AuditLog, {
            user_id: userId,
            camp_id: userCampId,
            action: "intercamp_request_rejected",
            entity_type: "intercamp_request",
            entity_id: Number(request.id),
            new_value: { notes: dto.notes },
            date: new Date(),
          }),
        );
        return { approval: created, bothApproved: false, campsTouched: true };
      }

      if (dto.status === "approved" && otherCampApprovalExists) {
        request.status = "approved";
        await manager.save(request);
        await manager.save(
          manager.create(AuditLog, {
            user_id: userId,
            camp_id: userCampId,
            action: "intercamp_request_approved_dual",
            entity_type: "intercamp_request",
            entity_id: Number(request.id),
            new_value: { both_camps_approved: true },
            date: new Date(),
          }),
        );
        return { approval: created, bothApproved: true, campsTouched: true };
      }

      await manager.save(
        manager.create(AuditLog, {
          user_id: userId,
          camp_id: userCampId,
          action: "intercamp_request_approved_partial",
          entity_type: "intercamp_request",
          entity_id: Number(request.id),
          new_value: { waiting_other_camp: true },
          date: new Date(),
        }),
      );
      return { approval: created, bothApproved: false, campsTouched: false };
    };

    const { approval, bothApproved, campsTouched } = outerManager
      ? await doWork(outerManager)
      : await this.dataSource.transaction(doWork);

    // Invalidar caché sólo cuando gestionamos nuestra propia transacción.
    // Si hay outerManager, el llamador lo hará después del commit externo.
    if (!outerManager && campsTouched) {
      await this.invalidateCampDashboardCache(request.camp_origin_id);
      await this.invalidateCampDashboardCache(request.camp_destination_id);
    }

    return { approved: approval, bothApproved };
  }
}
