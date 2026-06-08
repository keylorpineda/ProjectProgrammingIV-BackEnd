import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { ProfessionsService } from "./professions.service";
import { getRepositoryToken } from "@nestjs/typeorm";
import { NotFoundException } from "@nestjs/common";
import { Profession } from "../entities/profession.entity";
import { PersonsService } from "./persons.service";

describe("ProfessionsService", () => {
  let service: ProfessionsService;
  let professionRepo: any;
  let personsService: any;

  beforeEach(async () => {
    professionRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn().mockImplementation((dto) => dto),
      save: jest.fn().mockImplementation((dto) => dto),
    };

    personsService = {
      countActiveWorkers: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfessionsService,
        { provide: getRepositoryToken(Profession), useValue: professionRepo },
        { provide: PersonsService, useValue: personsService },
      ],
    }).compile();

    service = module.get<ProfessionsService>(ProfessionsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("findAll", () => {
    it("should return all professions", async () => {
      professionRepo.find.mockResolvedValue([{ id: 1 }]);
      const res = await service.findAll();
      expect(res).toEqual([{ id: 1 }]);
    });
  });

  describe("findById", () => {
    it("should return a profession if found", async () => {
      professionRepo.findOne.mockResolvedValue({ id: 1 });
      const res = await service.findById(1);
      expect(res).toEqual({ id: 1 });
    });

    it("should throw NotFoundException if not found", async () => {
      professionRepo.findOne.mockResolvedValue(null);
      await expect(service.findById(1)).rejects.toThrow(NotFoundException);
    });
  });

  describe("create", () => {
    it("should create and return a profession", async () => {
      const res = await service.create({ name: "Guard" });
      expect(res).toEqual({ name: "Guard" });
    });
  });

  describe("checkMinimumWorkers", () => {
    it("should return needsWorkers true with warning if below minimum", async () => {
      jest.spyOn(service, "findById").mockResolvedValue({
        id: 1,
        minimum_active_required: 5,
        name: "Guard",
      } as any);
      personsService.countActiveWorkers.mockResolvedValue(3);
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation();

      const res = await service.checkMinimumWorkers(1);
      expect(res).toEqual({
        needsWorkers: true,
        currentWorkers: 3,
        minimumRequired: 5,
      });
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("should return needsWorkers false if meets minimum", async () => {
      jest.spyOn(service, "findById").mockResolvedValue({
        id: 1,
        minimum_active_required: 5,
        name: "Guard",
      } as any);
      personsService.countActiveWorkers.mockResolvedValue(5);

      const res = await service.checkMinimumWorkers(1);
      expect(res).toEqual({
        needsWorkers: false,
        currentWorkers: 5,
        minimumRequired: 5,
      });
    });
  });

  describe("getProfessionsNeedingWorkers", () => {
    it("should return professions with deficit", async () => {
      jest
        .spyOn(service, "findAll")
        .mockResolvedValue([
          { id: 1, minimum_active_required: 5 } as any,
          { id: 2, minimum_active_required: 2 } as any,
        ]);
      personsService.countActiveWorkers
        .mockResolvedValueOnce(3) // For profession 1
        .mockResolvedValueOnce(2); // For profession 2

      const res = await service.getProfessionsNeedingWorkers();
      expect(res).toHaveLength(1);
      expect(res[0].deficit).toBe(2);
      expect(res[0].profession.id).toBe(1);
    });
  });

  describe("getProfessionsWithExcess", () => {
    it("should return professions with excess", async () => {
      jest
        .spyOn(service, "findAll")
        .mockResolvedValue([
          { id: 1, minimum_active_required: 5 } as any,
          { id: 2, minimum_active_required: 2 } as any,
        ]);
      personsService.countActiveWorkers
        .mockResolvedValueOnce(5) // For profession 1
        .mockResolvedValueOnce(4); // For profession 2

      const res = await service.getProfessionsWithExcess();
      expect(res).toHaveLength(1);
      expect(res[0].excess).toBe(2);
      expect(res[0].profession.id).toBe(2);
    });
  });
});
