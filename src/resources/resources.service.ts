import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, IsNull } from "typeorm";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { Inject } from "@nestjs/common";
import { REDIS_CLIENT } from "../redis/redis.constants";
import { Redis } from "ioredis";
import type { OnModuleInit } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { Resource } from "./entities/resource.entity";
import { Inventory } from "./entities/inventory.entity";
import { InventoryMovement } from "./entities/inventory-movement.entity";
import { DailyProduction } from "./entities/daily-production.entity";
import { DailyConsumption } from "./entities/daily-consumption.entity";
import { AuditLog } from "../common/entities/audit-log.entity";
import { Camp } from "../camps/entities/camp.entity";
import { Person } from "../users/entities/person.entity";
import { PersonAchievement } from "../users/entities/person-achievement.entity";
import { UserAccount } from "../users/entities/user-account.entity";
import { UserAsset } from "../users/entities/user-asset.entity";
import { Asset } from "../users/entities/asset.entity";
import type { CreateResourceDto } from "./dto/create-resource.dto";
import type { UpdateResourceDto } from "./dto/update-resource.dto";
import type { CreateInventoryMovementDto } from "./dto/create-inventory-movement.dto";
import type { AdjustDailyProductionDto } from "./dto/adjust-daily-production.dto";
import type { UpdateInventoryDto } from "./dto/update-inventory.dto";
import {
  PROFESSIONS_CONFIG,
  DAILY_CONSUMPTION,
  PersonStatus,
} from "../users/constants/professions.constants";

const INCOME_TYPES = [
  "income",
  "daily_production",
  "exploration_in",
  "transfer_in",
];

@Injectable()
export class ResourcesService implements OnModuleInit {
  private readonly logger = new Logger(ResourcesService.name);

