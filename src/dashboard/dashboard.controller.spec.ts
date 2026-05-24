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
      camp_id: 1,
      role: "admin",
      generated_at: new Date("2026-03-23T00:00:00.000Z"),
      camp: {
        total_people: 5,
        active_workers: 3,
        unavailable_people: 2,
        camp_capacity: 10,
        occupancy_rate: 50,
        active_explorations: 1,
      },
      warehouse: {
        total_resource_types: 1,
        resources_with_alerts: 0,
        inventory_total_quantity: 9,
        critical_resources: [],
      },
      transfers: {
        pending_transfers: 0,
        approved_transfers: 2,
        completed_transfers: 4,
      },
    };
    service.getMetricsByCamp.mockResolvedValue(metrics);

    const result = await controller.getDashboardByCamp(1, { role: "admin" });

    expect(service.getMetricsByCamp).toHaveBeenCalledWith(1, "admin");
    expect(result).toEqual(metrics);
  });

  it("should use an empty role when the current user is missing", async () => {
    service.getMetricsByCamp.mockResolvedValue({ camp_id: 2 });

    await controller.getDashboardByCamp(2, undefined as any);

    expect(service.getMetricsByCamp).toHaveBeenCalledWith(2, "");
  });

  it("should get camp leaderboard", async () => {
    const leaderboard = [
      { camp_id: 1, camp_name: "Camp 1", survival_score: 500 },
      { camp_id: 2, camp_name: "Camp 2", survival_score: 450 },
    ];
    service.getCampLeaderboard.mockResolvedValue(leaderboard);

    const result = await controller.getCampLeaderboard();

    expect(service.getCampLeaderboard).toHaveBeenCalled();
    expect(result).toEqual(leaderboard);
  });
});
