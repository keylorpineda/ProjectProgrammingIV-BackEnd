import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { ResourcesService } from "./resources.service";
import { getRepositoryToken } from "@nestjs/typeorm";
import type { Queue } from "bullmq";
import { getQueueToken } from "@nestjs/bullmq";
import { NotFoundException, BadRequestException } from "@nestjs/common";
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
import { REDIS_CLIENT } from "../redis/redis.constants";
import { NotificationsGateway } from "../notifications/notifications.gateway";

describe("ResourcesService", () => {
  let service: ResourcesService;
  let mockQueue: jest.Mocked<Queue>;

  const mockRepo = () => ({
    find: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    create: jest.fn().mockImplementation((dto) => dto),
    save: jest
      .fn()
      .mockImplementation((ent) => Promise.resolve({ id: 1, ...ent })),
    remove: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn(),
    manager: { getRepository: jest.fn() },
  });

  beforeEach(async () => {
    mockQueue = {
      add: jest.fn().mockResolvedValue({ id: "job-1" }),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResourcesService,
        { provide: getRepositoryToken(Resource), useFactory: mockRepo },
        { provide: getRepositoryToken(Inventory), useFactory: mockRepo },
        {
          provide: getRepositoryToken(InventoryMovement),
          useFactory: mockRepo,
        },
        { provide: getRepositoryToken(DailyProduction), useFactory: mockRepo },
        { provide: getRepositoryToken(DailyConsumption), useFactory: mockRepo },
        { provide: getRepositoryToken(AuditLog), useFactory: mockRepo },
        { provide: getRepositoryToken(Camp), useFactory: mockRepo },
        { provide: getRepositoryToken(Person), useFactory: mockRepo },
        {
          provide: getRepositoryToken(PersonAchievement),
          useFactory: mockRepo,
        },
        { provide: getRepositoryToken(UserAccount), useFactory: mockRepo },
        { provide: getRepositoryToken(UserAsset), useFactory: mockRepo },
        { provide: getQueueToken("daily-tasks"), useValue: mockQueue },
        {
          provide: REDIS_CLIENT,
          useValue: { keys: jest.fn().mockResolvedValue([]), del: jest.fn() },
        },
        {
          provide: NotificationsGateway,
          useValue: {
            emitInventoryAlerts: jest.fn(),
            emitAlertCleared: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ResourcesService>(ResourcesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("onModuleInit", () => {
    it("should schedule daily-resources job", async () => {
      await service.onModuleInit();
      expect(mockQueue.add).toHaveBeenCalledWith(
        "daily-resources",
        {},
        { repeat: { pattern: "0 0 * * *" }, jobId: "daily-resources-job" },
      );
    });
  });

  describe("findAll", () => {
    it("should return paginated resources", async () => {
      const repo = service["resourceRepo"] as any;
      repo.findAndCount.mockResolvedValue([[{ id: 1 }], 1]);
      const res = await service.findAll(1, 10);
      expect(res.data).toHaveLength(1);
      expect(res.total).toBe(1);
      expect(res.page).toBe(1);
    });

    it("should filter by category", async () => {
      const repo = service["resourceRepo"] as any;
      repo.findAndCount.mockResolvedValue([[], 0]);
      await service.findAll(1, 10, "food");
      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: { category: "food" } }),
      );
    });
  });

  describe("findResourceById", () => {
    it("should return resource if found", async () => {
      const repo = service["resourceRepo"] as any;
      repo.findOne.mockResolvedValue({ id: 1 });
      expect(await service.findResourceById(1)).toEqual({ id: 1 });
    });

    it("should throw NotFoundException if not found", async () => {
      const repo = service["resourceRepo"] as any;
      repo.findOne.mockResolvedValue(null);
      await expect(service.findResourceById(1)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("create, update, remove", () => {
    it("should create", async () => {
      const repo = service["resourceRepo"] as any;
      repo.save.mockResolvedValue({ id: 1, name: "Test" });
      const res = await service.create({
        name: "Test",
        category: "food",
        unit: "kg",
      });
      expect(res.name).toBe("Test");
    });

    it("should update", async () => {
      const repo = service["resourceRepo"] as any;
      repo.findOne.mockResolvedValue({ id: 1, name: "Old" });
      repo.save.mockResolvedValue({ id: 1, name: "New" });
      const res = await service.update(1, { name: "New" });
      expect(res.name).toBe("New");
    });

    it("should remove", async () => {
      const repo = service["resourceRepo"] as any;
      repo.findOne.mockResolvedValue({ id: 1 });
      repo.remove.mockResolvedValue({ id: 1 });
      await service.remove(1);
      expect(repo.remove).toHaveBeenCalled();
    });
  });

  describe("getInventoryByCamp and Alerts", () => {
    beforeEach(() => {
      // Mock refreshAlertFlags
      const inventoryRepo = service["inventoryRepo"] as any;
      inventoryRepo.createQueryBuilder.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue(true),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([{ id: 1, alert_active: true }]),
      });
    });

    it("should get inventory by camp", async () => {
      const repo = service["inventoryRepo"] as any;
      repo.find.mockResolvedValue([{ id: 1 }]);
      const res = await service.getInventoryByCamp(1);
      expect(res).toHaveLength(1);
    });

    it("should get inventory alerts", async () => {
      const res = await service.getInventoryAlerts(1);
      expect(res).toHaveLength(1);
    });
  });

  describe("updateInventory", () => {
    it("should update existing inventory", async () => {
      const repo = service["inventoryRepo"] as any;
      repo.findOne.mockResolvedValue({
        id: 1,
        current_quantity: 0,
        minimum_stock_required: 0,
      });
      repo.save.mockImplementation((ent: any) => Promise.resolve(ent));
      const res = await service.updateInventory(1, 1, {
        current_quantity: 10,
        minimum_stock_required: 5,
      });
      expect(res.alert_active).toBe(false);
      expect(res.current_quantity).toBe(10);
    });

    it("should create if not exists", async () => {
      const repo = service["inventoryRepo"] as any;
      repo.findOne.mockResolvedValue(null);
      repo.save.mockImplementation((ent: any) => Promise.resolve(ent));
      const res = await service.updateInventory(1, 1, {
        current_quantity: 2,
        minimum_stock_required: 5,
      });
      expect(res.alert_active).toBe(true);
    });
  });

  describe("initializeInventoryForCamp", () => {
    it("should initialize for camp", async () => {
      const resourceRepo = service["resourceRepo"] as any;
      const invRepo = service["inventoryRepo"] as any;
      resourceRepo.find.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      invRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 2 }); // one not exists, one exists
      invRepo.save.mockResolvedValue({ id: 99 });
      const res = await service.initializeInventoryForCamp(1);
      expect(res).toHaveLength(1); // only the missing one was created
    });
  });

  describe("getMovementsByCamp", () => {
    it("should return movements", async () => {
      const repo = service["movementRepo"] as any;
      repo.find.mockResolvedValue([{ id: 1 }]);
      const res = await service.getMovementsByCamp(1);
      expect(res).toHaveLength(1);
    });
  });

  describe("createMovement", () => {
    beforeEach(() => {
      const resourceRepo = service["resourceRepo"] as any;
      resourceRepo.findOne.mockResolvedValue({ id: 1 }); // resource exists
      const invRepo = service["inventoryRepo"] as any;
      invRepo.findOne.mockResolvedValue({
        current_quantity: 10,
        minimum_stock_required: 5,
      });
      const userAccountRepo = service["userAccountRepo"] as any;
      userAccountRepo.findOne.mockResolvedValue({ id: 1, person_id: 1 });
      const personRepo = service["personRepo"] as any;
      personRepo.findOne.mockResolvedValue({
        id: 1,
        experience_points: 90,
        experience_level: 1,
      });
      const movementRepo = service["movementRepo"] as any;
      movementRepo.count.mockResolvedValue(1); // for PRIMER_SUMINISTRO
    });

    it("should create an income movement", async () => {
      const res = await service.createMovement(
        {
          camp_id: 1,
          resource_id: 1,
          type: "income",
          quantity: 5,
          description: "test",
        },
        1,
      );
      expect(res.movement).toBeDefined();
      expect(res.inventory.current_quantity).toBe(15);
    });

    it("should create an outcome movement", async () => {
      const res = await service.createMovement(
        {
          camp_id: 1,
          resource_id: 1,
          type: "consumption",
          quantity: 5,
          description: "test",
        },
        1,
      );
      expect(res.inventory.current_quantity).toBe(5);
    });

    it("should trigger level up if xp exceeds 100", async () => {
      const personRepo = service["personRepo"] as any;
      personRepo.findOne.mockResolvedValue({
        id: 1,
        experience_points: 95,
        experience_level: 1,
      });
      await service.createMovement(
        { camp_id: 1, resource_id: 1, type: "income", quantity: 5 },
        1,
      );
      expect(personRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ experience_level: 2, experience_points: 10 }),
      );
    });

    it("should grant LOGISTICA_PRECISA if replenishing active alert before zero", async () => {
      const invRepo = service["inventoryRepo"] as any;
      invRepo.findOne.mockResolvedValue({
        current_quantity: 2,
        minimum_stock_required: 5,
        alert_active: true,
      });
      const assetRepo = service["userAssetRepo"] as any;
      assetRepo.manager.getRepository.mockReturnValue({
        findOne: jest.fn().mockResolvedValue(null),
        save: jest.fn().mockResolvedValue({ id: 99 }),
        create: jest.fn().mockReturnValue({ id: 99 }),
      });
      assetRepo.findOne.mockResolvedValue(null);
      await service.createMovement(
        { camp_id: 1, resource_id: 1, type: "income", quantity: 10 },
        1,
      );
      expect(assetRepo.save).toHaveBeenCalled();
    });

    describe("transactional variant (EntityManager provided)", () => {
      const makeManager = (overrides: Record<string, any> = {}) => {
        const inventory =
          overrides.inventory === undefined
            ? { current_quantity: 10, minimum_stock_required: 5 }
            : overrides.inventory;
        return {
          findOne: jest.fn((entity: any) => {
            if (entity === Resource) {
              return Promise.resolve(
                overrides.resource === undefined
                  ? { id: 1 }
                  : overrides.resource,
              );
            }
            if (entity === Inventory) {
              return Promise.resolve(inventory);
            }
            return Promise.resolve(null);
          }),
          create: jest.fn((_entity: any, dto: any) => dto),
          save: jest.fn((_entity: any, dto: any) =>
            Promise.resolve({ id: 7, ...dto }),
          ),
        } as any;
      };

      it("subtracts within the transaction for an outcome movement and locks the row", async () => {
        const manager = makeManager();
        const res = await service.createMovement(
          {
            camp_id: 1,
            resource_id: 1,
            type: "exploration_out",
            quantity: 4,
          },
          9,
          manager,
        );
        expect(manager.findOne).toHaveBeenCalledWith(
          Inventory,
          expect.objectContaining({ lock: { mode: "pessimistic_write" } }),
        );
        expect(res.inventory.current_quantity).toBe(6);
        // inventory + movement + audit all saved through the same manager
        expect(manager.save).toHaveBeenCalledTimes(3);
      });

      it("adds within the transaction for an income movement", async () => {
        const manager = makeManager();
        const res = await service.createMovement(
          { camp_id: 1, resource_id: 1, type: "exploration_in", quantity: 5 },
          9,
          manager,
        );
        expect(res.inventory.current_quantity).toBe(15);
      });

      it("creates a fresh inventory row when none exists", async () => {
        const manager = makeManager({ inventory: null });
        const res = await service.createMovement(
          { camp_id: 1, resource_id: 1, type: "exploration_out", quantity: 3 },
          9,
          manager,
        );
        expect(manager.create).toHaveBeenCalledWith(
          Inventory,
          expect.objectContaining({ camp_id: 1, resource_id: 1 }),
        );
        expect(res.inventory.current_quantity).toBe(-3);
      });

      it("throws when the resource does not exist", async () => {
        const manager = makeManager({ resource: null });
        await expect(
          service.createMovement(
            {
              camp_id: 1,
              resource_id: 999,
              type: "exploration_out",
              quantity: 1,
            },
            9,
            manager,
          ),
        ).rejects.toThrow(NotFoundException);
      });
    });
  });

  describe("executeDailyProcess", () => {
    it("should throw if food or water resources are missing", async () => {
      const resourceRepo = service["resourceRepo"] as any;
      resourceRepo.findOne.mockResolvedValue(null);
      await expect(service.executeDailyProcess(1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should calculate production and consumption properly", async () => {
      const resourceRepo = service["resourceRepo"] as any;
      resourceRepo.findOne.mockImplementation(
        ({ where: { id, category } }: any) => {
          if (category === "food" || id === 1)
            return Promise.resolve({ id: 1, category: "food" });
          if (category === "water" || id === 2)
            return Promise.resolve({ id: 2, category: "water" });
          return Promise.resolve(null);
        },
      );
      jest.spyOn(service, "createMovement").mockResolvedValue({} as any);

      const personRepo = service["personRepo"] as any;
      personRepo.createQueryBuilder.mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            id: 1,
            first_name: "A",
            last_name: "B",
            profession: { id: 1, name: "Recolector / Scavenger" },
          },
          {
            id: 2,
            first_name: "C",
            last_name: "D",
            profession: { id: 2, name: "Ingeniero de Agua" },
          },
        ]),
        getCount: jest.fn().mockResolvedValue(5),
      });

      const dailyProdRepo = service["dailyProdRepo"] as any;
      dailyProdRepo.findOne.mockResolvedValue({ base_production: 10 });

      const dailyConsRepo = service["dailyConsRepo"] as any;
      dailyConsRepo.findOne.mockResolvedValue({ daily_ration: 5 });

      const invRepo = service["inventoryRepo"] as any;
      invRepo.createQueryBuilder.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue(true),
      });
      invRepo.count.mockResolvedValue(0); // 0 alerts for PROVEEDOR_CONSISTENTE

      const uaRepo = service["userAccountRepo"] as any;
      uaRepo.createQueryBuilder.mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([{ id: 1 }]),
      });

      const res = await service.executeDailyProcess(1);
      expect(res.movementCount).toBeGreaterThan(0);
      expect(res.production.food).toBeGreaterThan(0);
      expect(res.consumption.food).toBeGreaterThan(0);
    });
  });

  describe("executeAllDailyProcesses", () => {
    it("should execute for all camps", async () => {
      const campRepo = service["campRepo"] as any;
      campRepo.find.mockResolvedValue([{ id: 1, name: "Camp" }]);
      jest.spyOn(service, "executeDailyProcess").mockResolvedValue({
        production: {},
        consumption: {},
        movementCount: 0,
      });
      await service.executeAllDailyProcesses();
      expect(service.executeDailyProcess).toHaveBeenCalledWith(1);
    });

    it("should catch errors from executeDailyProcess and continue", async () => {
      const campRepo = service["campRepo"] as any;
      campRepo.find.mockResolvedValue([
        { id: 1, name: "Camp" },
        { id: 2, name: "Camp2" },
      ]);
      jest
        .spyOn(service, "executeDailyProcess")
        .mockRejectedValueOnce(new Error("err"))
        .mockResolvedValueOnce({
          production: {},
          consumption: {},
          movementCount: 0,
        });
      await service.executeAllDailyProcesses();
      expect(service.executeDailyProcess).toHaveBeenCalledTimes(2);
    });
  });

  describe("adjustProductionForPerson", () => {
    it("should adjust production", async () => {
      const personRepo = service["personRepo"] as any;
      personRepo.findOne.mockResolvedValue({
        id: 1,
        first_name: "A",
        userAccount: { camp_id: 1 },
      });
      const resourceRepo = service["resourceRepo"] as any;
      resourceRepo.findOne.mockResolvedValue({ id: 1 });
      jest
        .spyOn(service, "createMovement")
        .mockResolvedValue({ movement: { id: 1 } } as any);
      const res = await service.adjustProductionForPerson(1, {
        resource_id: 1,
        quantity: 5,
        camp_id: 1,
      });
      expect(res).toBeDefined();
    });

    it("should throw if person not found", async () => {
      const personRepo = service["personRepo"] as any;
      personRepo.findOne.mockResolvedValue(null);
      await expect(
        service.adjustProductionForPerson(1, { resource_id: 1, quantity: 5 }),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw if camp_id not defined", async () => {
      const personRepo = service["personRepo"] as any;
      personRepo.findOne.mockResolvedValue({ id: 1, userAccount: null });
      await expect(
        service.adjustProductionForPerson(1, { resource_id: 1, quantity: 5 }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("getProductionRanking", () => {
    it("should return sorted ranking", async () => {
      const personRepo = service["personRepo"] as any;
      personRepo.createQueryBuilder.mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            id: 1,
            first_name: "A",
            profession: { name: "Recolector / Scavenger" },
          },
          { id: 2, first_name: "B", profession: { name: "Medico" } },
        ]),
      });

      const resourceRepo = service["resourceRepo"] as any;
      resourceRepo.findOne
        .mockResolvedValueOnce({ id: 1 })
        .mockResolvedValueOnce({ id: 2 });

      const dailyProdRepo = service["dailyProdRepo"] as any;
      dailyProdRepo.findOne.mockResolvedValue(null);

      const res = await service.getProductionRanking(1);
      expect(res).toHaveLength(2);
      expect(res[0].rank).toBe(1);
    });
  });
});