  constructor(
    @InjectRepository(Resource)
    private readonly resourceRepo: Repository<Resource>,
    @InjectRepository(Inventory)
    private readonly inventoryRepo: Repository<Inventory>,
    @InjectRepository(InventoryMovement)
    private readonly movementRepo: Repository<InventoryMovement>,
    @InjectRepository(DailyProduction)
    private readonly dailyProdRepo: Repository<DailyProduction>,
    @InjectRepository(DailyConsumption)
    private readonly dailyConsRepo: Repository<DailyConsumption>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    @InjectRepository(Camp)
    private readonly campRepo: Repository<Camp>,
    @InjectRepository(Person)
    private readonly personRepo: Repository<Person>,
    @InjectRepository(PersonAchievement)
    private readonly personAchievementRepo: Repository<PersonAchievement>,
    @InjectRepository(UserAccount)
    private readonly userAccountRepo: Repository<UserAccount>,
    @InjectRepository(UserAsset)
    private readonly userAssetRepo: Repository<UserAsset>,
    @InjectQueue("daily-tasks") private readonly dailyTasksQueue: Queue,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  private async invalidateCampDashboardCache(campId: number): Promise<void> {
    try {
      const keys = await this.redis.keys(`dashboard:metrics:${campId}:*`);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (err) {
      // Ignore cache invalidation errors so main flow doesn't break
    }
  }

  async onModuleInit() {
    this.logger.log("Scheduling daily-resources job...");
    await this.dailyTasksQueue.add(
      "daily-resources",
      {},
      { repeat: { pattern: "0 0 * * *" }, jobId: "daily-resources-job" },
    );
  }

  async findAll(
    page = 1,
    limit = 20,
    category?: string,
  ): Promise<{
    data: Resource[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(Math.max(1, limit), 100);
    const skip = (safePage - 1) * safeLimit;

    const where: any = {};
    if (category) {
      where.category = category;
    }

    const [data, total] = await this.resourceRepo.findAndCount({
      where,
      order: { name: "ASC" },
      skip,
      take: safeLimit,
    });

    return {
      data,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
    };
  }

  async findResourceById(id: number): Promise<Resource> {
    const resource = await this.resourceRepo.findOne({ where: { id } });
    if (!resource) {
      throw new NotFoundException(`Recurso con ID ${id} no encontrado`);
    }
    return resource;
  }

  async create(dto: CreateResourceDto): Promise<Resource> {
    const resource = this.resourceRepo.create(dto);
    return this.resourceRepo.save(resource);
  }

  async update(id: number, dto: UpdateResourceDto): Promise<Resource> {
    const resource = await this.findResourceById(id);
    Object.assign(resource, dto);
    return this.resourceRepo.save(resource);
  }

  async remove(id: number): Promise<void> {
    const resource = await this.findResourceById(id);
    await this.resourceRepo.remove(resource);
  }

  async getInventoryByCamp(campId: number): Promise<Inventory[]> {
    await this.refreshAlertFlags(campId);
    return this.inventoryRepo.find({
      where: { camp_id: campId },
      relations: ["resource", "camp"],
    });
  }

  async getInventoryAlerts(campId: number): Promise<Inventory[]> {
    await this.refreshAlertFlags(campId);
    return this.inventoryRepo
      .createQueryBuilder("inv")
      .leftJoinAndSelect("inv.resource", "resource")
      .where("inv.camp_id = :campId", { campId })
      .andWhere("inv.alert_active = true")
      .getMany();
  }

  async updateInventory(
    campId: number,
    resourceId: number,
    dto: UpdateInventoryDto,
  ): Promise<Inventory> {
    let inventory = await this.inventoryRepo.findOne({
      where: { camp_id: campId, resource_id: resourceId },
      relations: ["resource"],
    });

    if (!inventory) {
      inventory = this.inventoryRepo.create({
        camp_id: campId,
        resource_id: resourceId,
        current_quantity: 0,
        minimum_stock_required: 0,
        last_update: new Date(),
      });
    }

    if (dto.minimum_stock_required !== undefined) {
      inventory.minimum_stock_required = dto.minimum_stock_required;
    }
    if (dto.current_quantity !== undefined) {
      inventory.current_quantity = dto.current_quantity;
    }

    inventory.alert_active =
      Number(inventory.current_quantity) <
      Number(inventory.minimum_stock_required);
    inventory.last_update = new Date();

    const saved = await this.inventoryRepo.save(inventory);
    await this.invalidateCampDashboardCache(campId);
    return saved;
  }

  async initializeInventoryForCamp(campId: number): Promise<Inventory[]> {
    const resources = await this.resourceRepo.find();
    const created: Inventory[] = [];

    for (const resource of resources) {
      const exists = await this.inventoryRepo.findOne({
        where: { camp_id: campId, resource_id: Number(resource.id) },
      });

      if (!exists) {
        const inv = this.inventoryRepo.create({
          camp_id: campId,
          resource_id: Number(resource.id),
          current_quantity: 0,
          minimum_stock_required: 0,
          alert_active: false,
          last_update: new Date(),
        });
        created.push(await this.inventoryRepo.save(inv));
      }
    }

    return created;
  }

  async getMovementsByCamp(
    campId: number,
    limit = 50,
  ): Promise<InventoryMovement[]> {
    return this.movementRepo.find({
      where: { camp_id: campId },
      relations: ["resource", "user"],
      order: { date: "DESC" },
      take: limit,
    });
  }

  async createMovement(
    dto: CreateInventoryMovementDto,
    userId?: number,
  ): Promise<{ movement: InventoryMovement; inventory: Inventory }> {
    await this.findResourceById(dto.resource_id);

    let inventory = await this.inventoryRepo.findOne({
      where: { camp_id: dto.camp_id, resource_id: dto.resource_id },
    });

    // Capture alert state before the movement (for LOGISTICA_PRECISA badge)
    const wasAlertActive = inventory?.alert_active ?? false;
    const wasQuantityAboveZero = inventory
      ? Number(inventory.current_quantity) > 0
      : false;

    if (!inventory) {
      inventory = this.inventoryRepo.create({
        camp_id: dto.camp_id,
        resource_id: dto.resource_id,
        current_quantity: 0,
        minimum_stock_required: 0,
      });
    }

    const isIncome = INCOME_TYPES.includes(dto.type);

    if (isIncome) {
      inventory.current_quantity =
        Number(inventory.current_quantity) + Number(dto.quantity);
    } else {
      inventory.current_quantity =
        Number(inventory.current_quantity) - Number(dto.quantity);
    }

    inventory.alert_active =
      Number(inventory.current_quantity) <
      Number(inventory.minimum_stock_required);
    inventory.last_update = new Date();

    await this.inventoryRepo.save(inventory);

    const movement = this.movementRepo.create({
      camp_id: dto.camp_id,
      resource_id: dto.resource_id,
      quantity: dto.quantity,
      type: dto.type,
      description: dto.description,
      date: new Date(),
      user_id: userId,
    });

    const saved = await this.movementRepo.save(movement);

    await this.auditRepo.save(
      this.auditRepo.create({
        user_id: userId,
        camp_id: dto.camp_id,
        action: `inventory_movement_${dto.type}`,
        entity_type: "inventory_movement",
        entity_id: Number(saved.id),
        new_value: {
          resource_id: dto.resource_id,
          quantity: dto.quantity,
          type: dto.type,
          resulting_quantity: inventory.current_quantity,
        },
        date: new Date(),
      }),
    );

    // Gamification â€” wrapped in try/catch so they never break the main flow
    if (userId) {
      const xpGain = isIncome ? 15 : 5;
      this.grantXp(userId, xpGain).catch((e) =>
        this.logger.warn(`grantXp failed: ${e?.message}`),
      );

      if (dto.type === "income") {
        // PRIMER_SUMINISTRO â€” check after saving; count === 1 means this is the first
        this.movementRepo
          .count({ where: { user_id: userId, type: "income" } })
          .then((count) => {
            if (count === 1) {
              this.grantAchievement(userId, "PRIMER_SUMINISTRO").catch(
                () => {},
              );
            }
          })
          .catch(() => {});
      }

      // LOGISTICA_PRECISA â€” replenished a resource that had an active alert
      // before it hit zero
      if (
        isIncome &&
        wasAlertActive &&
        wasQuantityAboveZero &&
        !inventory.alert_active
      ) {
        this.grantBadgeOnce(
          userId,
          "LOGISTICA_PRECISA",
          "Reabasteciste un recurso crÃ­tico antes de que se agotara por completo.",
        ).catch((e) =>
          this.logger.warn(`grantBadgeOnce failed: ${e?.message}`),
        );
      }
    }

    // Re-fetch movement + inventory with their relations so the response
    // includes user/camp/resource (see docs/ALIGNMENT_SPEC.md P2-6).
    const movementWithRelations = await this.movementRepo.findOne({
      where: { id: saved.id },
      relations: ["resource", "user", "camp"],
    });
    const inventoryWithRelations = await this.inventoryRepo.findOne({
      where: { camp_id: dto.camp_id, resource_id: dto.resource_id },
      relations: ["resource", "camp"],
    });

    await this.invalidateCampDashboardCache(dto.camp_id);

    return {
      movement: movementWithRelations ?? saved,
      inventory: inventoryWithRelations ?? inventory,
    };
  }

  async executeDailyProcess(campId: number): Promise<{
    production: Record<string, number>;
    consumption: Record<string, number>;
    movementCount: number;
  }> {
    const production: Record<string, number> = {};
    const consumption: Record<string, number> = {};
    let movementCount = 0;

    const foodResource = await this.resourceRepo.findOne({
      where: { category: "food" },
    });
    const waterResource = await this.resourceRepo.findOne({
      where: { category: "water" },
    });

    if (!foodResource || !waterResource) {
      throw new NotFoundException(
        'Recursos de tipo "food" y "water" no configurados. Cree recursos con esas categorias.',
      );
    }

    const activeWorkers = await this.personRepo
      .createQueryBuilder("person")
      .leftJoinAndSelect("person.profession", "profession")
      .leftJoin("person.userAccount", "ua")
      .where("ua.camp_id = :campId", { campId })
      .andWhere("person.can_work = :cw", { cw: true })
      .andWhere("person.status = :st", { st: PersonStatus.ACTIVE })
      .getMany();

    for (const person of activeWorkers) {
      if (!person.profession) continue;

      const customFood = await this.dailyProdRepo.findOne({
        where: {
          camp_id: campId,
          profession_id: Number(person.profession.id),
          resource_id: Number(foodResource.id),
        },
      });
      const customWater = await this.dailyProdRepo.findOne({
        where: {
          camp_id: campId,
          profession_id: Number(person.profession.id),
          resource_id: Number(waterResource.id),
        },
      });

      const profConfig = Object.values(PROFESSIONS_CONFIG).find(
        (p) => p.name === person.profession.name,
      );

      const foodProd = customFood
        ? Number(customFood.base_production)
        : (profConfig?.daily_food_production ?? 0);
      const waterProd = customWater
        ? Number(customWater.base_production)
        : (profConfig?.daily_water_production ?? 0);

      if (foodProd > 0) {
        await this.createMovement({
          camp_id: campId,
          resource_id: Number(foodResource.id),
          quantity: foodProd,
          type: "daily_production",
          description: `Produccion diaria: ${person.first_name} ${person.last_name} (${person.profession.name})`,
        });
        production["food"] = (production["food"] || 0) + foodProd;
        movementCount++;
      }

      if (waterProd > 0) {
        await this.createMovement({
          camp_id: campId,
          resource_id: Number(waterResource.id),
          quantity: waterProd,
          type: "daily_production",
          description: `Produccion de agua: ${person.first_name} ${person.last_name} (${person.profession.name})`,
        });
        production["water"] = (production["water"] || 0) + waterProd;
        movementCount++;
      }
    }

    const personsInCamp = await this.personRepo
      .createQueryBuilder("person")
      .leftJoin("person.userAccount", "ua")
      .where("ua.camp_id = :campId", { campId })
      .andWhere("person.status NOT IN (:...ex)", {
        ex: [
          PersonStatus.DECEASED,
          PersonStatus.EXPLORING,
          PersonStatus.TRAVELING,
          PersonStatus.OUT_OF_CAMP,
        ],
      })
      .getCount();

    const generalConsFood = await this.dailyConsRepo.findOne({
      where: {
        camp_id: campId,
        person_id: IsNull(),
        resource_id: Number(foodResource.id),
      },
    });
    const generalConsWater = await this.dailyConsRepo.findOne({
      where: {
        camp_id: campId,
        person_id: IsNull(),
        resource_id: Number(waterResource.id),
      },
    });

    const foodRation = generalConsFood
      ? Number(generalConsFood.daily_ration)
      : DAILY_CONSUMPTION.FOOD_PER_PERSON;
    const waterRation = generalConsWater
      ? Number(generalConsWater.daily_ration)
      : DAILY_CONSUMPTION.WATER_PER_PERSON;

    const totalFoodCons = personsInCamp * foodRation;
    const totalWaterCons = personsInCamp * waterRation;

    if (totalFoodCons > 0) {
      await this.createMovement({
        camp_id: campId,
        resource_id: Number(foodResource.id),
        quantity: totalFoodCons,
        type: "daily_consumption",
        description: `Consumo diario de comida: ${personsInCamp} personas x ${foodRation} unidades`,
      });
      consumption["food"] = totalFoodCons;
      movementCount++;
    }

    if (totalWaterCons > 0) {
      await this.createMovement({
        camp_id: campId,
        resource_id: Number(waterResource.id),
        quantity: totalWaterCons,
        type: "daily_consumption",
        description: `Consumo diario de agua: ${personsInCamp} personas x ${waterRation} litros`,
      });
      consumption["water"] = totalWaterCons;
      movementCount++;
    }

    await this.refreshAlertFlags(campId);

    // PROVEEDOR_CONSISTENTE
    this.checkProveedorConsistente(campId).catch((e) =>
      this.logger.warn(`checkProveedorConsistente failed: ${e?.message}`),
    );

    await this.invalidateCampDashboardCache(campId);

    return { production, consumption, movementCount };
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async executeAllDailyProcesses(): Promise<void> {
    this.logger.log("Iniciando proceso diario automatico de recursos...");

    const camps = await this.campRepo.find({ where: { active: true } });

    for (const camp of camps) {
      try {
        const result = await this.executeDailyProcess(Number(camp.id));
        this.logger.log(
          `Camp "${camp.name}" (${camp.id}): ${result.movementCount} movimientos procesados`,
        );
      } catch (err) {
        this.logger.error(
          `Error en camp ${camp.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    this.logger.log("Proceso diario finalizado para todos los campamentos");
  }

  async adjustProductionForPerson(
    personId: number,
    dto: AdjustDailyProductionDto,
    userId?: number,
  ): Promise<{ movement: InventoryMovement; inventory: Inventory }> {
    const person = await this.personRepo.findOne({
      where: { id: personId },
      relations: ["profession", "userAccount"],
    });

    if (!person) {
      throw new NotFoundException(`Persona con ID ${personId} no encontrada`);
    }

    const campId = dto.camp_id ?? person.userAccount?.camp_id;

    if (!campId) {
      throw new BadRequestException(
        "No se pudo determinar el campamento. Proporcione camp_id.",
      );
    }

    await this.findResourceById(dto.resource_id);

    return this.createMovement(
      {
        camp_id: campId,
        resource_id: dto.resource_id,
        quantity: dto.quantity,
        type: "daily_production",
        description:
          dto.description ||
          `Ajuste manual de produccion: ${person.first_name} ${person.last_name}`,
      },
      userId,
    );
  }

  private async refreshAlertFlags(campId: number): Promise<void> {
    await this.inventoryRepo
      .createQueryBuilder()
      .update(Inventory)
      .set({ alert_active: true })
      .where("camp_id = :campId", { campId })
      .andWhere("current_quantity < minimum_stock_required")
      .execute();

    await this.inventoryRepo
      .createQueryBuilder()
      .update(Inventory)
      .set({ alert_active: false })
      .where("camp_id = :campId", { campId })
      .andWhere("current_quantity >= minimum_stock_required")
      .execute();
  }

  // â”€â”€â”€ Gamification helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  private async grantXp(userId: number, points: number): Promise<void> {
    const user = await this.userAccountRepo.findOne({
      where: { id: userId },
      select: ["id", "person_id"],
    });
    if (!user?.person_id) return;

    const person = await this.personRepo.findOne({
      where: { id: Number(user.person_id) },
    });
    if (!person) return;

    person.experience_points = (person.experience_points ?? 0) + points;

    if (person.experience_points >= 100) {
      person.experience_level =
        (person.experience_level ?? 1) +
        Math.floor(person.experience_points / 100);
      person.experience_points = person.experience_points % 100;
    }

    await this.personRepo.save(person);
  }

  private async grantAchievement(
    userId: number,
    achievementName: string,
  ): Promise<boolean> {
    const user = await this.userAccountRepo.findOne({
      where: { id: userId },
      select: ["id", "person_id"],
    });
    if (!user?.person_id) return false;

    const personId = Number(user.person_id);

    const exists = await this.personAchievementRepo.findOne({
      where: { person_id: personId, achievement_name: achievementName },
    });
    if (exists) return false;

    await this.personAchievementRepo.save(
      this.personAchievementRepo.create({
        person_id: personId,
        achievement_name: achievementName,
        obtained_at: new Date(),
      }),
    );

    this.logger.log(
      `Achievement "${achievementName}" granted to person ${personId}`,
    );
    return true;
  }

  private async grantBadgeOnce(
    userId: number,
    badgeName: string,
    badgeDescription: string,
  ): Promise<void> {
    const assetRepo = this.userAssetRepo.manager.getRepository(Asset);

    let asset = await assetRepo.findOne({
      where: { name: badgeName, asset_type: "badge" },
    });

    if (!asset) {
      asset = await assetRepo.save(
        assetRepo.create({
          name: badgeName,
          description: badgeDescription,
          asset_type: "badge",
          url: "",
          public_id: "",
          rarity: 2,
          active: true,
        }),
      );
    }

    const existing = await this.userAssetRepo.findOne({
      where: {
        user_account_id: userId,
        asset_id: Number(asset.id),
        relation_type: "badge",
      },
    });
    if (existing) return;

    await this.userAssetRepo.save(
      this.userAssetRepo.create({
        user_account_id: userId,
        asset_id: Number(asset.id),
        relation_type: "badge",
        is_displayed: false,
      }),
    );

    this.logger.log(`Badge "${badgeName}" granted to user ${userId}`);
  }

  private async checkProveedorConsistente(campId: number): Promise<void> {
    const alertCount = await this.inventoryRepo.count({
      where: { camp_id: campId, alert_active: true },
    });
    if (alertCount > 0) return;

    const managers = await this.userAccountRepo
      .createQueryBuilder("ua")
      .leftJoinAndSelect("ua.role", "role")
      .where("ua.camp_id = :campId", { campId })
      .andWhere("role.name IN (:...roles)", {
        roles: ["resource_manager"],
      })
      .getMany();

    for (const manager of managers) {
      await this.grantAchievement(
        Number(manager.id),
        "PROVEEDOR_CONSISTENTE",
      ).catch(() => {});
    }
  }

  // â”€â”€â”€ Production ranking â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async getProductionRanking(campId: number): Promise<
    {
      rank: number;
      person_id: number;
      name: string;
      profession: string;
      food_production: number;
      water_production: number;
      total_production: number;
      experience_level: number;
    }[]
  > {
    const workers = await this.personRepo
      .createQueryBuilder("person")
      .leftJoinAndSelect("person.profession", "profession")
      .leftJoin("person.userAccount", "ua")
      .where("ua.camp_id = :campId", { campId })
      .andWhere("person.can_work = :cw", { cw: true })
      .andWhere("person.status = :st", { st: PersonStatus.ACTIVE })
      .getMany();

    const foodResource = await this.resourceRepo.findOne({
      where: { category: "food" },
    });
    const waterResource = await this.resourceRepo.findOne({
      where: { category: "water" },
    });

    const ranked = await Promise.all(
      workers.map(async (person) => {
        const profConfig = Object.values(PROFESSIONS_CONFIG).find(
          (p) => p.name === person.profession?.name,
        );

        const customFood = foodResource
          ? await this.dailyProdRepo.findOne({
              where: {
                camp_id: campId,
                profession_id: Number(person.profession?.id),
                resource_id: Number(foodResource.id),
              },
            })
          : null;

        const customWater = waterResource
          ? await this.dailyProdRepo.findOne({
              where: {
                camp_id: campId,
                profession_id: Number(person.profession?.id),
                resource_id: Number(waterResource.id),
              },
            })
          : null;

        const foodProd = customFood
          ? Number(customFood.base_production)
          : (profConfig?.daily_food_production ?? 0);
        const waterProd = customWater
          ? Number(customWater.base_production)
          : (profConfig?.daily_water_production ?? 0);

        return {
          person_id: Number(person.id),
          name: `${person.first_name} ${person.last_name}`,
          profession: person.profession?.name ?? "Sin profesiÃ³n",
          food_production: foodProd,
          water_production: waterProd,
          total_production: foodProd + waterProd,
          experience_level: person.experience_level ?? 1,
        };
      }),
    );

    return ranked
      .sort((a, b) => b.total_production - a.total_production)
      .map((r, i) => ({ rank: i + 1, ...r }));
  }
}
