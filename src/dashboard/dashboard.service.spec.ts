import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { NotFoundException } from "@nestjs/common";
import { DashboardService } from "./dashboard.service";
import {
  CampPopulationSummaryView,
  PersonStatusStatsView,
  InventoryStatusView,
  InventoryAlertView,
  TransferCampSummaryView,
  ExplorationSummaryView,
  PersonProfessionStatsView,
} from "../database/views";

describe("DashboardService", () => {
  let service: DashboardService;
  let campPopulationView: { findOne: jest.Mock; find: jest.Mock };
  let personStatusStatsView: { find: jest.Mock };
  let inventoryStatusView: { find: jest.Mock };
  let inventoryAlertView: { find: jest.Mock };
  let transferSummaryView: { findOne: jest.Mock };
  let explorationSummaryView: { count: jest.Mock };
  let professionStatsView: { find: jest.Mock };
  let cacheManager: { get: jest.Mock; set: jest.Mock };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        {
          provide: getRepositoryToken(CampPopulationSummaryView),
          useValue: { findOne: jest.fn(), find: jest.fn() },
        },
        {
          provide: getRepositoryToken(PersonStatusStatsView),
          useValue: { find: jest.fn() },
        },
        {
          provide: getRepositoryToken(InventoryStatusView),
          useValue: { find: jest.fn() },
        },
        {
          provide: getRepositoryToken(InventoryAlertView),
          useValue: { find: jest.fn() },
        },
        {
          provide: getRepositoryToken(TransferCampSummaryView),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(ExplorationSummaryView),
          useValue: { count: jest.fn() },
        },
        {
          provide: getRepositoryToken(PersonProfessionStatsView),
          useValue: { find: jest.fn() },
        },
        {
          provide: CACHE_MANAGER,
          useValue: { get: jest.fn(), set: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
    campPopulationView = module.get(
      getRepositoryToken(CampPopulationSummaryView),
    );
    personStatusStatsView = module.get(
      getRepositoryToken(PersonStatusStatsView),
    );
    inventoryStatusView = module.get(getRepositoryToken(InventoryStatusView));
    inventoryAlertView = module.get(getRepositoryToken(InventoryAlertView));
    transferSummaryView = module.get(
      getRepositoryToken(TransferCampSummaryView),
    );
    explorationSummaryView = module.get(
      getRepositoryToken(ExplorationSummaryView),
    );
    professionStatsView = module.get(
      getRepositoryToken(PersonProfessionStatsView),
    );
    cacheManager = module.get(CACHE_MANAGER);

    cacheManager.get.mockResolvedValue(undefined);
    cacheManager.set.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  it("should build dashboard metrics with numeric conversions", async () => {
    campPopulationView.findOne.mockResolvedValue({
      camp_id: 3,
      total_people: "15",
      active_workers: "10",
      unavailable_people: "5",
      max_capacity: 20,
      occupancy_rate: "75.5",
    });
    explorationSummaryView.count.mockResolvedValue(2);
    inventoryStatusView.find.mockResolvedValue([
      { resource_id: 1, current_quantity: "8" },
      { resource_id: 2, current_quantity: 4 },
    ]);
    inventoryAlertView.find.mockResolvedValue([
      {
        resource_id: "2",
        resource_name: "Agua",
        current_quantity: "4",
        minimum_stock_required: "6",
      },
    ]);
    transferSummaryView.findOne.mockResolvedValue({
      pending: "3",
      approved: "1",
      completed: "7",
    });
    professionStatsView.find.mockResolvedValue([
      { profession_name: "Medico", active: "0" },
      { profession_name: "Ingeniero", active: "2" },
    ]);

    const result = await service.getMetricsByCamp(3, "admin");

    expect(cacheManager.get).toHaveBeenCalledWith("dashboard:metrics:3:admin");

    expect(campPopulationView.findOne).toHaveBeenCalledWith({
      where: { camp_id: 3 },
    });
    expect(explorationSummaryView.count).toHaveBeenCalledWith({
      where: {
        camp_id: 3,
        status: "in_progress",
      },
    });
    expect(professionStatsView.find).toHaveBeenCalledWith({
      where: { camp_id: 3 },
    });
    expect(inventoryStatusView.find).toHaveBeenCalledWith({
      where: { camp_id: 3 },
      order: { resource_id: "ASC" },
    });
    expect(inventoryAlertView.find).toHaveBeenCalledWith({
      where: { camp_id: 3 },
      order: { resource_id: "ASC" },
    });
    expect(transferSummaryView.findOne).toHaveBeenCalledWith({
      where: { camp_id: 3 },
    });
    expect(result).toMatchObject({
      campId: 3,
      role: "admin",
      camp: {
        totalPeople: 15,
        activeWorkers: 10,
        unavailablePeople: 5,
        campCapacity: 20,
        occupancyRate: 75.5,
        activeExplorations: 2,
        emptyProfessions: ["Medico"],
      },
      warehouse: {
        totalResourceTypes: 2,
        resourcesWithAlerts: 1,
        inventoryTotalQuantity: 12,
        criticalResources: [
          {
            resourceId: 2,
            resourceName: "Agua",
            currentQuantity: 4,
            minimumRequired: 6,
          },
        ],
      },
      transfers: {
        pendingTransfers: 3,
        approvedTransfers: 1,
        completedTransfers: 7,
      },
    });
    expect(cacheManager.set).toHaveBeenCalledWith(
      "dashboard:metrics:3:admin",
      expect.objectContaining({
        campId: 3,
        role: "admin",
      }),
    );
    expect(result.generatedAt).toBeInstanceOf(Date);
  });

  it("should return cached dashboard metrics when available", async () => {
    const cached = {
      campId: 99,
      role: "admin",
      generatedAt: new Date("2026-03-24T00:00:00.000Z"),
      camp: {
        totalPeople: 12,
        activeWorkers: 8,
        unavailablePeople: 4,
        campCapacity: 30,
        occupancyRate: 40,
        activeExplorations: 1,
        emptyProfessions: [],
      },
      warehouse: {
        totalResourceTypes: 2,
        resourcesWithAlerts: 0,
        inventoryTotalQuantity: 100,
        criticalResources: [],
      },
      transfers: {
        pendingTransfers: 1,
        approvedTransfers: 0,
        completedTransfers: 2,
      },
    };
    cacheManager.get.mockResolvedValue(cached);

    const result = await service.getMetricsByCamp(99, "admin");

    expect(result).toEqual(cached);
    expect(campPopulationView.findOne).not.toHaveBeenCalled();
    expect(cacheManager.set).not.toHaveBeenCalled();
  });

  it("should continue without failing when cache backend is unavailable", async () => {
    cacheManager.get.mockRejectedValue(new Error("cache down"));
    cacheManager.set.mockRejectedValue(new Error("cache write down"));

    campPopulationView.findOne.mockResolvedValue({
      camp_id: 5,
      total_people: "3",
      active_workers: "2",
      unavailable_people: "1",
      max_capacity: 10,
      occupancy_rate: "30",
    });
    explorationSummaryView.count.mockResolvedValue(0);
    inventoryStatusView.find.mockResolvedValue([]);
    inventoryAlertView.find.mockResolvedValue([]);
    transferSummaryView.findOne.mockResolvedValue(null);
    professionStatsView.find.mockResolvedValue([]);

    await expect(service.getMetricsByCamp(5, "admin")).resolves.toMatchObject({
      campId: 5,
      role: "admin",
    });
  });

  it("should return null occupancy rate and zero transfer metrics when summary is missing", async () => {
    campPopulationView.findOne.mockResolvedValue({
      camp_id: 9,
      total_people: 4,
      active_workers: 1,
      unavailable_people: 3,
      max_capacity: null,
      occupancy_rate: 0,
    });
    explorationSummaryView.count.mockResolvedValue(0);
    inventoryStatusView.find.mockResolvedValue([]);
    inventoryAlertView.find.mockResolvedValue([]);
    transferSummaryView.findOne.mockResolvedValue(null);
    professionStatsView.find.mockResolvedValue([]);

    const result = await service.getMetricsByCamp(9, "gestor_recursos");

    expect(result.camp).toEqual({
      totalPeople: 4,
      activeWorkers: 1,
      unavailablePeople: 3,
      campCapacity: null,
      occupancyRate: null,
      activeExplorations: 0,
      emptyProfessions: [],
    });
    expect(result.warehouse).toEqual({
      totalResourceTypes: 0,
      resourcesWithAlerts: 0,
      inventoryTotalQuantity: 0,
      criticalResources: [],
    });
    expect(result.transfers).toEqual({
      pendingTransfers: 0,
      approvedTransfers: 0,
      completedTransfers: 0,
    });
  });

  it("should return top 10 camps ordered by survival score", async () => {
    campPopulationView.find.mockResolvedValue(
      Array.from({ length: 12 }, (_, index) => ({
        camp_id: index + 1,
        camp_name: `Camp ${index + 1}`,
      })),
    );

    inventoryStatusView.find.mockResolvedValue([
      { camp_id: 1, resource_category: "food", current_quantity: 100 },
      { camp_id: 1, resource_category: "water", current_quantity: 80 },
      { camp_id: 2, resource_category: "food", current_quantity: 20 },
      { camp_id: 2, resource_category: "water", current_quantity: 15 },
      { camp_id: 12, resource_category: "food", current_quantity: 1 },
      { camp_id: 12, resource_category: "water", current_quantity: 1 },
    ]);

    personStatusStatsView.find.mockResolvedValue([
      { camp_id: 1, status: "active", person_count: 10 },
      { camp_id: 1, status: "sick", person_count: 1 },
      { camp_id: 1, status: "deceased", person_count: 0 },
      { camp_id: 2, status: "active", person_count: 3 },
      { camp_id: 2, status: "sick", person_count: 2 },
      { camp_id: 2, status: "deceased", person_count: 1 },
      { camp_id: 12, status: "active", person_count: 0 },
      { camp_id: 12, status: "deceased", person_count: 2 },
    ]);

    const leaderboard = await service.getCampLeaderboard();

    expect(campPopulationView.find).toHaveBeenCalledWith({
      order: { camp_id: "ASC" },
    });
    expect(inventoryStatusView.find).toHaveBeenCalled();
    expect(personStatusStatsView.find).toHaveBeenCalled();
    expect(leaderboard).toHaveLength(10);
    expect(leaderboard[0]).toMatchObject({
      campId: 1,
      campName: "Camp 1",
      survivalScore: 660,
      resources: { foodRations: 100, waterRations: 80 },
      population: { healthy: 10, sick: 1, deceased: 0 },
    });
    expect(leaderboard[1]).toMatchObject({
      campId: 2,
      survivalScore: 45,
    });
    expect(leaderboard.some((camp) => camp.campId === 12)).toBe(false);
  });

  it("should throw NotFoundException when the camp summary does not exist", async () => {
    campPopulationView.findOne.mockResolvedValue(null);

    await expect(service.getMetricsByCamp(77, "admin")).rejects.toThrow(
      new NotFoundException("Camp with ID 77 was not found"),
    );

    expect(explorationSummaryView.count).not.toHaveBeenCalled();
    expect(inventoryStatusView.find).not.toHaveBeenCalled();
    expect(inventoryAlertView.find).not.toHaveBeenCalled();
    expect(transferSummaryView.findOne).not.toHaveBeenCalled();
    expect(cacheManager.set).not.toHaveBeenCalled();
  });
});
