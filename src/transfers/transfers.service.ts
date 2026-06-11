import { Injectable, UnauthorizedException, Inject } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import type { IntercampRequest } from "./entities/intercamp-request.entity";
import { UserAccount } from "../users/entities/user-account.entity";
import { RequestsService } from "./services/requests.service";
import { ApprovalsService } from "./services/approvals.service";
import { TransferExecutionService } from "./services/transfer-execution.service";
import type { CreateIntercampRequestDto } from "./dto/create-intercamp-request.dto";
import type { ApprovalDto } from "./dto/approval.dto";
import { REDIS_CLIENT } from "../redis/redis.constants";
import { Redis } from "ioredis";

@Injectable()
export class TransfersService {
  constructor(
    @InjectRepository(UserAccount)
    private readonly userRepo: Repository<UserAccount>,
    private readonly requestsService: RequestsService,
    private readonly approvalsService: ApprovalsService,
    private readonly executionService: TransferExecutionService,
    private readonly dataSource: DataSource,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async createRequest(
    dto: CreateIntercampRequestDto,
    userId: number,
  ): Promise<IntercampRequest> {
    return this.requestsService.createRequest(dto, userId);
  }

  async findRequestById(id: number): Promise<IntercampRequest> {
    return this.requestsService.findRequestById(id);
  }

  async findRequestsByCamp(
    campId: number,
    role?: "origin" | "destination",
    status?: string,
    page = 1,
    limit = 20,
  ) {
    return this.requestsService.findRequestsByCamp(
      campId,
      role,
      status,
      page,
      limit,
    );
  }

  async findPendingRequestsByCamp(campId: number): Promise<IntercampRequest[]> {
    return this.requestsService.findPendingRequestsByCamp(campId);
  }

  async findActiveTransfersForMap(): Promise<
    Pick<
      IntercampRequest,
      "id" | "camp_origin_id" | "camp_destination_id" | "type"
    >[]
  > {
    return this.requestsService.findActiveTransfersForMap();
  }

  async approveOrRejectRequest(
    requestId: number,
    userId: number,
    dto: ApprovalDto,
  ): Promise<IntercampRequest> {
    const request = await this.requestsService.findRequestById(requestId);

    // Approval + departure se ejecutan en una sola transacción para que
    // nunca quede el request en status='approved' si la salida falla por
    // stock insuficiente u otro error (split-transaction bug).
    const bothApproved = await this.dataSource.transaction(async (manager) => {
      const { bothApproved: ba } = await this.approvalsService.approveOrReject(
        request,
        userId,
        dto,
        manager,
      );
      if (ba) {
        await this.executionService.departTransfer(request, userId, manager);
      }
      return ba;
    });

    // Invalidar caché DESPUÉS del commit externo (los sub-servicios lo omiten
    // cuando reciben un outerManager).
    if (bothApproved) {
      await this.invalidateCampDashboardCache(request.camp_origin_id);
      await this.invalidateCampDashboardCache(request.camp_destination_id);
    }

    return this.requestsService.findRequestById(requestId);
  }

  private async invalidateCampDashboardCache(campId: number): Promise<void> {
    try {
      const keys = await this.redis.keys(`dashboard:metrics:${campId}:*`);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch {
      // Redis unavailable — ignore
    }
  }

  async arriveRequest(
    requestId: number,
    userId: number,
  ): Promise<IntercampRequest> {
    const request = await this.requestsService.findRequestById(requestId);
    await this.executionService.arriveTransfer(request, userId);
    return this.requestsService.findRequestById(requestId);
  }

  async cancelRequest(
    requestId: number,
    userId: number,
  ): Promise<IntercampRequest> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user || user.camp_id == null) {
      throw new UnauthorizedException(
        "Usuario sin campamento asignado; no puede cancelar la solicitud",
      );
    }
    return this.requestsService.cancelRequest(requestId, userId, user.camp_id);
  }

  async getTransferStatistics(campId: number): Promise<{
    totalRequests: number;
    pending: number;
    approved: number;
    completed: number;
    rejected: number;
    cancelled: number;
    asOrigin: number;
    asDestination: number;
  }> {
    return this.requestsService.getTransferStatistics(campId);
  }
}
