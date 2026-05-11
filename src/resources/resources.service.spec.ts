import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { BadRequestException, Logger, NotFoundException } from "@nestjs/common";
import { getQueueToken } from "@nestjs/bullmq";
import { ResourcesService } from "./resources.service";
import { Resource } from "./entities/resource.entity";
import { Inventory } from "./entities/inventory.entity";
import { InventoryMovement } from "./entities/inventory-movement.entity";
import { DailyProduction } from "./entities/daily-production.entity";
import { DailyConsumption } from "./entities/daily-consumption.entity";
import { AuditLog } from "../common/entities/audit-log.entity";
import { Camp } from "../camps/entities/camp.entity";
import { Person } from "../users/entities/person.entity";
import { CreateResourceDto } from "./dto/create-resource.dto";
import { UpdateInventoryDto } from "./dto/update-inventory.dto";
import { AdjustDailyProductionDto } from "./dto/adjust-daily-production.dto";
import {
  DAILY_CONSUMPTION,
  PersonStatus,
} from "../users/constants/professions.constants";

const cloneEntity = <T extends Record<string, any>>(value: T): T => ({
  ...value,
});
const asyncPassThrough = async <T>(value: T): Promise<T> => value;

type RepoMock = {
  findAndCount: jest.Mock;
  findOne: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
  remove: jest.Mock;
  find: jest.Mock;
  createQueryBuilder: jest.Mock;
  getMany: jest.Mock;
  getCount: jest.Mock;
};

const createRepoMock = (): RepoMock => ({
  findAndCount: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(cloneEntity),
  save: jest.fn(asyncPassThrough),
  remove: jest.fn(),
  find: jest.fn(),
  createQueryBuilder: jest.fn(),
  getMany: jest.fn(),
  getCount: jest.fn(),
});

