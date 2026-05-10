import { Injectable, NotFoundException, Inject } from "@nestjs/common";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  CampPopulationSummaryView,
  InventoryStatusView,
  InventoryAlertView,
  TransferCampSummaryView,
  ExplorationSummaryView,
  PersonStatusStatsView,
  PersonProfessionStatsView,
} from "../database/views";

interface CampMetrics {
  totalPeople: number;
  activeWorkers: number;
  unavailablePeople: number;
  campCapacity: number | null;
  occupancyRate: number | null;
  activeExplorations: number;
  emptyProfessions: string[];
}

interface WarehouseMetrics {
  totalResourceTypes: number;
  resourcesWithAlerts: number;
  inventoryTotalQuantity: number;
  criticalResources: Array<{
    resourceId: number;
    resourceName: string;
    currentQuantity: number;
    minimumRequired: number;
  }>;
}

interface TransfersMetrics {
  pendingTransfers: number;
  approvedTransfers: number;
  completedTransfers: number;
}

export interface DashboardMetricsResponse {
  campId: number;
  role: string;
  generatedAt: Date;
  camp: CampMetrics;
  warehouse: WarehouseMetrics | null;
  transfers: TransfersMetrics;
}

export interface CampLeaderboardEntry {
  campId: number;
  campName: string;
  survivalScore: number;
  resources: {
    foodRations: number;
    waterRations: number;
  };
  population: {
    healthy: number;
    sick: number;
    deceased: number;
  };
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(CampPopulationSummaryView)
    private readonly campPopulationView: Repository<CampPopulationSummaryView>,
    @InjectRepository(InventoryStatusView)
    private readonly inventoryStatusView: Repository<InventoryStatusView>,
    @InjectRepository(InventoryAlertView)
    private readonly inventoryAlertView: Repository<InventoryAlertView>,
    @InjectRepository(TransferCampSummaryView)
    private readonly transferSummaryView: Repository<TransferCampSummaryView>,
    @InjectRepository(ExplorationSummaryView)
    private readonly explorationSummaryView: Repository<ExplorationSummaryView>,
    @InjectRepository(PersonStatusStatsView)
    private readonly personStatusStatsView: Repository<PersonStatusStatsView>,
    @InjectRepository(PersonProfessionStatsView)
    private readonly professionStatsView: Repository<PersonProfessionStatsView>,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async getCampLeaderboard(): Promise<CampLeaderboardEntry[]> {
    const activeCamps = await this.campPopulationView.find({
      order: { camp_id: "ASC" },
    });

    if (!activeCamps.length) {
      return [];
    }

    const [inventoryRows, personStatusRows] = await Promise.all([
      this.inventoryStatusView.find(),
      this.personStatusStatsView.find(),
    ]);

    const rationByCamp = new Map<number, { food: number; water: number }>();
    for (const row of inventoryRows) {
      const campId = Number(row.camp_id);
      if (!Number.isInteger(campId)) {
        continue;
      }

      const current = rationByCamp.get(campId) ?? { food: 0, water: 0 };
      const quantity = Number(row.current_quantity) || 0;
      const category = String(row.resource_category ?? "").toLowerCase();

      if (category === "food") {
        current.food += quantity;
      }

      if (category === "water") {
        current.water += quantity;
      }

      rationByCamp.set(campId, current);
    }

    const populationByCamp = new Map<
      number,
      { healthy: number; sick: number; deceased: number }
    >();
    for (const row of personStatusRows) {
      const campId = Number(row.camp_id);
      if (!Number.isInteger(campId)) {
        continue;
      }

      const current = populationByCamp.get(campId) ?? {
        healthy: 0,
        sick: 0,
        deceased: 0,
      };
      const status = String(row.status ?? "").toLowerCase();
      const personCount = Number(row.person_count) || 0;

      if (status === "active") {
        current.healthy += personCount;
      } else if (status === "sick") {
        current.sick += personCount;
      } else if (status === "deceased") {
        current.deceased += personCount;
      }

      populationByCamp.set(campId, current);
    }

    return activeCamps
      .map((camp): CampLeaderboardEntry => {
        const campId = Number(camp.camp_id);
        const resources = rationByCamp.get(campId) ?? { food: 0, water: 0 };
        const population = populationByCamp.get(campId) ?? {
          healthy: 0,
          sick: 0,
          deceased: 0,
        };

        const survivalScore =
          resources.food +
          resources.water +
          population.healthy * 50 -
          population.sick * 20 -
          population.deceased * 100;

        return {
          campId,
          campName: camp.camp_name,
          survivalScore,
          resources: {
            foodRations: resources.food,
            waterRations: resources.water,
          },
          population,
        };
      })
      .sort((a, b) => b.survivalScore - a.survivalScore)
      .slice(0, 10);
  }

