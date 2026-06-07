import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { ResourcesController } from "./resources.controller";
import { ResourcesService } from "./resources.service";
import type { CreateResourceDto } from "./dto/create-resource.dto";
import type { UpdateResourceDto } from "./dto/update-resource.dto";
import type { UpdateInventoryDto } from "./dto/update-inventory.dto";
import type { CreateInventoryMovementDto } from "./dto/create-inventory-movement.dto";
import type { AdjustDailyProductionDto } from "./dto/adjust-daily-production.dto";

describe("ResourcesController", () => {
  let controller: ResourcesController;
  let service: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ResourcesController],
      providers: [
        {
          provide: ResourcesService,
          useValue: {
            getInventoryByCamp: jest.fn(),
            getInventoryAlerts: jest.fn(),
            updateInventory: jest.fn(),
            initializeInventoryForCamp: jest.fn(),
            getMovementsByCamp: jest.fn(),
            createMovement: jest.fn(),
            executeDailyProcess: jest.fn(),
            adjustProductionForPerson: jest.fn(),
            findAll: jest.fn(),
            findResourceById: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<ResourcesController>(ResourcesController);
    service = module.get(ResourcesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  it("should get inventory by camp", async () => {
    const inventory = [{ camp_id: 1, resource_id: 2 }];
    service.getInventoryByCamp.mockResolvedValue(inventory as any);

    const result = await controller.getInventory(1);

    expect(service.getInventoryByCamp).toHaveBeenCalledWith(1);
    expect(result).toEqual(inventory);
  });

  it("should get alerts by camp", async () => {
    const alerts = [{ alert_active: true }];
    service.getInventoryAlerts.mockResolvedValue(alerts as any);

    const result = await controller.getAlerts(3);

    expect(service.getInventoryAlerts).toHaveBeenCalledWith(3);
    expect(result).toEqual(alerts);
  });

  it("should update inventory", async () => {
    const dto: UpdateInventoryDto = {
      current_quantity: 15,
      minimum_stock_required: 10,
    };
    const updated = { camp_id: 1, resource_id: 4, ...dto };
    service.updateInventory.mockResolvedValue(updated as any);

    const result = await controller.updateInventory(1, 4, dto);

    expect(service.updateInventory).toHaveBeenCalledWith(1, 4, dto);
    expect(result).toEqual(updated);
  });

  it("should initialize inventory for a camp", async () => {
    const initialized = [{ camp_id: 1, resource_id: 5 }];
    service.initializeInventoryForCamp.mockResolvedValue(initialized as any);

    const result = await controller.initializeInventory(1);

    expect(service.initializeInventoryForCamp).toHaveBeenCalledWith(1);
    expect(result).toEqual(initialized);
  });

  it("should get movements with parsed limit", async () => {
    const movements = [{ id: 10 }];
    service.getMovementsByCamp.mockResolvedValue(movements as any);

    const result = await controller.getMovements(2, "25");

    expect(service.getMovementsByCamp).toHaveBeenCalledWith(2, 25);
    expect(result).toEqual(movements);
  });

  it("should get movements with default limit", async () => {
    service.getMovementsByCamp.mockResolvedValue([] as any);

    await controller.getMovements(2);

    expect(service.getMovementsByCamp).toHaveBeenCalledWith(2, 50);
  });

  it("should create a movement using current user id", async () => {
    const dto: CreateInventoryMovementDto = {
      camp_id: 1,
      resource_id: 2,
      quantity: 4,
      type: "income",
      description: "Ingreso manual",
    };
    const created = { movement: { id: 1 }, inventory: { current_quantity: 4 } };
    service.createMovement.mockResolvedValue(created as any);

    const result = await controller.createMovement(dto, { userId: 99 });

    expect(service.createMovement).toHaveBeenCalledWith(dto, 99);
    expect(result).toEqual(created);
  });

  it("should create a movement without user id when user is missing", async () => {
    const dto: CreateInventoryMovementDto = {
      camp_id: 1,
      resource_id: 2,
      quantity: 4,
      type: "income",
    };
    service.createMovement.mockResolvedValue({} as any);

    await controller.createMovement(dto, undefined);

    expect(service.createMovement).toHaveBeenCalledWith(dto, undefined);
  });

  it("should trigger the daily process", async () => {
    service.executeDailyProcess.mockResolvedValue({
      production: { food: 10, water: 5 },
      consumption: { food: 8, water: 6 },
      movementCount: 2,
    });

    const result = await controller.triggerDailyProcess(7);

    expect(service.executeDailyProcess).toHaveBeenCalledWith(7);
    expect(result).toEqual({
      message: "Proceso diario ejecutado: 2 movimientos registrados",
      metrics: {
        foodProduced: 10,
        foodConsumed: 8,
        waterProduced: 5,
        waterConsumed: 6,
      },
    });
  });

  it("should adjust daily production for a person", async () => {
    const dto: AdjustDailyProductionDto = {
      camp_id: 1,
      resource_id: 2,
      quantity: 3,
      description: "Ajuste",
    };
    const resultPayload = {
      movement: { id: 20 },
      inventory: { current_quantity: 9 },
    };
    service.adjustProductionForPerson.mockResolvedValue(resultPayload as any);

    const result = await controller.adjustDailyProduction(8, dto, {
      userId: 101,
    });

    expect(service.adjustProductionForPerson).toHaveBeenCalledWith(8, dto, 101);
    expect(result).toEqual(resultPayload);
  });

  it("should find all resources with parsed pagination", async () => {
    const paginated = {
      data: [{ id: 1 }],
      total: 1,
      page: 2,
      limit: 5,
      totalPages: 1,
    };
    service.findAll.mockResolvedValue(paginated as any);

    const result = await controller.findAll("2", "5", "food");

    expect(service.findAll).toHaveBeenCalledWith(2, 5, "food");
    expect(result).toEqual(paginated);
  });

  it("should find all resources using defaults", async () => {
    service.findAll.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0,
    } as any);

    await controller.findAll();

    expect(service.findAll).toHaveBeenCalledWith(1, 20, undefined);
  });

  it("should find a resource by id", async () => {
    const resource = { id: 3, name: "Agua" };
    service.findResourceById.mockResolvedValue(resource as any);

    const result = await controller.findById(3);

    expect(service.findResourceById).toHaveBeenCalledWith(3);
    expect(result).toEqual(resource);
  });

  it("should create a resource", async () => {
    const dto: CreateResourceDto = {
      name: "Agua",
      unit: "litros",
      category: "water",
      description: "Reserva",
    };
    const created = { id: 1, ...dto };
    service.create.mockResolvedValue(created as any);

    const result = await controller.create(dto);

    expect(service.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual(created);
  });

  it("should update a resource", async () => {
    const dto: UpdateResourceDto = {
      name: "Agua potable",
      description: "Actualizado",
    };
    const updated = { id: 1, ...dto };
    service.update.mockResolvedValue(updated as any);

    const result = await controller.update(1, dto);

    expect(service.update).toHaveBeenCalledWith(1, dto);
    expect(result).toEqual(updated);
  });

  it("should remove a resource", async () => {
    service.remove.mockResolvedValue(undefined);

    const result = await controller.remove(6);

    expect(service.remove).toHaveBeenCalledWith(6);
    expect(result).toBeUndefined();
  });
});