describe("ResourcesService", () => {
  let service: ResourcesService;
  let resourceRepo: any;
  let inventoryRepo: any;
  let movementRepo: any;
  let dailyProdRepo: any;
  let dailyConsRepo: any;
  let auditRepo: any;
  let campRepo: any;
  let personRepo: any;

  const mockResource = {
    id: 1,
    name: "Agua",
    unit: "litros",
    category: "water",
    description: "Recurso base",
  } as Resource;

  const mockInventory = {
    camp_id: 1,
    resource_id: 1,
    current_quantity: 10,
    minimum_stock_required: 5,
    alert_active: false,
    last_update: new Date("2026-01-01T00:00:00.000Z"),
  } as Inventory;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResourcesService,
        { provide: getRepositoryToken(Resource), useValue: createRepoMock() },
        { provide: getRepositoryToken(Inventory), useValue: createRepoMock() },
        {
          provide: getRepositoryToken(InventoryMovement),
          useValue: createRepoMock(),
        },
        {
          provide: getRepositoryToken(DailyProduction),
          useValue: createRepoMock(),
        },
        {
          provide: getRepositoryToken(DailyConsumption),
          useValue: createRepoMock(),
        },
        { provide: getRepositoryToken(AuditLog), useValue: createRepoMock() },
        { provide: getRepositoryToken(Camp), useValue: createRepoMock() },
        { provide: getRepositoryToken(Person), useValue: createRepoMock() },
        {
          provide: getQueueToken("daily-tasks"),
          useValue: {
            add: jest.fn().mockResolvedValue({}),
          },
        },
      ],
    }).compile();

    service = module.get(ResourcesService);
    resourceRepo = module.get(getRepositoryToken(Resource));
    inventoryRepo = module.get(getRepositoryToken(Inventory));
    movementRepo = module.get(getRepositoryToken(InventoryMovement));
    dailyProdRepo = module.get(getRepositoryToken(DailyProduction));
    dailyConsRepo = module.get(getRepositoryToken(DailyConsumption));
    auditRepo = module.get(getRepositoryToken(AuditLog));
    campRepo = module.get(getRepositoryToken(Camp));
    personRepo = module.get(getRepositoryToken(Person));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("findAll", () => {
    it("should sanitize pagination and filter by category", async () => {
      resourceRepo.findAndCount!.mockResolvedValue([[mockResource], 1]);

      const result = await service.findAll(0, 999, "water");

      expect(resourceRepo.findAndCount).toHaveBeenCalledWith({
        where: { category: "water" },
        order: { name: "ASC" },
        skip: 0,
        take: 100,
      });
      expect(result).toEqual({
        data: [mockResource],
        total: 1,
        page: 1,
        limit: 100,
        totalPages: 1,
      });
    });

    it("should return pagination without category", async () => {
      resourceRepo.findAndCount!.mockResolvedValue([[mockResource], 3]);

      const result = await service.findAll(2, 2);

      expect(resourceRepo.findAndCount).toHaveBeenCalledWith({
        where: {},
        order: { name: "ASC" },
        skip: 2,
        take: 2,
      });
      expect(result.totalPages).toBe(2);
    });

    it("should use default page and limit when parameters are omitted", async () => {
      resourceRepo.findAndCount!.mockResolvedValue([[mockResource], 1]);

      const result = await service.findAll();

      expect(resourceRepo.findAndCount).toHaveBeenCalledWith({
        where: {},
        order: { name: "ASC" },
        skip: 0,
        take: 20,
      });
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });
  });

  describe("findResourceById", () => {
    it("should return a resource when found", async () => {
      resourceRepo.findOne!.mockResolvedValue(mockResource);

      const result = await service.findResourceById(1);

      expect(resourceRepo.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(result).toBe(mockResource);
    });

    it("should throw when resource does not exist", async () => {
      resourceRepo.findOne!.mockResolvedValue(null);

      await expect(service.findResourceById(99)).rejects.toThrow(
        new NotFoundException("Recurso con ID 99 no encontrado"),
      );
    });
  });

  describe("create", () => {
    it("should create and save a resource", async () => {
      const dto: CreateResourceDto = {
        name: "Comida",
        unit: "kg",
        category: "food",
        description: "Enlatados",
      };
      resourceRepo.create!.mockReturnValue({ ...dto, id: 7 });
      resourceRepo.save!.mockResolvedValue({ ...dto, id: 7 });

      const result = await service.create(dto);

      expect(resourceRepo.create).toHaveBeenCalledWith(dto);
      expect(resourceRepo.save).toHaveBeenCalledWith({ ...dto, id: 7 });
      expect(result).toEqual({ ...dto, id: 7 });
    });
  });

  describe("update", () => {
    it("should update and save a resource", async () => {
      jest.spyOn(service, "findResourceById").mockResolvedValue(mockResource);
      resourceRepo.save!.mockResolvedValue({
        ...mockResource,
        name: "Agua potable",
      });

      const result = await service.update(1, { name: "Agua potable" });

      expect(service.findResourceById).toHaveBeenCalledWith(1);
      expect(resourceRepo.save).toHaveBeenCalledWith({
        ...mockResource,
        name: "Agua potable",
      });
      expect(result.name).toBe("Agua potable");
    });
  });

  describe("remove", () => {
    it("should remove the resource after finding it", async () => {
      jest.spyOn(service, "findResourceById").mockResolvedValue(mockResource);

      await service.remove(1);

      expect(service.findResourceById).toHaveBeenCalledWith(1);
      expect(resourceRepo.remove).toHaveBeenCalledWith(mockResource);
    });
  });

  describe("getInventoryByCamp", () => {
    it("should refresh flags and return inventory with resource relation", async () => {
      const refreshSpy = jest
        .spyOn(service as any, "refreshAlertFlags")
        .mockResolvedValue(undefined);
      inventoryRepo.find!.mockResolvedValue([mockInventory]);

      const result = await service.getInventoryByCamp(1);

      expect(refreshSpy).toHaveBeenCalledWith(1);
      expect(inventoryRepo.find).toHaveBeenCalledWith({
        where: { camp_id: 1 },
        relations: ["resource"],
      });
      expect(result).toEqual([mockInventory]);
    });
  });

  describe("getInventoryAlerts", () => {
    it("should return alerting inventory items", async () => {
      const refreshSpy = jest
        .spyOn(service as any, "refreshAlertFlags")
        .mockResolvedValue(undefined);
      const queryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest
          .fn()
          .mockResolvedValue([{ ...mockInventory, alert_active: true }]),
      };
      inventoryRepo.createQueryBuilder!.mockReturnValue(queryBuilder);

      const result = await service.getInventoryAlerts(2);

      expect(refreshSpy).toHaveBeenCalledWith(2);
      expect(inventoryRepo.createQueryBuilder).toHaveBeenCalledWith("inv");
      expect(queryBuilder.where).toHaveBeenCalledWith("inv.camp_id = :campId", {
        campId: 2,
      });
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        "inv.alert_active = true",
      );
      expect(result).toHaveLength(1);
    });
  });

  describe("updateInventory", () => {
    it("should update an existing inventory record", async () => {
      const dto: UpdateInventoryDto = {
        current_quantity: 3,
        minimum_stock_required: 5,
      };
      inventoryRepo.findOne!.mockResolvedValue({ ...mockInventory });

      const result = await service.updateInventory(1, 1, dto);

      expect(inventoryRepo.findOne).toHaveBeenCalledWith({
        where: { camp_id: 1, resource_id: 1 },
        relations: ["resource"],
      });
      expect(inventoryRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          current_quantity: 3,
          minimum_stock_required: 5,
          alert_active: true,
          last_update: expect.any(Date),
        }),
      );
      expect(result.alert_active).toBe(true);
    });

    it("should create a new inventory record when it does not exist", async () => {
      inventoryRepo.findOne!.mockResolvedValue(null);
      inventoryRepo.create!.mockReturnValue({
        camp_id: 5,
        resource_id: 4,
        current_quantity: 0,
        minimum_stock_required: 0,
      });

      const result = await service.updateInventory(5, 4, {
        current_quantity: 8,
      });

      expect(inventoryRepo.create).toHaveBeenCalledWith({
        camp_id: 5,
        resource_id: 4,
        current_quantity: 0,
        minimum_stock_required: 0,
        last_update: expect.any(Date),
      });
      expect(result.current_quantity).toBe(8);
      expect(result.alert_active).toBe(false);
    });

    it("should keep current quantity when dto does not provide it", async () => {
      inventoryRepo.findOne!.mockResolvedValue({
        ...mockInventory,
        current_quantity: 12,
      });

      const result = await service.updateInventory(1, 1, {
        minimum_stock_required: 20,
      });

      expect(inventoryRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          current_quantity: 12,
          minimum_stock_required: 20,
          alert_active: true,
        }),
      );
      expect(result.current_quantity).toBe(12);
    });
  });

  describe("initializeInventoryForCamp", () => {
    it("should create inventory only for missing resources", async () => {
      const secondResource = {
        ...mockResource,
        id: 2,
        category: "food",
      } as Resource;
      resourceRepo.find!.mockResolvedValue([mockResource, secondResource]);
      inventoryRepo
        .findOne!.mockResolvedValueOnce({ ...mockInventory })
        .mockResolvedValueOnce(null);
      inventoryRepo.create!.mockImplementation(cloneEntity);
      inventoryRepo.save!.mockImplementation(asyncPassThrough);

      const result = await service.initializeInventoryForCamp(9);

      expect(inventoryRepo.findOne).toHaveBeenNthCalledWith(1, {
        where: { camp_id: 9, resource_id: 1 },
      });
      expect(inventoryRepo.findOne).toHaveBeenNthCalledWith(2, {
        where: { camp_id: 9, resource_id: 2 },
      });
      expect(inventoryRepo.create).toHaveBeenCalledWith({
        camp_id: 9,
        resource_id: 2,
        current_quantity: 0,
        minimum_stock_required: 0,
        alert_active: false,
        last_update: expect.any(Date),
      });
      expect(result).toEqual([
        expect.objectContaining({ camp_id: 9, resource_id: 2 }),
      ]);
    });
  });

  describe("getMovementsByCamp", () => {
    it("should return movements ordered by date desc", async () => {
      movementRepo.find!.mockResolvedValue([{ id: 1 } as any]);

      const result = await service.getMovementsByCamp(4, 12);

      expect(movementRepo.find).toHaveBeenCalledWith({
        where: { camp_id: 4 },
        relations: ["resource", "user"],
        order: { date: "DESC" },
        take: 12,
      });
      expect(result).toEqual([{ id: 1 }]);
    });

    it("should use the default movement limit when none is provided", async () => {
      movementRepo.find!.mockResolvedValue([]);

      await service.getMovementsByCamp(8);

      expect(movementRepo.find).toHaveBeenCalledWith({
        where: { camp_id: 8 },
        relations: ["resource", "user"],
        order: { date: "DESC" },
        take: 50,
      });
    });
  });

  describe("createMovement", () => {
    it("should create an income movement and audit log", async () => {
      jest.spyOn(service, "findResourceById").mockResolvedValue(mockResource);
      inventoryRepo.findOne!.mockResolvedValue({
        ...mockInventory,
        current_quantity: 10,
      });
      movementRepo.create!.mockImplementation(cloneEntity);
      movementRepo.save!.mockImplementation(async (value: any) => ({
        id: 55,
        ...value,
      }));
      auditRepo.create!.mockImplementation(cloneEntity);

      const result = await service.createMovement(
        {
          camp_id: 1,
          resource_id: 1,
          quantity: 5,
          type: "income",
          description: "Ingreso",
        },
        3,
      );

      expect(service.findResourceById).toHaveBeenCalledWith(1);
      expect(inventoryRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ current_quantity: 15, alert_active: false }),
      );
      expect(movementRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          camp_id: 1,
          resource_id: 1,
          quantity: 5,
          type: "income",
          user_id: 3,
          date: expect.any(Date),
        }),
      );
      expect(auditRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 3,
          camp_id: 1,
          action: "inventory_movement_income",
          entity_type: "inventory_movement",
          entity_id: 55,
          new_value: {
            resource_id: 1,
            quantity: 5,
            type: "income",
            resulting_quantity: 15,
          },
          date: expect.any(Date),
        }),
      );
      expect(result.movement.id).toBe(55);
      expect(result.inventory.current_quantity).toBe(15);
    });

    it("should create a new inventory and discount quantity for non-income types", async () => {
      jest.spyOn(service, "findResourceById").mockResolvedValue(mockResource);
      inventoryRepo.findOne!.mockResolvedValue(null);
      inventoryRepo.create!.mockImplementation(cloneEntity);
      movementRepo.create!.mockImplementation(cloneEntity);
      movementRepo.save!.mockImplementation(async (value: any) => ({
        id: 77,
        ...value,
      }));
      auditRepo.create!.mockImplementation(cloneEntity);

      const result = await service.createMovement({
        camp_id: 2,
        resource_id: 1,
        quantity: 4,
        type: "daily_consumption",
        description: "Salida",
      });

      expect(inventoryRepo.create).toHaveBeenCalledWith({
        camp_id: 2,
        resource_id: 1,
        current_quantity: 0,
        minimum_stock_required: 0,
      });
      expect(inventoryRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ current_quantity: -4, alert_active: true }),
      );
      expect(result.inventory.current_quantity).toBe(-4);
    });
  });

  describe("executeDailyProcess", () => {
    it("should throw when food or water resources are missing", async () => {
      resourceRepo
        .findOne!.mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ ...mockResource, id: 2 });

      await expect(service.executeDailyProcess(1)).rejects.toThrow(
        new NotFoundException(
          'Recursos de tipo "food" y "water" no configurados. Cree recursos con esas categorias.',
        ),
      );
    });

    it("should process daily production and consumption using defaults and overrides", async () => {
      const foodResource = {
        id: 11,
        category: "food",
        name: "Comida",
      } as Resource;
      const waterResource = {
        id: 12,
        category: "water",
        name: "Agua",
      } as Resource;
      const workerWithConfig = {
        id: 1,
        first_name: "Ana",
        last_name: "Perez",
        can_work: true,
        status: PersonStatus.ACTIVE,
        profession: { id: 5, name: "Recolector" },
      };
      const workerWithoutProduction = {
        id: 2,
        first_name: "Luis",
        last_name: "Diaz",
        can_work: true,
        status: PersonStatus.ACTIVE,
        profession: { id: 6, name: "Guardia" },
      };
      const workersQB = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest
          .fn()
          .mockResolvedValue([workerWithConfig, workerWithoutProduction]),
      };
      const countQB = {
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(4),
      };

      resourceRepo
        .findOne!.mockResolvedValueOnce(foodResource)
        .mockResolvedValueOnce(waterResource);
      personRepo
        .createQueryBuilder!.mockReturnValueOnce(workersQB)
        .mockReturnValueOnce(countQB);
      dailyProdRepo
        .findOne!.mockResolvedValueOnce({ base_production: 20 })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      dailyConsRepo
        .findOne!.mockResolvedValueOnce({ daily_ration: 5 })
        .mockResolvedValueOnce(null);

      const createMovementSpy = jest
        .spyOn(service, "createMovement")
        .mockImplementation(async (dto: any) => ({
          movement: { id: Math.random(), ...dto } as any,
          inventory: {
            camp_id: dto.camp_id,
            resource_id: dto.resource_id,
            current_quantity: dto.quantity,
          } as any,
        }));
      const refreshSpy = jest
        .spyOn(service as any, "refreshAlertFlags")
        .mockResolvedValue(undefined);

      const result = await service.executeDailyProcess(10);

      expect(resourceRepo.findOne).toHaveBeenNthCalledWith(1, {
        where: { category: "food" },
      });
      expect(resourceRepo.findOne).toHaveBeenNthCalledWith(2, {
        where: { category: "water" },
      });
      expect(createMovementSpy).toHaveBeenCalledTimes(3);
      expect(createMovementSpy).toHaveBeenNthCalledWith(1, {
        camp_id: 10,
        resource_id: 11,
        quantity: 20,
        type: "daily_production",
        description: "Produccion diaria: Ana Perez (Recolector)",
      });
      expect(createMovementSpy).toHaveBeenNthCalledWith(2, {
        camp_id: 10,
        resource_id: 11,
        quantity: 20,
        type: "daily_consumption",
        description: "Consumo diario de comida: 4 personas × 5 unidades",
      });
      expect(createMovementSpy).toHaveBeenNthCalledWith(3, {
        camp_id: 10,
        resource_id: 12,
        quantity: 12,
        type: "daily_consumption",
        description: `Consumo diario de agua: 4 personas × ${DAILY_CONSUMPTION.WATER_PER_PERSON} litros`,
      });
      expect(refreshSpy).toHaveBeenCalledWith(10);
      expect(result).toEqual({
        production: { food: 20 },
        consumption: { food: 20, water: 12 },
        movementCount: 3,
      });
    });

    it("should use profession defaults, custom water production and custom water ration", async () => {
      const foodResource = {
        id: 31,
        category: "food",
        name: "Comida",
      } as Resource;
      const waterResource = {
        id: 32,
        category: "water",
        name: "Agua",
      } as Resource;
      const workersQB = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            id: 1,
            first_name: "Rosa",
            last_name: "Campo",
            can_work: true,
            status: PersonStatus.ACTIVE,
            profession: { id: 10, name: "Agricultor" },
          },
        ]),
      };
      const countQB = {
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(2),
      };

      resourceRepo
        .findOne!.mockResolvedValueOnce(foodResource)
        .mockResolvedValueOnce(waterResource);
      personRepo
        .createQueryBuilder!.mockReturnValueOnce(workersQB)
        .mockReturnValueOnce(countQB);
      dailyProdRepo
        .findOne!.mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ base_production: 6 });
      dailyConsRepo
        .findOne!.mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ daily_ration: 4 });

      const createMovementSpy = jest
        .spyOn(service, "createMovement")
        .mockResolvedValue({
          movement: { id: 1 } as any,
          inventory: mockInventory,
        });
      const refreshSpy = jest
        .spyOn(service as any, "refreshAlertFlags")
        .mockResolvedValue(undefined);

      const result = await service.executeDailyProcess(12);

      expect(createMovementSpy).toHaveBeenNthCalledWith(1, {
        camp_id: 12,
        resource_id: 31,
        quantity: 8,
        type: "daily_production",
        description: "Produccion diaria: Rosa Campo (Agricultor)",
      });
      expect(createMovementSpy).toHaveBeenNthCalledWith(2, {
        camp_id: 12,
        resource_id: 32,
        quantity: 6,
        type: "daily_production",
        description: "Produccion de agua: Rosa Campo (Agricultor)",
      });
      expect(createMovementSpy).toHaveBeenNthCalledWith(3, {
        camp_id: 12,
        resource_id: 31,
        quantity: 4,
        type: "daily_consumption",
        description: "Consumo diario de comida: 2 personas × 2 unidades",
      });
      expect(createMovementSpy).toHaveBeenNthCalledWith(4, {
        camp_id: 12,
        resource_id: 32,
        quantity: 8,
        type: "daily_consumption",
        description: "Consumo diario de agua: 2 personas × 4 litros",
      });
      expect(refreshSpy).toHaveBeenCalledWith(12);
      expect(result).toEqual({
        production: { food: 8, water: 6 },
        consumption: { food: 4, water: 8 },
        movementCount: 4,
      });
    });

    it("should default food and water production to zero when profession config is missing", async () => {
      const foodResource = {
        id: 41,
        category: "food",
        name: "Comida",
      } as Resource;
      const waterResource = {
        id: 42,
        category: "water",
        name: "Agua",
      } as Resource;
      const workersQB = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            id: 1,
            first_name: "Nora",
            last_name: "Desconocida",
            can_work: true,
            status: PersonStatus.ACTIVE,
            profession: { id: 11, name: "OficioInventado" },
          },
        ]),
      };
      const countQB = {
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
      };

      resourceRepo
        .findOne!.mockResolvedValueOnce(foodResource)
        .mockResolvedValueOnce(waterResource);
      personRepo
        .createQueryBuilder!.mockReturnValueOnce(workersQB)
        .mockReturnValueOnce(countQB);
      dailyProdRepo
        .findOne!.mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      dailyConsRepo
        .findOne!.mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      const createMovementSpy = jest
        .spyOn(service, "createMovement")
        .mockResolvedValue({
          movement: { id: 1 } as any,
          inventory: mockInventory,
        });
      const refreshSpy = jest
        .spyOn(service as any, "refreshAlertFlags")
        .mockResolvedValue(undefined);

      const result = await service.executeDailyProcess(13);

      expect(createMovementSpy).not.toHaveBeenCalled();
      expect(refreshSpy).toHaveBeenCalledWith(13);
      expect(result).toEqual({
        production: {},
        consumption: {},
        movementCount: 0,
      });
    });

    it("should skip workers without profession and register only water production when applicable", async () => {
      const foodResource = {
        id: 21,
        category: "food",
        name: "Comida",
      } as Resource;
      const waterResource = {
        id: 22,
        category: "water",
        name: "Agua",
      } as Resource;
      const workersQB = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            id: 1,
            first_name: "Sin",
            last_name: "Profesion",
            can_work: true,
            status: PersonStatus.ACTIVE,
            profession: null,
          },
          {
            id: 2,
            first_name: "Mario",
            last_name: "Aguador",
            can_work: true,
            status: PersonStatus.ACTIVE,
            profession: { id: 9, name: "Aguatero" },
          },
        ]),
      };
      const countQB = {
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
      };

      resourceRepo
        .findOne!.mockResolvedValueOnce(foodResource)
        .mockResolvedValueOnce(waterResource);
      personRepo
        .createQueryBuilder!.mockReturnValueOnce(workersQB)
        .mockReturnValueOnce(countQB);
      dailyProdRepo
        .findOne!.mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      dailyConsRepo
        .findOne!.mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      const createMovementSpy = jest
        .spyOn(service, "createMovement")
        .mockResolvedValue({
          movement: { id: 1 } as any,
          inventory: mockInventory,
        });
      const refreshSpy = jest
        .spyOn(service as any, "refreshAlertFlags")
        .mockResolvedValue(undefined);

      const result = await service.executeDailyProcess(11);

      expect(createMovementSpy).toHaveBeenCalledTimes(1);
      expect(createMovementSpy).toHaveBeenCalledWith({
        camp_id: 11,
        resource_id: 22,
        quantity: 15,
        type: "daily_production",
        description: "Produccion de agua: Mario Aguador (Aguatero)",
      });
      expect(refreshSpy).toHaveBeenCalledWith(11);
      expect(result).toEqual({
        production: { water: 15 },
        consumption: {},
        movementCount: 1,
      });
    });
  });

  describe("executeAllDailyProcesses", () => {
    it("should process active camps and log success", async () => {
      const camps = [
        { id: 1, name: "Camp Alpha", active: true },
        { id: 2, name: "Camp Beta", active: true },
      ];
      campRepo.find!.mockResolvedValue(camps);
      jest
        .spyOn(service, "executeDailyProcess")
        .mockResolvedValueOnce({
          production: {},
          consumption: {},
          movementCount: 2,
        })
        .mockResolvedValueOnce({
          production: {},
          consumption: {},
          movementCount: 1,
        });
      const logSpy = jest.spyOn(Logger.prototype, "log").mockImplementation();
      const errorSpy = jest
        .spyOn(Logger.prototype, "error")
        .mockImplementation();

      await service.executeAllDailyProcesses();

      expect(campRepo.find).toHaveBeenCalledWith({ where: { active: true } });
      expect(service.executeDailyProcess).toHaveBeenNthCalledWith(1, 1);
      expect(service.executeDailyProcess).toHaveBeenNthCalledWith(2, 2);
      expect(logSpy).toHaveBeenCalledWith(
        "Iniciando proceso diario automatico de recursos...",
      );
      expect(logSpy).toHaveBeenCalledWith(
        'Camp "Camp Alpha" (1): 2 movimientos procesados',
      );
      expect(logSpy).toHaveBeenCalledWith(
        'Camp "Camp Beta" (2): 1 movimientos procesados',
      );
      expect(logSpy).toHaveBeenCalledWith(
        "Proceso diario finalizado para todos los campamentos",
      );
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it("should log errors and continue when a camp fails", async () => {
      campRepo.find!.mockResolvedValue([
        { id: 5, name: "Camp Gamma", active: true },
      ]);
      jest
        .spyOn(service, "executeDailyProcess")
        .mockRejectedValue(new Error("boom"));
      const errorSpy = jest
        .spyOn(Logger.prototype, "error")
        .mockImplementation();
      jest.spyOn(Logger.prototype, "log").mockImplementation();

      await service.executeAllDailyProcesses();

      expect(errorSpy).toHaveBeenCalledWith("Error en camp 5: boom");
    });

    it("should stringify non-Error values when logging cron failures", async () => {
      campRepo.find!.mockResolvedValue([
        { id: 6, name: "Camp Delta", active: true },
      ]);
      jest
        .spyOn(service, "executeDailyProcess")
        .mockRejectedValue("fallo-string");
      const errorSpy = jest
        .spyOn(Logger.prototype, "error")
        .mockImplementation();
      jest.spyOn(Logger.prototype, "log").mockImplementation();

      await service.executeAllDailyProcesses();

      expect(errorSpy).toHaveBeenCalledWith("Error en camp 6: fallo-string");
    });
  });

  describe("adjustProductionForPerson", () => {
    it("should create a daily production movement using dto camp id", async () => {
      const person = {
        id: 4,
        first_name: "Eva",
        last_name: "Lopez",
        profession: { id: 8, name: "Ingeniero" },
        userAccount: { camp_id: 15 },
      };
      const dto: AdjustDailyProductionDto = {
        camp_id: 20,
        resource_id: 1,
        quantity: 6,
      };
      personRepo.findOne!.mockResolvedValue(person as any);
      jest.spyOn(service, "findResourceById").mockResolvedValue(mockResource);
      const createMovementSpy = jest
        .spyOn(service, "createMovement")
        .mockResolvedValue({
          movement: { id: 9 } as any,
          inventory: mockInventory,
        });

      const result = await service.adjustProductionForPerson(4, dto, 30);

      expect(personRepo.findOne).toHaveBeenCalledWith({
        where: { id: 4 },
        relations: ["profession", "userAccount"],
      });
      expect(service.findResourceById).toHaveBeenCalledWith(1);
      expect(createMovementSpy).toHaveBeenCalledWith(
        {
          camp_id: 20,
          resource_id: 1,
          quantity: 6,
          type: "daily_production",
          description: "Ajuste manual de producci�n: Eva Lopez",
        },
        30,
      );
      expect(result.inventory).toBe(mockInventory);
    });

    it("should use the custom description when provided", async () => {
      personRepo.findOne!.mockResolvedValue({
        id: 4,
        first_name: "Eva",
        last_name: "Lopez",
        profession: { id: 8, name: "Ingeniero" },
        userAccount: { camp_id: 15 },
      } as any);
      jest.spyOn(service, "findResourceById").mockResolvedValue(mockResource);
      const createMovementSpy = jest
        .spyOn(service, "createMovement")
        .mockResolvedValue({
          movement: { id: 9 } as any,
          inventory: mockInventory,
        });

      await service.adjustProductionForPerson(
        4,
        {
          resource_id: 1,
          quantity: 2,
          description: "Produccion extraordinaria",
        },
        31,
      );

      expect(createMovementSpy).toHaveBeenCalledWith(
        {
          camp_id: 15,
          resource_id: 1,
          quantity: 2,
          type: "daily_production",
          description: "Produccion extraordinaria",
        },
        31,
      );
    });

    it("should throw when person does not exist", async () => {
      personRepo.findOne!.mockResolvedValue(null);

      await expect(
        service.adjustProductionForPerson(404, { resource_id: 1, quantity: 1 }),
      ).rejects.toThrow(
        new NotFoundException("Persona con ID 404 no encontrada"),
      );
    });

    it("should throw when camp cannot be determined", async () => {
      personRepo.findOne!.mockResolvedValue({
        id: 4,
        first_name: "Eva",
        last_name: "Lopez",
        profession: { id: 8, name: "Ingeniero" },
        userAccount: null,
      } as any);

      await expect(
        service.adjustProductionForPerson(4, { resource_id: 1, quantity: 2 }),
      ).rejects.toThrow(
        new BadRequestException(
          "No se pudo determinar el campamento. Proporcione camp_id.",
        ),
      );
    });
  });

  describe("refreshAlertFlags", () => {
    it("should toggle alert flags in both update queries", async () => {
      const executeTrue = jest.fn().mockResolvedValue({});
      const executeFalse = jest.fn().mockResolvedValue({});
      const firstBuilder = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: executeTrue,
      };
      const secondBuilder = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: executeFalse,
      };
      inventoryRepo
        .createQueryBuilder!.mockReturnValueOnce(firstBuilder)
        .mockReturnValueOnce(secondBuilder);

      await (service as any).refreshAlertFlags(13);

      expect(firstBuilder.update).toHaveBeenCalledWith(Inventory);
      expect(firstBuilder.set).toHaveBeenCalledWith({ alert_active: true });
      expect(firstBuilder.where).toHaveBeenCalledWith("camp_id = :campId", {
        campId: 13,
      });
      expect(firstBuilder.andWhere).toHaveBeenCalledWith(
        "current_quantity < minimum_stock_required",
      );
      expect(executeTrue).toHaveBeenCalled();

      expect(secondBuilder.update).toHaveBeenCalledWith(Inventory);
      expect(secondBuilder.set).toHaveBeenCalledWith({ alert_active: false });
      expect(secondBuilder.where).toHaveBeenCalledWith("camp_id = :campId", {
        campId: 13,
      });
      expect(secondBuilder.andWhere).toHaveBeenCalledWith(
        "current_quantity >= minimum_stock_required",
      );
      expect(executeFalse).toHaveBeenCalled();
    });
  });
});
