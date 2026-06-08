import { Injectable, UnauthorizedException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type { IntercampRequest } from "./entities/intercamp-request.entity";
import { UserAccount } from "../users/entities/user-account.entity";
import { RequestsService } from "./services/requests.service";
import { ApprovalsService } from "./services/approvals.service";
import { TransferExecutionService } from "./services/transfer-execution.service";
import type { CreateIntercampRequestDto } from "./dto/create-intercamp-request.dto";
import type { ApprovalDto } from "./dto/approval.dto";

@Injectable()
export class TransfersService {
  constructor(
    @InjectRepository(UserAccount)
    private readonly userRepo: Repository<UserAccount>,
    private readonly requestsService: RequestsService,
    private readonly approvalsService: ApprovalsService,
    private readonly executionService: TransferExecutionService,
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

    const { bothApproved } = await this.approvalsService.approveOrReject(
      request,
      userId,
      dto,
    );

    if (bothApproved) {
      await this.executionService.departTransfer(request, userId);
    }

    return this.requestsService.findRequestById(requestId);
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
