import { Test, TestingModule } from "@nestjs/testing";
import { TransfersController } from "./transfers.controller";
import { TransfersService } from "./transfers.service";

describe("TransfersController", () => {
  let controller: TransfersController;
  let service: jest.Mocked<TransfersService>;

  const mockRequest = {
    id: 1,
    camp_origin_id: 10,
    camp_destination_id: 20,
    status: "pending",
  } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TransfersController],
      providers: [
        {
          provide: TransfersService,
          useValue: {
            createRequest: jest.fn(),
            findRequestById: jest.fn(),
            findRequestsByCamp: jest.fn(),
            findPendingRequestsByCamp: jest.fn(),
            approveOrRejectRequest: jest.fn(),
            cancelRequest: jest.fn(),
            arriveRequest: jest.fn(),
            getTransferStatistics: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(TransfersController);
    service = module.get(TransfersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  it("should create a transfer request using the current user", async () => {
    const dto = {
      camp_origin_id: 10,
      camp_destination_id: 20,
      type: "both",
    } as any;
    service.createRequest.mockResolvedValueOnce(mockRequest);

    const result = await controller.createRequest(dto, { userId: 7 });

    expect(result).toBe(mockRequest);
    expect(service.createRequest).toHaveBeenCalledWith(dto, 7);
  });

  it("should get a request by id", async () => {
    service.findRequestById.mockResolvedValueOnce(mockRequest);

    const result = await controller.getRequest(1);

    expect(result).toBe(mockRequest);
    expect(service.findRequestById).toHaveBeenCalledWith(1);
  });

  it("should get requests by camp with role filter", async () => {
    service.findRequestsByCamp.mockResolvedValueOnce([mockRequest]);

    const result = await controller.getRequestsByCamp(10, "origin");

    expect(result).toEqual([mockRequest]);
    expect(service.findRequestsByCamp).toHaveBeenCalledWith(
      10,
      "origin",
      undefined,
    );
  });

  it("should get pending requests by camp", async () => {
    service.findPendingRequestsByCamp.mockResolvedValueOnce([mockRequest]);

    const result = await controller.getPendingRequests(10);

    expect(result).toEqual([mockRequest]);
    expect(service.findPendingRequestsByCamp).toHaveBeenCalledWith(10);
  });

  it("should approve or reject a request using the current user", async () => {
    const dto = { status: "approved", notes: "ok" } as any;
    service.approveOrRejectRequest.mockResolvedValueOnce({
      ...mockRequest,
      status: "approved",
    });

    const result = await controller.approveOrReject(1, dto, { userId: 9 });

    expect(result.status).toBe("approved");
    expect(service.approveOrRejectRequest).toHaveBeenCalledWith(1, 9, dto);
  });

  it("should cancel a request using the current user", async () => {
    service.cancelRequest.mockResolvedValueOnce({
      ...mockRequest,
      status: "cancelled",
    });

    const result = await controller.cancelRequest(1, { userId: 5 });

    expect(result.status).toBe("cancelled");
    expect(service.cancelRequest).toHaveBeenCalledWith(1, 5);
  });

  it("should mark a request as arrived using the current user", async () => {
    service.arriveRequest.mockResolvedValueOnce({
      ...mockRequest,
      status: "completed",
    });

    const result = await controller.arriveRequest(1, { userId: 12 });

    expect(result.status).toBe("completed");
    expect(service.arriveRequest).toHaveBeenCalledWith(1, 12);
  });

  it("should get transfer statistics for a camp", async () => {
    const stats = {
      totalRequests: 3,
      pending: 1,
      approved: 1,
      completed: 1,
      rejected: 0,
      cancelled: 0,
      asOrigin: 2,
      asDestination: 1,
    };
    service.getTransferStatistics.mockResolvedValueOnce(stats);

    const result = await controller.getStatistics(10);

    expect(result).toEqual(stats);
    expect(service.getTransferStatistics).toHaveBeenCalledWith(10);
  });
});
