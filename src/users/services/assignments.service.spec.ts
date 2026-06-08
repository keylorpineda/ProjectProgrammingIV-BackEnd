import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { AssignmentsService } from "./assignments.service";
import { getRepositoryToken } from "@nestjs/typeorm";
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { TemporaryAssignment } from "../entities/temporary-assignment.entity";
import { Person } from "../entities/person.entity";
import { ProfessionsService } from "./professions.service";

describe("AssignmentsService", () => {
  let service: AssignmentsService;
  let tempAssignmentRepo: any;
  let personRepo: any;
  let professionsService: any;

  beforeEach(async () => {
    tempAssignmentRepo = {
      findOne: jest.fn(),
      create: jest.fn().mockImplementation((dto) => dto),
      save: jest.fn().mockImplementation((dto) => dto),
      createQueryBuilder: jest.fn().mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([{ id: 1 }]),
      }),
    };

    personRepo = {
      findOne: jest.fn(),
    };

    professionsService = {
      findById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssignmentsService,
        {
          provide: getRepositoryToken(TemporaryAssignment),
          useValue: tempAssignmentRepo,
        },
        { provide: getRepositoryToken(Person), useValue: personRepo },
        { provide: ProfessionsService, useValue: professionsService },
      ],
    }).compile();

    service = module.get<AssignmentsService>(AssignmentsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    it("should throw NotFoundException if person not found", async () => {
      personRepo.findOne.mockResolvedValue(null);
      await expect(service.create({ person_id: 1 } as any, 1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should throw BadRequestException if person has no profession", async () => {
      personRepo.findOne.mockResolvedValue({ id: 1 });
      await expect(service.create({ person_id: 1 } as any, 1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should throw BadRequestException if person cannot work", async () => {
      personRepo.findOne.mockResolvedValue({
        id: 1,
        profession_id: 2,
        can_work: false,
        status: "sick",
      });
      await expect(service.create({ person_id: 1 } as any, 1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should throw BadRequestException if assigning to current profession", async () => {
      personRepo.findOne.mockResolvedValue({
        id: 1,
        profession_id: 2,
        can_work: true,
      });
      professionsService.findById.mockResolvedValue({ id: 2 });
      await expect(
        service.create({ person_id: 1, profession_temporary_id: 2 } as any, 1),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw ConflictException if already has active assignment", async () => {
      personRepo.findOne.mockResolvedValue({
        id: 1,
        profession_id: 2,
        can_work: true,
        userAccount: { id: 10 },
      });
      professionsService.findById.mockResolvedValue({ id: 3 });
      tempAssignmentRepo.findOne.mockResolvedValue({ id: 5 });

      await expect(
        service.create({ person_id: 1, profession_temporary_id: 3 } as any, 1),
      ).rejects.toThrow(ConflictException);
    });

    it("should create temporary assignment successfully", async () => {
      personRepo.findOne.mockResolvedValue({
        id: 1,
        profession_id: 2,
        can_work: true,
        userAccount: { id: 10 },
      });
      professionsService.findById.mockResolvedValue({ id: 3 });
      tempAssignmentRepo.findOne.mockResolvedValue(null);

      const res = await service.create(
        { person_id: 1, profession_temporary_id: 3, duration_days: 5 } as any,
        99,
      );
      expect(res.user_approve_id).toBe(99);
      expect(res.profession_temporary_id).toBe(3);
    });
  });

  describe("findActive", () => {
    it("should find active assignments with camp filter", async () => {
      const res = await service.findActive(1);
      expect(res).toEqual([{ id: 1 }]);
    });

    it("should find active assignments without camp filter", async () => {
      const res = await service.findActive();
      expect(res).toEqual([{ id: 1 }]);
    });
  });

  describe("end", () => {
    it("should throw NotFoundException if assignment not found", async () => {
      tempAssignmentRepo.findOne.mockResolvedValue(null);
      await expect(service.end(1)).rejects.toThrow(NotFoundException);
    });

    it("should end assignment successfully", async () => {
      tempAssignmentRepo.findOne.mockResolvedValue({ id: 1, end_date: null });
      const res = await service.end(1);
      expect(res.end_date).toBeDefined();
    });
  });
});
