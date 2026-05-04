import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { TransfersService } from "./transfers.service";
import { UserAccount } from "../users/entities/user-account.entity";
import { RequestsService } from "./services/requests.service";
import { ApprovalsService } from "./services/approvals.service";
import { TransferExecutionService } from "./services/transfer-execution.service";

describe("TransfersService", () => {
  let service: TransfersService;
  let userRepo: { findOne: jest.Mock };
  let requestsService: jest.Mocked<RequestsService>;
  let approvalsService: jest.Mocked<ApprovalsService>;
  let executionService: jest.Mocked<TransferExecutionService>;

  const mockRequest = {
    id: 1,
    camp_origin_id: 10,
    camp_destination_id: 20,
    status: "pending",
    approvals: [],
  } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransfersService,
        {
          provide: getRepositoryToken(UserAccount),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: RequestsService,
          useValue: {
            createRequest: jest.fn(),
            findRequestById: jest.fn(),
            findRequestsByCamp: jest.fn(),
            findPendingRequestsByCamp: jest.fn(),
            cancelRequest: jest.fn(),
            getTransferStatistics: jest.fn(),
          },
        },
        {
          provide: ApprovalsService,
          useValue: {
            approveOrReject: jest.fn(),
          },
        },
        {
          provide: TransferExecutionService,
          useValue: {
            departTransfer: jest.fn(),
            arriveTransfer: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(TransfersService);
    userRepo = module.get(getRepositoryToken(UserAccount));
    requestsService = module.get(RequestsService);
    approvalsService = module.get(ApprovalsService);
    executionService = module.get(TransferExecutionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  it("should delegate createRequest", async () => {
    const dto = { type: "resources" } as any;
    requestsService.createRequest.mockResolvedValueOnce(mockRequest);

    const result = await service.createRequest(dto, 7);

    expect(result).toBe(mockRequest);
    expect(requestsService.createRequest).toHaveBeenCalledWith(dto, 7);
  });

  it("should delegate findRequestById", async () => {
    requestsService.findRequestById.mockResolvedValueOnce(mockRequest);

    await expect(service.findRequestById(1)).resolves.toBe(mockRequest);
  });

  it("should delegate findRequestsByCamp", async () => {
    requestsService.findRequestsByCamp.mockResolvedValueOnce([mockRequest]);

    await expect(service.findRequestsByCamp(10, "destination")).resolves.toEqual([
      mockRequest,
    ]);
    expect(requestsService.findRequestsByCamp).toHaveBeenCalledWith(
      10,
      "destination",
      undefined,
    );
  });
  it("should delegate findPendingRequestsByCamp", async () => {
    requestsService.findPendingRequestsByCamp.mockResolvedValueOnce([
      mockRequest,
    ]);

    await expect(service.findPendingRequestsByCamp(10)).resolves.toEqual([
      mockRequest,
    ]);
  });

  it("should approve and execute the transfer when both camps approved", async () => {
    requestsService.findRequestById
      .mockResolvedValueOnce(mockRequest)
      .mockResolvedValueOnce({ ...mockRequest, status: "completed" });
    approvalsService.approveOrReject.mockResolvedValueOnce({
      approved: { id: 1 } as any,
      bothApproved: true,
    });

    const result = await service.approveOrRejectRequest(1, 9, {
      status: "approved",
    } as any);

    expect(approvalsService.approveOrReject).toHaveBeenCalledWith(
      mockRequest,
      9,
      {
        status: "approved",
      },
    );
    expect(executionService.departTransfer).toHaveBeenCalledWith(
      mockRequest,
      9,
    );
    expect(result.status).toBe("completed");
  });

  it("should approve without executing when both camps have not approved", async () => {
    requestsService.findRequestById
      .mockResolvedValueOnce(mockRequest)
      .mockResolvedValueOnce({ ...mockRequest, status: "pending" });
    approvalsService.approveOrReject.mockResolvedValueOnce({
      approved: { id: 1 } as any,
      bothApproved: false,
    });

    const result = await service.approveOrRejectRequest(1, 9, {
      status: "approved",
    } as any);

    expect(executionService.departTransfer).not.toHaveBeenCalled();
    expect(result.status).toBe("pending");
  });

  it("should arrive request and reload it", async () => {
    requestsService.findRequestById
      .mockResolvedValueOnce({ ...mockRequest, status: "in_transit" })
      .mockResolvedValueOnce({ ...mockRequest, status: "completed" });

    const result = await service.arriveRequest(1, 9);

    expect(executionService.arriveTransfer).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, status: "in_transit" }),
      9,
    );
    expect(result.status).toBe("completed");
  });

  it("should cancel a request using the current user camp", async () => {
    userRepo.findOne.mockResolvedValueOnce({ id: 5, camp_id: 10 });
    requestsService.cancelRequest.mockResolvedValueOnce({
      ...mockRequest,
      status: "cancelled",
    });

    const result = await service.cancelRequest(1, 5);

    expect(userRepo.findOne).toHaveBeenCalledWith({ where: { id: 5 } });
    expect(requestsService.cancelRequest).toHaveBeenCalledWith(1, 5, 10);
    expect(result.status).toBe("cancelled");
  });

  it("should delegate getTransferStatistics", async () => {
    const stats = {
      totalRequests: 2,
      pending: 1,
      approved: 0,
      completed: 1,
      rejected: 0,
      cancelled: 0,
      asOrigin: 1,
      asDestination: 1,
    };
    requestsService.getTransferStatistics.mockResolvedValueOnce(stats);

    await expect(service.getTransferStatistics(10)).resolves.toEqual(stats);
  });
});
