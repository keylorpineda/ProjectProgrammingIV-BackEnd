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
import { OnModuleInit } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { Resource } from "./entities/resource.entity";
import { Inventory } from "./entities/inventory.entity";
import { InventoryMovement } from "./entities/inventory-movement.entity";
import { DailyProduction } from "./entities/daily-production.entity";
import { DailyConsumption } from "./entities/daily-consumption.entity";
import { AuditLog } from "../common/entities/audit-log.entity";
import { Camp } from "../camps/entities/camp.entity";
import { Person } from "../users/entities/person.entity";
import { CreateResourceDto } from "./dto/create-resource.dto";
import { UpdateResourceDto } from "./dto/update-resource.dto";
import { CreateInventoryMovementDto } from "./dto/create-inventory-movement.dto";
import { AdjustDailyProductionDto } from "./dto/adjust-daily-production.dto";
import { UpdateInventoryDto } from "./dto/update-inventory.dto";
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
    @InjectQueue("daily-tasks") private readonly dailyTasksQueue: Queue,
  ) {}

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
      relations: ["resource"],
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

    return this.inventoryRepo.save(inventory);
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

    return { movement: saved, inventory };
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
        'Recursos de tipo "food" y "water" no configurados. Cree recursos con esas categorías.',
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
          description: `Producción diaria: ${person.first_name} ${person.last_name} (${person.profession.name})`,
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
          description: `Producción de agua: ${person.first_name} ${person.last_name} (${person.profession.name})`,
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
        description: `Consumo diario de comida: ${personsInCamp} personas × ${foodRation} unidades`,
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
        description: `Consumo diario de agua: ${personsInCamp} personas × ${waterRation} litros`,
      });
      consumption["water"] = totalWaterCons;
      movementCount++;
    }

    await this.refreshAlertFlags(campId);

    return { production, consumption, movementCount };
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async executeAllDailyProcesses(): Promise<void> {
    this.logger.log("Iniciando proceso diario automático de recursos...");

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
          `Ajuste manual de producci�n: ${person.first_name} ${person.last_name}`,
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
}
