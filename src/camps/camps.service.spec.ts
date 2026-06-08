import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import type { Repository } from "typeorm";
import { DataSource } from "typeorm";
import { NotFoundException, BadRequestException } from "@nestjs/common";
import { CampsService } from "./camps.service";
import { Camp } from "./entities/camp.entity";
import { Inventory } from "../resources/entities/inventory.entity";
import { Resource } from "../resources/entities/resource.entity";
import type { CreateCampDto } from "./dto/create-camp.dto";
import type { UpdateCampDto } from "./dto/update-camp.dto";

describe("CampsService", () => {
  let service: CampsService;
  let campRepository: Repository<Camp>;
  let inventoryRepository: Repository<Inventory>;
  let dataSource: DataSource;

  const mockCamp = {
    id: 1,
    name: "Camp Alpha",
    location: "Location 1",
    active: true,
    foundation_date: new Date("2024-01-01"),
  };

  const mockResource = {
    id: 1,
    name: "Tent",
    unit: "pieces",
  };

  const mockInventory = {
    id: 1,
    camp_id: 1,
    resource_id: 1,
    current_quantity: 0,
    minimum_stock_required: 0,
    alert_active: false,
    resource: mockResource,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CampsService,
        {
          provide: getRepositoryToken(Camp),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Inventory),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Resource),
          useValue: {
            find: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: {
            createQueryRunner: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<CampsService>(CampsService);
    campRepository = module.get<Repository<Camp>>(getRepositoryToken(Camp));
    inventoryRepository = module.get<Repository<Inventory>>(
      getRepositoryToken(Inventory),
    );
    dataSource = module.get<DataSource>(DataSource);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("create", () => {
    it("should create a camp with default foundation_date", async () => {
      const createDto: CreateCampDto = {
        name: "New Camp",
        location_description: "New Location",
      };

      const mockQueryRunner = {
        connect: jest.fn(),
        startTransaction: jest.fn(),
        manager: {
          create: jest.fn().mockReturnValue(mockCamp),
          save: jest.fn().mockResolvedValue(mockCamp),
          find: jest.fn().mockResolvedValue([]),
        },
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
      };

      jest
        .spyOn(dataSource, "createQueryRunner")
        .mockReturnValue(mockQueryRunner as any);

      const result = await service.create(createDto);

      expect(mockQueryRunner.manager.create).toHaveBeenCalledWith(Camp, {
        ...createDto,
        active: true,
        foundation_date: expect.any(Date),
      });
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(result).toEqual(mockCamp);
    });

    it("should create a camp with provided foundation_date", async () => {
      const foundationDate = new Date("2024-06-01");
      const createDto: CreateCampDto = {
        name: "New Camp",
        location_description: "New Location",
        foundation_date: foundationDate.toISOString(),
      };

      const mockQueryRunner = {
        connect: jest.fn(),
        startTransaction: jest.fn(),
        manager: {
          create: jest.fn().mockReturnValue(mockCamp),
          save: jest.fn().mockResolvedValue(mockCamp),
          find: jest.fn().mockResolvedValue([]),
        },
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
      };

      jest
        .spyOn(dataSource, "createQueryRunner")
        .mockReturnValue(mockQueryRunner as any);

      const result = await service.create(createDto);

      expect(mockQueryRunner.manager.create).toHaveBeenCalledWith(Camp, {
        ...createDto,
        active: true,
        foundation_date: expect.any(Date),
      });
      expect(result).toEqual(mockCamp);
    });

    it("should initialize inventory for each resource", async () => {
      const createDto: CreateCampDto = {
        name: "New Camp",
        location_description: "New Location",
      };

      const mockQueryRunner = {
        connect: jest.fn(),
        startTransaction: jest.fn(),
        manager: {
          create: jest
            .fn()
            .mockReturnValueOnce(mockCamp)
            .mockReturnValueOnce(mockInventory)
            .mockReturnValueOnce(mockInventory),
          save: jest.fn().mockResolvedValue(mockCamp),
          find: jest.fn().mockResolvedValue([mockResource]),
        },
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
      };

      jest
        .spyOn(dataSource, "createQueryRunner")
        .mockReturnValue(mockQueryRunner as any);

      const result = await service.create(createDto);

      expect(mockQueryRunner.manager.find).toHaveBeenCalledWith(Resource);
      expect(mockQueryRunner.manager.create).toHaveBeenCalledWith(
        Inventory,
        expect.objectContaining({
          camp_id: expect.any(Number),
          resource_id: expect.any(Number),
          current_quantity: 0,
          minimum_stock_required: 0,
          alert_active: false,
        }),
      );
      expect(result).toEqual(mockCamp);
    });

    it("should not initialize inventory if no resources exist", async () => {
      const createDto: CreateCampDto = {
        name: "New Camp",
        location_description: "New Location",
      };

      const mockQueryRunner = {
        connect: jest.fn(),
        startTransaction: jest.fn(),
        manager: {
          create: jest.fn().mockReturnValue(mockCamp),
          save: jest.fn().mockResolvedValue(mockCamp),
          find: jest.fn().mockResolvedValue([]),
        },
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
      };

      jest
        .spyOn(dataSource, "createQueryRunner")
        .mockReturnValue(mockQueryRunner as any);

      const result = await service.create(createDto);

      expect(mockQueryRunner.manager.find).toHaveBeenCalledWith(Resource);
      expect(result).toEqual(mockCamp);
    });

    it("should rollback transaction on error", async () => {
      const createDto: CreateCampDto = {
        name: "New Camp",
        location_description: "New Location",
      };

      const mockQueryRunner = {
        connect: jest.fn(),
        startTransaction: jest.fn(),
        manager: {
          create: jest.fn().mockImplementation(() => {
            throw new Error("Creation error");
          }),
          save: jest.fn(),
          find: jest.fn(),
        },
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
      };

      jest
        .spyOn(dataSource, "createQueryRunner")
        .mockReturnValue(mockQueryRunner as any);

      await expect(service.create(createDto)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it("should release query runner in finally block", async () => {
      const createDto: CreateCampDto = {
        name: "New Camp",
        location_description: "New Location",
      };

      const mockQueryRunner = {
        connect: jest.fn(),
        startTransaction: jest.fn(),
        manager: {
          create: jest.fn().mockReturnValue(mockCamp),
          save: jest.fn().mockResolvedValue(mockCamp),
          find: jest.fn().mockResolvedValue([]),
        },
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
      };

      jest
        .spyOn(dataSource, "createQueryRunner")
        .mockReturnValue(mockQueryRunner as any);

      await service.create(createDto);

      expect(mockQueryRunner.release).toHaveBeenCalled();
    });
  });

  describe("findAll", () => {
    it("should return all active camps ordered by id", async () => {
      const camps = [mockCamp];
      jest.spyOn(campRepository, "find").mockResolvedValue(camps as any);

      const result = await service.findAll();

      expect(campRepository.find).toHaveBeenCalledWith({
        where: { active: true },
        order: { id: "ASC" },
      });
      expect(result).toEqual(camps);
    });

    it("should return empty array if no active camps", async () => {
      jest.spyOn(campRepository, "find").mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  describe("findOne", () => {
    it("should return camp with metrics and inventory summary", async () => {
      const mockInventoryList = [
        {
          ...mockInventory,
          resource: { name: "Tent", unit: "pieces" },
          alert_active: false,
        },
      ];

      jest.spyOn(campRepository, "findOne").mockResolvedValue(mockCamp as any);
      jest
        .spyOn(inventoryRepository, "find")
        .mockResolvedValue(mockInventoryList as any);

      const result = await service.findOne(1);

      expect(campRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1, active: true },
      });
      expect(inventoryRepository.find).toHaveBeenCalledWith({
        where: { camp_id: 1 },
        relations: ["resource"],
        order: { resource_id: "ASC" },
      });
      expect(result.camp).toEqual(mockCamp);
      expect(result.metrics.totalResources).toBe(1);
      expect(result.metrics.resourcesWithAlerts).toBe(0);
    });

    it("should throw NotFoundException if camp not active", async () => {
      jest.spyOn(campRepository, "findOne").mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });

    it("should calculate resourcesWithAlerts correctly", async () => {
      const mockInventoryWithAlerts = [
        {
          ...mockInventory,
          alert_active: true,
          resource: { name: "Tent", unit: "pieces" },
        },
        {
          ...mockInventory,
          id: 2,
          alert_active: false,
          resource: { name: "Sleeping Bag", unit: "pieces" },
        },
      ];

      jest.spyOn(campRepository, "findOne").mockResolvedValue(mockCamp as any);
      jest
        .spyOn(inventoryRepository, "find")
        .mockResolvedValue(mockInventoryWithAlerts as any);

      const result = await service.findOne(1);

      expect(result.metrics.resourcesWithAlerts).toBe(1);
    });

    it("should handle missing resource in inventory", async () => {
      const inventoryWithoutResource = {
        ...mockInventory,
        resource: null,
      };

      jest.spyOn(campRepository, "findOne").mockResolvedValue(mockCamp as any);
      jest
        .spyOn(inventoryRepository, "find")
        .mockResolvedValue([inventoryWithoutResource] as any);

      const result = await service.findOne(1);

      expect(result.metrics.inventorySummary[0].resource).toBe("Desconocido");
      expect(result.metrics.inventorySummary[0].unit).toBe("");
    });
  });

  describe("update", () => {
    it("should update camp with new data", async () => {
      const updateDto: UpdateCampDto = {
        name: "Updated Camp",
        location_description: "Updated Location",
      };

      const updatedCamp = { ...mockCamp, ...updateDto };

      jest.spyOn(campRepository, "findOne").mockResolvedValue(mockCamp as any);
      jest.spyOn(campRepository, "save").mockResolvedValue(updatedCamp as any);

      const result = await service.update(1, updateDto);

      expect(campRepository.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(result).toEqual(updatedCamp);
    });

    it("should update foundation_date if provided", async () => {
      const newDate = new Date("2024-12-25");
      const updateDto: UpdateCampDto = {
        foundation_date: newDate.toISOString(),
      };

      jest.spyOn(campRepository, "findOne").mockResolvedValue(mockCamp as any);
      jest.spyOn(campRepository, "save").mockResolvedValue(mockCamp as any);

      await service.update(1, updateDto);

      expect(campRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 1,
          foundation_date: expect.any(Date),
        }),
      );
    });

    it("should keep existing foundation_date if not provided", async () => {
      const updateDto: UpdateCampDto = {
        name: "Updated Camp",
      };

      jest.spyOn(campRepository, "findOne").mockResolvedValue(mockCamp as any);
      jest.spyOn(campRepository, "save").mockResolvedValue(mockCamp as any);

      await service.update(1, updateDto);

      expect(campRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          foundation_date: mockCamp.foundation_date,
        }),
      );
    });

    it("should throw NotFoundException if camp not found", async () => {
      jest.spyOn(campRepository, "findOne").mockResolvedValue(null);

      const updateDto: UpdateCampDto = {
        name: "Updated Camp",
      };

      await expect(service.update(999, updateDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("remove", () => {
    it("should soft delete camp by setting active to false", async () => {
      jest.spyOn(campRepository, "findOne").mockResolvedValue(mockCamp as any);
      jest.spyOn(campRepository, "save").mockResolvedValue(mockCamp as any);

      const result = await service.remove(1);

      expect(campRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1, active: true },
      });
      expect(result).toEqual({
        message: `Campamento "${mockCamp.name}" desactivado correctamente`,
      });
    });

    it("should throw NotFoundException if camp not found", async () => {
      jest.spyOn(campRepository, "findOne").mockResolvedValue(null);

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });

    it("should throw NotFoundException if camp already inactive", async () => {
      jest.spyOn(campRepository, "findOne").mockResolvedValue(null);

      await expect(service.remove(1)).rejects.toThrow(NotFoundException);
    });
  });
});