  async getMetricsByCamp(
    campId: number,
    role: string,
  ): Promise<DashboardMetricsResponse> {
    const cacheKey = `dashboard:metrics:${campId}:${role}`;
    let cachedMetrics: DashboardMetricsResponse | undefined;
    try {
      cachedMetrics =
        await this.cacheManager.get<DashboardMetricsResponse>(cacheKey);
    } catch {
      cachedMetrics = undefined;
    }

    if (cachedMetrics) {
      return cachedMetrics;
    }

    const campPopulation = await this.campPopulationView.findOne({
      where: { camp_id: campId },
    });

    if (!campPopulation) {
      throw new NotFoundException(`Camp with ID ${campId} was not found`);
    }

    const campMetrics = await this.buildCampMetrics(campId, campPopulation);
    const warehouse = await this.buildWarehouseMetrics(campId);
    const transfers = await this.buildTransferMetrics(campId);

    const metrics: DashboardMetricsResponse = {
      campId,
      role,
      generatedAt: new Date(),
      camp: campMetrics,
      warehouse,
      transfers,
    };

    try {
      await this.cacheManager.set(cacheKey, metrics);
    } catch {
      // Cache is best-effort; do not fail dashboard response if cache backend is down.
    }

    return metrics;
  }

  private async buildCampMetrics(
    campId: number,
    campPopulation: CampPopulationSummaryView,
  ): Promise<CampMetrics> {
    const activeExplorations = await this.explorationSummaryView.count({
      where: {
        camp_id: campId,
        status: "in_progress",
      },
    });

    const professionStats = await this.professionStatsView.find({
      where: { camp_id: campId },
    });
    const emptyProfessions = professionStats
      .filter((p) => Number(p.active) === 0)
      .map((p) => p.profession_name);

    return {
      totalPeople: Number(campPopulation.total_people),
      activeWorkers: Number(campPopulation.active_workers),
      unavailablePeople: Number(campPopulation.unavailable_people),
      campCapacity: campPopulation.max_capacity,
      occupancyRate: campPopulation.occupancy_rate
        ? Number(campPopulation.occupancy_rate)
        : null,
      activeExplorations,
      emptyProfessions,
    };
  }

  private async buildWarehouseMetrics(
    campId: number,
  ): Promise<WarehouseMetrics> {
    // Get all inventory items for the camp
    const inventoryItems = await this.inventoryStatusView.find({
      where: { camp_id: campId },
      order: { resource_id: "ASC" },
    });

    // Get critical resources (with alerts)
    const criticalResourcesView = await this.inventoryAlertView.find({
      where: { camp_id: campId },
      order: { resource_id: "ASC" },
    });

    const criticalResources = criticalResourcesView.map((item) => ({
      resourceId: Number(item.resource_id),
      resourceName: item.resource_name,
      currentQuantity: Number(item.current_quantity),
      minimumRequired: Number(item.minimum_stock_required),
    }));

    const inventoryTotalQuantity = inventoryItems.reduce(
      (acc, item) => acc + Number(item.current_quantity),
      0,
    );

    return {
      totalResourceTypes: inventoryItems.length,
      resourcesWithAlerts: criticalResources.length,
      inventoryTotalQuantity,
      criticalResources,
    };
  }

  private async buildTransferMetrics(
    campId: number,
  ): Promise<TransfersMetrics> {
    const transferSummary = await this.transferSummaryView.findOne({
      where: { camp_id: campId },
    });

    if (!transferSummary) {
      return {
        pendingTransfers: 0,
        approvedTransfers: 0,
        completedTransfers: 0,
      };
    }

    return {
      pendingTransfers: Number(transferSummary.pending),
      approvedTransfers: Number(transferSummary.approved),
      completedTransfers: Number(transferSummary.completed),
    };
  }
}
