import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { ProductionService } from "./production.service";
import { PersonsService } from "./persons.service";
import {
  PROFESSIONS_CONFIG,
  DAILY_CONSUMPTION,
} from "../constants/professions.constants";

describe("ProductionService", () => {
  let service: ProductionService;
  let personsService: any;

  beforeEach(async () => {
    personsService = {
      findActiveWorkersByCamp: jest.fn(),
      countPersonsByCamp: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductionService,
        { provide: PersonsService, useValue: personsService },
      ],
    }).compile();

    service = module.get<ProductionService>(ProductionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("calculateDailyProduction", () => {
    it("should skip person if no profession", async () => {
      personsService.findActiveWorkersByCamp.mockResolvedValue([
        { id: 1 }, // No profession
      ]);

      const result = await service.calculateDailyProduction(1);
      expect(result.totalFood).toBe(0);
      expect(result.totalWater).toBe(0);
      expect(result.byProfession.length).toBe(0);
    });

    it("should skip person if profession is not in config", async () => {
      personsService.findActiveWorkersByCamp.mockResolvedValue([
        { id: 1, profession: { id: 2, name: "Aliens" } },
      ]);

      const result = await service.calculateDailyProduction(1);
      expect(result.totalFood).toBe(0);
      expect(result.totalWater).toBe(0);
      expect(result.byProfession.length).toBe(0);
    });

    it("should calculate production correctly", async () => {
      const configName = Object.values(PROFESSIONS_CONFIG)[0].name;
      const foodProd =
        Object.values(PROFESSIONS_CONFIG)[0].daily_food_production;
      const waterProd =
        Object.values(PROFESSIONS_CONFIG)[0].daily_water_production;

      personsService.findActiveWorkersByCamp.mockResolvedValue([
        { id: 1, profession: { id: 2, name: configName } },
        { id: 2, profession: { id: 2, name: configName } },
      ]);

      const result = await service.calculateDailyProduction(1);
      expect(result.totalFood).toBe(foodProd * 2);
      expect(result.totalWater).toBe(waterProd * 2);
      expect(result.byProfession.length).toBe(1);
      expect(result.byProfession[0].workers).toBe(2);
      expect(result.byProfession[0].foodProduction).toBe(foodProd * 2);
      expect(result.byProfession[0].waterProduction).toBe(waterProd * 2);
    });
  });

  describe("calculateDailyConsumption", () => {
    it("should calculate consumption correctly", async () => {
      personsService.countPersonsByCamp.mockResolvedValue(3);

      const result = await service.calculateDailyConsumption(1);
      expect(result.totalPersons).toBe(3);
      expect(result.totalFood).toBe(3 * DAILY_CONSUMPTION.FOOD_PER_PERSON);
      expect(result.totalWater).toBe(3 * DAILY_CONSUMPTION.WATER_PER_PERSON);
    });
  });

  describe("calculateDailyBalance", () => {
    it("should calculate balance correctly", async () => {
      // Mock production to return fixed values
      const configName = Object.values(PROFESSIONS_CONFIG)[0].name;
      const foodProd =
        Object.values(PROFESSIONS_CONFIG)[0].daily_food_production;
      const waterProd =
        Object.values(PROFESSIONS_CONFIG)[0].daily_water_production;
      personsService.findActiveWorkersByCamp.mockResolvedValue([
        { id: 1, profession: { id: 2, name: configName } },
      ]);

      // Mock consumption
      personsService.countPersonsByCamp.mockResolvedValue(1);

      const result = await service.calculateDailyBalance(1);

      expect(result.production.food).toBe(foodProd);
      expect(result.production.water).toBe(waterProd);
      expect(result.consumption.food).toBe(DAILY_CONSUMPTION.FOOD_PER_PERSON);
      expect(result.consumption.water).toBe(DAILY_CONSUMPTION.WATER_PER_PERSON);
      expect(result.balance.food).toBe(
        foodProd - DAILY_CONSUMPTION.FOOD_PER_PERSON,
      );
      expect(result.balance.water).toBe(
        waterProd - DAILY_CONSUMPTION.WATER_PER_PERSON,
      );
      expect(result.persons).toBe(1);
    });
  });
});
