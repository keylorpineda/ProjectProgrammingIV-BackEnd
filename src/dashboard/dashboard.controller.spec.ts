import { Test, TestingModule } from "@nestjs/testing";
import { DashboardController } from "./dashboard.controller";
import { DashboardService } from "./dashboard.service";

describe("DashboardController", () => {
  let controller: DashboardController;
  let service: { getMetricsByCamp: jest.Mock; getCampLeaderboard: jest.Mock };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [
        {
          provide: DashboardService,
          useValue: {
            getMetricsByCamp: jest.fn(),
            getCampLeaderboard: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<DashboardController>(DashboardController);
    service = module.get(DashboardService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  it("should get dashboard metrics using the current user role", async () => {
    const metrics = {
      campId: 1,
      role: "admin",
      generatedAt: new Date("2026-03-23T00:00:00.000Z"),
      camp: {
        totalPeople: 5,
        activeWorkers: 3,
        unavailablePeople: 2,
        campCapacity: 10,
        occupancyRate: 50,
        activeExplorations: 1,
      },
      warehouse: {
        totalResourceTypes: 1,
        resourcesWithAlerts: 0,
        inventoryTotalQuantity: 9,
        criticalResources: [],
      },
      transfers: {
        pendingTransfers: 0,
        approvedTransfers: 2,
        completedTransfers: 4,
      },
    };
    service.getMetricsByCamp.mockResolvedValue(metrics);

    const result = await controller.getDashboardByCamp(1, { role: "admin" });

    expect(service.getMetricsByCamp).toHaveBeenCalledWith(1, "admin");
    expect(result).toEqual(metrics);
  });

  it("should use an empty role when the current user is missing", async () => {
    service.getMetricsByCamp.mockResolvedValue({ campId: 2 });

    await controller.getDashboardByCamp(2, undefined as any);

    expect(service.getMetricsByCamp).toHaveBeenCalledWith(2, "");
  });

  it("should get camp leaderboard", async () => {
    const leaderboard = [
      { campId: 1, campName: "Camp 1", survivalScore: 500 },
      { campId: 2, campName: "Camp 2", survivalScore: 450 },
    ];
    service.getCampLeaderboard.mockResolvedValue(leaderboard);

    const result = await controller.getCampLeaderboard();

    expect(service.getCampLeaderboard).toHaveBeenCalled();
    expect(result).toEqual(leaderboard);
  });
});
