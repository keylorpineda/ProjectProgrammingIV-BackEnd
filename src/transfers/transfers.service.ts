import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { IntercampRequest } from "./entities/intercamp-request.entity";
import { UserAccount } from "../users/entities/user-account.entity";
import { RequestsService } from "./services/requests.service";
import { ApprovalsService } from "./services/approvals.service";
import { TransferExecutionService } from "./services/transfer-execution.service";
import { CreateIntercampRequestDto } from "./dto/create-intercamp-request.dto";
import { ApprovalDto } from "./dto/approval.dto";

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
  ): Promise<IntercampRequest[]> {
    return this.requestsService.findRequestsByCamp(campId, role, status);
  }

  async findPendingRequestsByCamp(campId: number): Promise<IntercampRequest[]> {
    return this.requestsService.findPendingRequestsByCamp(campId);
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
    return this.requestsService.cancelRequest(requestId, userId, user!.camp_id);
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
