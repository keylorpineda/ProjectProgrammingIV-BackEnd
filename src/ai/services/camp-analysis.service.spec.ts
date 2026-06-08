import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { CampAnalysisService } from "./camp-analysis.service";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Camp } from "../../camps/entities/camp.entity";
import { ProductionService } from "../../users/services/production.service";
import { ProfessionsService } from "../../users/services/professions.service";
import { PersonsService } from "../../users/services/persons.service";

describe("CampAnalysisService", () => {
  let service: CampAnalysisService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CampAnalysisService,
        {
          provide: getRepositoryToken(Camp),
          useValue: {
            findOne: jest.fn().mockResolvedValue({
              id: 1,
              nombre: "Test Camp",
              max_capacity: 100,
            }),
          },
        },
        {
          provide: ProductionService,
          useValue: {
            findOne: jest.fn().mockResolvedValue({
              balance: { food: 100, water: 200, medical: 50 },
            }),
            calculateDailyBalance: jest.fn().mockResolvedValue({
              balance: { food: 100, water: 200, medical: 50 },
            }),
          },
        },
        {
          provide: ProfessionsService,
          useValue: {
            findOne: jest.fn(),
            findAll: jest.fn().mockResolvedValue([]),
            getProfessionsNeedingWorkers: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: PersonsService,
          useValue: {
            findByRole: jest.fn().mockResolvedValue([]),
            find: jest.fn().mockResolvedValue([]),
            countPersonsByCamp: jest.fn().mockResolvedValue(50),
          },
        },
      ],
    }).compile();

    service = module.get<CampAnalysisService>(CampAnalysisService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  it("should analyze camp context", async () => {
    const result = await service.analyzeCampContext(1);
    expect(result).toBeDefined();
  });

  it("should return camp analysis with required properties", async () => {
    const result = await service.analyzeCampContext(1);
    if (result) {
      expect(result).toHaveProperty("population");
      expect(result).toHaveProperty("capacity");
      expect(result).toHaveProperty("occupancyRate");
      expect(result).toHaveProperty("balance");
    }
  });

  it("should calculate occupancy rate correctly", async () => {
    const result = await service.analyzeCampContext(1);
    if (result) {
      expect(result.occupancyRate).toBeLessThanOrEqual(100);
      expect(result.occupancyRate).toBeGreaterThanOrEqual(0);
    }
  });

  it("should handle camp at full capacity", async () => {
    const module = await Test.createTestingModule({
      providers: [
        CampAnalysisService,
        {
          provide: getRepositoryToken(Camp),
          useValue: {
            findOne: jest.fn().mockResolvedValue({
              id: 2,
              nombre: "Full Camp",
              max_capacity: 100,
            }),
          },
        },
        {
          provide: ProductionService,
          useValue: {
            findOne: jest.fn().mockResolvedValue({
              balance: { food: 10, water: 20, medical: 5 },
            }),
            calculateDailyBalance: jest.fn().mockResolvedValue({
              balance: { food: 10, water: 20, medical: 5 },
            }),
          },
        },
        {
          provide: ProfessionsService,
          useValue: {
            findOne: jest.fn(),
            findAll: jest.fn().mockResolvedValue([]),
            getProfessionsNeedingWorkers: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: PersonsService,
          useValue: {
            findByRole: jest.fn().mockResolvedValue([]),
            find: jest.fn().mockResolvedValue([]),
            countPersonsByCamp: jest.fn().mockResolvedValue(100),
          },
        },
      ],
    }).compile();

    const fullService = module.get<CampAnalysisService>(CampAnalysisService);
    const result = await fullService.analyzeCampContext(2);
    if (result) {
      expect(result.occupancyRate).toEqual(100);
    }
  });

  it("should handle empty camp", async () => {
    const emptyModule = await Test.createTestingModule({
      providers: [
        CampAnalysisService,
        {
          provide: getRepositoryToken(Camp),
          useValue: {
            findOne: jest.fn().mockResolvedValue({
              id: 3,
              nombre: "Empty Camp",
              max_capacity: 100,
            }),
          },
        },
        {
          provide: ProductionService,
          useValue: {
            findOne: jest.fn().mockResolvedValue({
              balance: { food: 500, water: 800, medical: 200 },
            }),
            calculateDailyBalance: jest.fn().mockResolvedValue({
              balance: { food: 500, water: 800, medical: 200 },
            }),
          },
        },
        {
          provide: ProfessionsService,
          useValue: {
            findOne: jest.fn(),
            findAll: jest.fn().mockResolvedValue([]),
            getProfessionsNeedingWorkers: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: PersonsService,
          useValue: {
            findByRole: jest.fn().mockResolvedValue([]),
            find: jest.fn().mockResolvedValue([]),
            countPersonsByCamp: jest.fn().mockResolvedValue(0),
          },
        },
      ],
    }).compile();

    const emptyService =
      emptyModule.get<CampAnalysisService>(CampAnalysisService);
    const result = await emptyService.analyzeCampContext(3);
    if (result) {
      expect(result.occupancyRate).toEqual(0);
    }
  });

  it("should identify critical profession deficit", async () => {
    const criticalModule = await Test.createTestingModule({
      providers: [
        CampAnalysisService,
        {
          provide: getRepositoryToken(Camp),
          useValue: {
            findOne: jest.fn().mockResolvedValue({
              id: 4,
              nombre: "Medical Crisis Camp",
              max_capacity: 100,
            }),
          },
        },
        {
          provide: ProductionService,
          useValue: {
            findOne: jest.fn().mockResolvedValue({
              balance: { food: 100, water: 200, medical: 5 },
            }),
            calculateDailyBalance: jest.fn().mockResolvedValue({
              balance: { food: 100, water: 200, medical: 5 },
            }),
          },
        },
        {
          provide: ProfessionsService,
          useValue: {
            findOne: jest.fn(),
            findAll: jest.fn().mockResolvedValue([]),
            getProfessionsNeedingWorkers: jest.fn().mockResolvedValue([
              { profession: { name: "doctor" }, deficit: 10 },
              { profession: { name: "nurse" }, deficit: 5 },
            ]),
          },
        },
        {
          provide: PersonsService,
          useValue: {
            findByRole: jest.fn().mockResolvedValue([]),
            find: jest.fn().mockResolvedValue([]),
            countPersonsByCamp: jest.fn().mockResolvedValue(50),
          },
        },
      ],
    }).compile();

    const criticalService =
      criticalModule.get<CampAnalysisService>(CampAnalysisService);
    const result = await criticalService.analyzeCampContext(4);
    if (result) {
      expect(result.criticalDeficit).toBeGreaterThan(0);
    }
  });

  it("should handle balanced camp resources", async () => {
    const balancedModule = await Test.createTestingModule({
      providers: [
        CampAnalysisService,
        {
          provide: getRepositoryToken(Camp),
          useValue: {
            findOne: jest.fn().mockResolvedValue({
              id: 5,
              nombre: "Balanced Camp",
              max_capacity: 100,
            }),
          },
        },
        {
          provide: ProductionService,
          useValue: {
            findOne: jest.fn().mockResolvedValue({
              balance: { food: 200, water: 300, medical: 100 },
            }),
            calculateDailyBalance: jest.fn().mockResolvedValue({
              balance: { food: 200, water: 300, medical: 100 },
            }),
          },
        },
        {
          provide: ProfessionsService,
          useValue: {
            findOne: jest.fn(),
            findAll: jest.fn().mockResolvedValue([]),
            getProfessionsNeedingWorkers: jest
              .fn()
              .mockResolvedValue([
                { profession: { name: "farmer" }, deficit: 2 },
              ]),
          },
        },
        {
          provide: PersonsService,
          useValue: {
            findByRole: jest.fn().mockResolvedValue([]),
            find: jest.fn().mockResolvedValue([]),
            countPersonsByCamp: jest.fn().mockResolvedValue(60),
          },
        },
      ],
    }).compile();

    const balancedService =
      balancedModule.get<CampAnalysisService>(CampAnalysisService);
    const result = await balancedService.analyzeCampContext(5);
    expect(result).toBeDefined();
    if (result) {
      expect(result.balance).toBeDefined();
      expect(result.balance.food).toBeGreaterThan(0);
    }
  });
});

describe("CampAnalysisService extra coverage", () => {
  let service: CampAnalysisService;
  let campRepo: { findOne: jest.Mock };
  let productionService: { calculateDailyBalance: jest.Mock };
  let professionsService: { getProfessionsNeedingWorkers: jest.Mock };
  let personsService: { countPersonsByCamp: jest.Mock };

  beforeEach(async () => {
    campRepo = { findOne: jest.fn() };
    productionService = { calculateDailyBalance: jest.fn() };
    professionsService = { getProfessionsNeedingWorkers: jest.fn() };
    personsService = { countPersonsByCamp: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CampAnalysisService,
        { provide: getRepositoryToken(Camp), useValue: campRepo },
        { provide: ProductionService, useValue: productionService },
        { provide: ProfessionsService, useValue: professionsService },
        { provide: PersonsService, useValue: personsService },
      ],
    }).compile();

    service = module.get(CampAnalysisService);
  });

  it("should throw when the camp does not exist", async () => {
    campRepo.findOne.mockResolvedValue(null);

    await expect(service.analyzeCampContext(999)).rejects.toThrow(
      "Camp with ID 999 not found",
    );
  });

  it("should expose the missing camp id in the thrown error message", async () => {
    campRepo.findOne.mockResolvedValue(null);

    try {
      await service.analyzeCampContext(321);
      fail("Expected analyzeCampContext to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe("Camp with ID 321 not found");
    }
  });

  it("should return zero capacity and occupancy when max_capacity is not defined", async () => {
    campRepo.findOne.mockResolvedValue({ id: 1, max_capacity: 0 });
    personsService.countPersonsByCamp.mockResolvedValue(12);
    productionService.calculateDailyBalance.mockResolvedValue({
      balance: { food: 8, water: 15 },
    });
    professionsService.getProfessionsNeedingWorkers.mockResolvedValue([]);

    const result = await service.analyzeCampContext(1);

    expect(result.capacity).toBe(0);
    expect(result.occupancyRate).toBe(0);
    expect(result.criticalDeficit).toBe(0);
    expect(result.criticalProfession).toBeUndefined();
  });

  it("should select the profession with the largest deficit and map balances", async () => {
    campRepo.findOne.mockResolvedValue({ id: 2, max_capacity: 80 });
    personsService.countPersonsByCamp.mockResolvedValue(64);
    productionService.calculateDailyBalance.mockResolvedValue({
      balance: { food: -3, water: 9 },
    });
    professionsService.getProfessionsNeedingWorkers.mockResolvedValue([
      { profession: { name: "Guardia" }, deficit: 1 },
      { profession: { name: "Ingeniero" }, deficit: 4 },
      { profession: { name: "Medico" }, deficit: 2 },
    ]);

    const result = await service.analyzeCampContext(2);

    expect(result).toEqual({
      population: 64,
      capacity: 80,
      occupancyRate: 80,
      balance: { food: -3, water: 9 },
      professionsNeeded: [
        { profession: "Guardia", deficit: 1 },
        { profession: "Ingeniero", deficit: 4 },
        { profession: "Medico", deficit: 2 },
      ],
      criticalProfession: "Ingeniero",
      criticalDeficit: 4,
    });
  });
});
