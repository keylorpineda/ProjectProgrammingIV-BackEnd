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
  total_people: number;
  active_workers: number;
  unavailable_people: number;
  camp_capacity: number | null;
  occupancy_rate: number | null;
  active_explorations: number;
  empty_professions: string[];
}

interface WarehouseMetrics {
  total_resource_types: number;
  resources_with_alerts: number;
  inventory_total_quantity: number;
  critical_resources: Array<{
    resource_id: number;
    resource_name: string;
    current_quantity: number;
    minimum_required: number;
  }>;
}

interface TransfersMetrics {
  pending_transfers: number;
  approved_transfers: number;
  completed_transfers: number;
}

export interface DashboardMetricsResponse {
  camp_id: number;
  role: string;
  generated_at: Date;
  camp: CampMetrics;
  warehouse: WarehouseMetrics | null;
  transfers: TransfersMetrics;
}

export interface CampLeaderboardEntry {
  camp_id: number;
  camp_name: string;
  survival_score: number;
  resources: {
    food_rations: number;
    water_rations: number;
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
          camp_id: campId,
          camp_name: camp.camp_name,
          survival_score: survivalScore,
          resources: {
            food_rations: resources.food,
            water_rations: resources.water,
          },
          population,
        };
      })
      .sort((a, b) => b.survival_score - a.survival_score)
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
      camp_id: campId,
      role,
      generated_at: new Date(),
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
      total_people: Number(campPopulation.total_people),
      active_workers: Number(campPopulation.active_workers),
      unavailable_people: Number(campPopulation.unavailable_people),
      camp_capacity: campPopulation.max_capacity,
      occupancy_rate: campPopulation.occupancy_rate
        ? Number(campPopulation.occupancy_rate)
        : null,
      active_explorations: activeExplorations,
      empty_professions: emptyProfessions,
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
      resource_id: Number(item.resource_id),
      resource_name: item.resource_name,
      current_quantity: Number(item.current_quantity),
      minimum_required: Number(item.minimum_stock_required),
    }));

    const inventoryTotalQuantity = inventoryItems.reduce(
      (acc, item) => acc + Number(item.current_quantity),
      0,
    );

    return {
      total_resource_types: inventoryItems.length,
      resources_with_alerts: criticalResources.length,
      inventory_total_quantity: inventoryTotalQuantity,
      critical_resources: criticalResources,
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
        pending_transfers: 0,
        approved_transfers: 0,
        completed_transfers: 0,
      };
    }

    return {
      pending_transfers: Number(transferSummary.pending),
      approved_transfers: Number(transferSummary.approved),
      completed_transfers: Number(transferSummary.completed),
    };
  }
}
