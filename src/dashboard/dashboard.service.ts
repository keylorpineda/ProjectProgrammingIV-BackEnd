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
    @InjectRepository(PersonProfessionStatsView)
    private readonly professionStatsView: Repository<PersonProfessionStatsView>,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async getMetricsByCamp(
    campId: number,
    role: string,
  ): Promise<DashboardMetricsResponse> {
    const cacheKey = `dashboard:metrics:${campId}:${role}`;
    const cachedMetrics = await this.cacheManager.get<DashboardMetricsResponse>(cacheKey);

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

    await this.cacheManager.set(cacheKey, metrics);

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
