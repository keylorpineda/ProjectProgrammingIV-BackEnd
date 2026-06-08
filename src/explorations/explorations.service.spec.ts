import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { AuditLog } from "../common/entities/audit-log.entity";
import { PythonAiService } from "../ai/services/python-ai.service";
import { ResourcesService } from "../resources/resources.service";
import { PersonStatus } from "../users/constants/professions.constants";
import { Person } from "../users/entities/person.entity";
import type { CreateExplorationDto } from "./dto/create-exploration.dto";
import type { ReturnExplorationDto } from "./dto/return-exploration.dto";
import { Exploration } from "./entities/exploration.entity";
import { ExplorationPerson } from "./entities/exploration-person.entity";
import { ExplorationResource } from "./entities/exploration-resource.entity";
import { ExplorationsService } from "./explorations.service";

type RepoMock = {
  find: jest.Mock;
  findOne: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
  createQueryBuilder: jest.Mock;
};

const cloneEntity = <T extends Record<string, any>>(value: T): T => ({
  ...value,
});
const asyncPassThrough = async <T>(value: T): Promise<T> => value;

const createRepoMock = (): RepoMock => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(cloneEntity),
  save: jest.fn(asyncPassThrough),
  createQueryBuilder: jest.fn(),
});

const createQueryRunnerMock = () => ({
  connect: jest.fn().mockResolvedValue(undefined),
  startTransaction: jest.fn().mockResolvedValue(undefined),
  commitTransaction: jest.fn().mockResolvedValue(undefined),
  rollbackTransaction: jest.fn().mockResolvedValue(undefined),
  release: jest.fn().mockResolvedValue(undefined),
  manager: {
    save: jest.fn(asyncPassThrough),
  },
});

describe("ExplorationsService", () => {
  let service: ExplorationsService;
  let explorationRepo: RepoMock;
  let expPersonRepo: RepoMock;
  let expResourceRepo: RepoMock;
  let personRepo: RepoMock;
  let auditRepo: RepoMock;
  let resourcesService: { findAll: jest.Mock; createMovement: jest.Mock };
  let pythonAiService: { analyzeExpedition: jest.Mock };
  let dataSource: { createQueryRunner: jest.Mock };
  let queryRunner: ReturnType<typeof createQueryRunnerMock>;

  const baseDto: CreateExplorationDto = {
    camp_id: 1,
    name: "Salida norte",
    destination_description: "Bosque cercano",
    departure_date: "2026-03-25T10:00:00.000Z",
    estimated_days: 2,
    grace_days: 1,
    persons: [
      { person_id: 10, is_leader: true },
      { person_id: 11, is_leader: false },
    ],
    resources: [{ resource_id: 30, flow: "out", quantity: 5 }],
  };

  const makePerson = (overrides: Partial<Person> = {}): Person =>
    ({
      id: 10,
      first_name: "Ana",
      last_name: "Scout",
      profession: { can_explore: true },
      can_work: true,
      status: PersonStatus.ACTIVE,
      ...overrides,
    }) as Person;

  beforeEach(async () => {
    queryRunner = createQueryRunnerMock();
    resourcesService = {
      findAll: jest.fn(),
      createMovement: jest.fn(),
    };
    pythonAiService = {
      analyzeExpedition: jest
        .fn()
        .mockResolvedValue({ success_probability: 80 }),
    };
    dataSource = {
      createQueryRunner: jest.fn(() => queryRunner),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExplorationsService,
        {
          provide: getRepositoryToken(Exploration),
          useValue: createRepoMock(),
        },
        {
          provide: getRepositoryToken(ExplorationPerson),
          useValue: createRepoMock(),
        },
        {
          provide: getRepositoryToken(ExplorationResource),
          useValue: createRepoMock(),
        },
        { provide: getRepositoryToken(Person), useValue: createRepoMock() },
        { provide: getRepositoryToken(AuditLog), useValue: createRepoMock() },
        {
          provide: ResourcesService,
          useValue: resourcesService,
        },
        {
          provide: PythonAiService,
          useValue: pythonAiService,
        },
        {
          provide: DataSource,
          useValue: dataSource,
        },
      ],
    }).compile();

    service = module.get(ExplorationsService);
    explorationRepo = module.get(getRepositoryToken(Exploration));
    expPersonRepo = module.get(getRepositoryToken(ExplorationPerson));
    expResourceRepo = module.get(getRepositoryToken(ExplorationResource));
    personRepo = module.get(getRepositoryToken(Person));
    auditRepo = module.get(getRepositoryToken(AuditLog));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const mockNoActiveExploration = () => {
    const queryBuilder = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(0),
    };

    expPersonRepo.createQueryBuilder.mockReturnValue(queryBuilder);
    return queryBuilder;
  };

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("create", () => {
    it("should throw when no persons are provided", async () => {
      await expect(
        service.create({ ...baseDto, persons: [] }, 1),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw when some persons are not found", async () => {
      personRepo.find.mockResolvedValue([makePerson({ id: 10 })]);

      await expect(service.create(baseDto, 1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should throw when a person cannot explore", async () => {
      personRepo.find.mockResolvedValue([
        makePerson({ profession: { can_explore: false } as any }),
        makePerson({ id: 11, first_name: "Luis" }),
      ]);

      await expect(service.create(baseDto, 1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should throw when a person cannot work", async () => {
      personRepo.find.mockResolvedValue([
        makePerson({ can_work: false }),
        makePerson({ id: 11, first_name: "Luis" }),
      ]);

      await expect(service.create(baseDto, 1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should throw when a person is not active", async () => {
      personRepo.find.mockResolvedValue([
        makePerson({ status: PersonStatus.SICK }),
        makePerson({ id: 11, first_name: "Luis" }),
      ]);

      await expect(service.create(baseDto, 1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should throw when a person is already exploring", async () => {
      personRepo.find.mockResolvedValue([
        makePerson({ id: 10 }),
        makePerson({ id: 11, first_name: "Luis" }),
      ]);
      const queryBuilder = {
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(0),
      };
      expPersonRepo.createQueryBuilder.mockReturnValue(queryBuilder);

      await expect(service.create(baseDto, 1)).rejects.toThrow(
        ConflictException,
      );
    });

    it("should rollback when food or water resources are missing", async () => {
      personRepo.find.mockResolvedValue([
        makePerson({ id: 10 }),
        makePerson({ id: 11, first_name: "Luis" }),
      ]);
      mockNoActiveExploration();
      explorationRepo.create.mockReturnValue({
        id: 44,
        ...baseDto,
        status: "scheduled",
      });
      resourcesService.findAll.mockResolvedValue({
        data: [{ id: 1, category: "food" }],
      });

      await expect(service.create(baseDto, 7)).rejects.toThrow(
        BadRequestException,
      );
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
    });

    it("should create an exploration with automatic and additional resources", async () => {
      const people = [
        makePerson({ id: 10 }),
        makePerson({ id: 11, first_name: "Luis" }),
      ];
      const savedExploration = { id: 44 } as Exploration;
      const foundExploration = { id: 44, status: "scheduled" } as Exploration;

      personRepo.find.mockResolvedValue(people);
      mockNoActiveExploration();
      explorationRepo.create.mockReturnValue({
        camp_id: baseDto.camp_id,
        name: baseDto.name,
        destination_description: baseDto.destination_description,
        departure_date: new Date(baseDto.departure_date),
        estimated_days: baseDto.estimated_days,
        grace_days: baseDto.grace_days,
        status: "scheduled",
        user_create_id: 99,
      });
      expPersonRepo.create.mockImplementation((value) => value);
      expResourceRepo.create.mockImplementation((value) => value);
      auditRepo.create.mockImplementation((value) => value);
      queryRunner.manager.save
        .mockResolvedValueOnce(savedExploration)
        .mockImplementation(asyncPassThrough);
      resourcesService.findAll.mockResolvedValue({
        data: [
          { id: 1, category: "food" },
          { id: 2, category: "water" },
          { id: 30, category: "tools" },
        ],
      });
      resourcesService.createMovement.mockResolvedValue({});
      jest.spyOn(service, "findById").mockResolvedValue(foundExploration);

      const result = await service.create(baseDto, 99);

      expect(dataSource.createQueryRunner).toHaveBeenCalled();
      expect(queryRunner.connect).toHaveBeenCalled();
      expect(queryRunner.startTransaction).toHaveBeenCalled();
      expect(resourcesService.findAll).toHaveBeenCalledWith(1, 1000);
      expect(resourcesService.createMovement).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          resource_id: 1,
          quantity: 12,
          type: "exploration_out",
        }),
        99,
      );
      expect(resourcesService.createMovement).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          resource_id: 2,
          quantity: 18,
          type: "exploration_out",
        }),
        99,
      );
      expect(resourcesService.createMovement).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({
          resource_id: 30,
          quantity: 5,
          type: "exploration_out",
        }),
        99,
      );
      expect(queryRunner.manager.save).toHaveBeenCalledWith(
        expect.objectContaining({
          person_id: 10,
          is_leader: true,
          return_confirmed: false,
        }),
      );
      expect(queryRunner.manager.save).toHaveBeenCalledWith(
        expect.objectContaining({ resource_id: 1, flow: "out", quantity: 12 }),
      );
      expect(queryRunner.manager.save).toHaveBeenCalledWith(
        expect.objectContaining({ resource_id: 2, flow: "out", quantity: 18 }),
      );
      expect(queryRunner.manager.save).toHaveBeenCalledWith(
        expect.objectContaining({ resource_id: 30, flow: "out", quantity: 5 }),
      );
      expect(people[0].status).toBe(PersonStatus.EXPLORING);
      expect(people[0].can_work).toBe(false);
      expect(auditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "exploration_created",
          entity_id: 44,
          new_value: expect.objectContaining({
            food_rations: 12,
            water_rations: 18,
          }),
        }),
      );
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
      expect(service.findById).toHaveBeenCalledWith(44);
      expect(result).toBe(foundExploration);
    });

    it("should create an exploration without additional resources", async () => {
      const dto = { ...baseDto, resources: undefined };
      const people = [
        makePerson({ id: 10 }),
        makePerson({ id: 11, first_name: "Luis" }),
      ];

      personRepo.find.mockResolvedValue(people);
      mockNoActiveExploration();
      explorationRepo.create.mockReturnValue({
        id: 55,
        ...dto,
        status: "scheduled",
      });
      expPersonRepo.create.mockImplementation((value) => value);
      expResourceRepo.create.mockImplementation((value) => value);
      auditRepo.create.mockImplementation((value) => value);
      queryRunner.manager.save
        .mockResolvedValueOnce({ id: 55 })
        .mockImplementation(asyncPassThrough);
      resourcesService.findAll.mockResolvedValue({
        data: [
          { id: 1, category: "food" },
          { id: 2, category: "water" },
        ],
      });
      resourcesService.createMovement.mockResolvedValue({});
      jest
        .spyOn(service, "findById")
        .mockResolvedValue({ id: 55 } as Exploration);

      await service.create(dto, 99);

      expect(resourcesService.createMovement).toHaveBeenCalledTimes(2);
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });

    it("should default grace days and leader flag when they are omitted", async () => {
      const dto: CreateExplorationDto = {
        camp_id: 1,
        name: "Salida corta",
        departure_date: "2026-03-25T10:00:00.000Z",
        estimated_days: 2,
        persons: [{ person_id: 10 }],
      };
      const person = makePerson({ id: 10 });

      personRepo.find.mockResolvedValue([person]);
      mockNoActiveExploration();
      explorationRepo.create.mockImplementation((value) => value);
      expPersonRepo.create.mockImplementation((value) => value);
      expResourceRepo.create.mockImplementation((value) => value);
      auditRepo.create.mockImplementation((value) => value);
      queryRunner.manager.save
        .mockResolvedValueOnce({ id: 57 })
        .mockImplementation(asyncPassThrough);
      resourcesService.findAll.mockResolvedValue({
        data: [
          { id: 1, category: "food" },
          { id: 2, category: "water" },
        ],
      });
      resourcesService.createMovement.mockResolvedValue({});
      jest
        .spyOn(service, "findById")
        .mockResolvedValue({ id: 57 } as Exploration);

      await service.create(dto, 5);

      expect(explorationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          grace_days: 0,
          user_create_id: 5,
          departure_date: new Date(dto.departure_date),
        }),
      );
      expect(expPersonRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          exploration_id: 57,
          person_id: 10,
          is_leader: false,
          return_confirmed: false,
        }),
      );
      expect(resourcesService.createMovement).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ quantity: 4 }),
        5,
      );
      expect(resourcesService.createMovement).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ quantity: 6 }),
        5,
      );
    });

    it("should rollback when createMovement fails during creation", async () => {
      const people = [
        makePerson({ id: 10 }),
        makePerson({ id: 11, first_name: "Luis" }),
      ];

      personRepo.find.mockResolvedValue(people);
      mockNoActiveExploration();
      explorationRepo.create.mockReturnValue({
        id: 56,
        ...baseDto,
        status: "scheduled",
      });
      expPersonRepo.create.mockImplementation((value) => value);
      queryRunner.manager.save
        .mockResolvedValueOnce({ id: 56 })
        .mockImplementation(asyncPassThrough);
      resourcesService.findAll.mockResolvedValue({
        data: [
          { id: 1, category: "food" },
          { id: 2, category: "water" },
        ],
      });
      resourcesService.createMovement.mockRejectedValue(new Error("boom"));

      await expect(
        service.create({ ...baseDto, resources: undefined }, 5),
      ).rejects.toThrow("boom");
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
    });
  });

  describe("registerReturn", () => {
    const returnDto: ReturnExplorationDto = {
      real_return_date: "2026-03-28T12:00:00.000Z",
      notes: "Regresaron a salvo",
      found_resources: [{ resource_id: 40, flow: "in", quantity: 7 }],
    };

    it("should throw when the exploration does not exist", async () => {
      explorationRepo.findOne.mockResolvedValue(null);

      await expect(service.registerReturn(1, returnDto, 4)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should throw when the exploration is already completed", async () => {
      explorationRepo.findOne.mockResolvedValue({ status: "completed" });

      await expect(service.registerReturn(1, returnDto, 4)).rejects.toThrow(
        ConflictException,
      );
    });

    it("should throw when the exploration was cancelled", async () => {
      explorationRepo.findOne.mockResolvedValue({ status: "cancelled" });

      await expect(service.registerReturn(1, returnDto, 4)).rejects.toThrow(
        ConflictException,
      );
    });

    it("should register the return, restore persons and add found resources", async () => {
      const exploration = {
        id: 70,
        camp_id: 2,
        name: "Salida norte",
        status: "scheduled",
        explorationPersons: [
          {
            return_confirmed: false,
            person: makePerson({
              id: 10,
              status: PersonStatus.EXPLORING,
              can_work: false,
            }),
          },
        ],
        explorationResources: [],
      } as any;

      explorationRepo.findOne.mockResolvedValue(exploration);
      expResourceRepo.create.mockImplementation((value) => value);
      auditRepo.create.mockImplementation((value) => value);
      resourcesService.createMovement.mockResolvedValue({});
      jest
        .spyOn(service, "findById")
        .mockResolvedValue({ id: 70 } as Exploration);

      const result = await service.registerReturn(70, returnDto, 4);

      expect(exploration.status).toBe("completed");
      expect(exploration.real_return_date).toEqual(
        new Date(returnDto.real_return_date),
      );
      expect(exploration.notes).toBe(returnDto.notes);
      expect(exploration.explorationPersons[0].return_confirmed).toBe(true);
      expect(exploration.explorationPersons[0].person.status).toBe(
        PersonStatus.ACTIVE,
      );
      expect(exploration.explorationPersons[0].person.can_work).toBe(true);
      expect(resourcesService.createMovement).toHaveBeenCalledWith(
        expect.objectContaining({
          camp_id: 2,
          resource_id: 40,
          quantity: 7,
          type: "exploration_in",
        }),
        4,
      );
      expect(auditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "exploration_return",
          entity_id: 70,
        }),
      );
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
      expect(result).toEqual({ id: 70 });
    });

    it("should register the return without notes or found resources", async () => {
      const exploration = {
        id: 71,
        camp_id: 2,
        name: "Salida sur",
        status: "in_progress",
        explorationPersons: [{ return_confirmed: false, person: undefined }],
        explorationResources: [],
      } as any;

      explorationRepo.findOne.mockResolvedValue(exploration);
      auditRepo.create.mockImplementation((value) => value);
      jest
        .spyOn(service, "findById")
        .mockResolvedValue({ id: 71 } as Exploration);

      await service.registerReturn(
        71,
        { real_return_date: returnDto.real_return_date },
        4,
      );

      expect(resourcesService.createMovement).not.toHaveBeenCalled();
      expect(exploration.notes).toBeUndefined();
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });

    it("should rollback when registering a return fails", async () => {
      const exploration = {
        id: 72,
        camp_id: 2,
        name: "Salida oeste",
        status: "in_progress",
        explorationPersons: [],
        explorationResources: [],
      } as any;

      explorationRepo.findOne.mockResolvedValue(exploration);
      resourcesService.createMovement.mockRejectedValue(
        new Error("movement failed"),
      );

      await expect(service.registerReturn(72, returnDto, 4)).rejects.toThrow(
        "movement failed",
      );
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
    });
  });

  describe("findAll", () => {
    it("should return explorations without filters", async () => {
      const queryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([{ id: 1 }]),
      };
      explorationRepo.createQueryBuilder.mockReturnValue(queryBuilder);

      const result = await service.findAll();

      expect(explorationRepo.createQueryBuilder).toHaveBeenCalledWith("e");
      expect(queryBuilder.andWhere).not.toHaveBeenCalled();
      expect(result).toEqual([{ id: 1 }]);
    });

    it("should apply camp and status filters", async () => {
      const queryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([{ id: 2 }]),
      };
      explorationRepo.createQueryBuilder.mockReturnValue(queryBuilder);

      await service.findAll(5, "scheduled");

      expect(queryBuilder.andWhere).toHaveBeenNthCalledWith(
        1,
        "e.camp_id = :campId",
        {
          campId: 5,
        },
      );
      expect(queryBuilder.andWhere).toHaveBeenNthCalledWith(
        2,
        "e.status = :status",
        {
          status: "scheduled",
        },
      );
    });
  });

  describe("findById", () => {
    it("should return one exploration", async () => {
      const exploration = { id: 22 } as Exploration;
      explorationRepo.findOne.mockResolvedValue(exploration);

      const result = await service.findById(22);

      expect(explorationRepo.findOne).toHaveBeenCalledWith({
        where: { id: 22 },
        relations: [
          "camp",
          "userCreate",
          "explorationPersons",
          "explorationPersons.person",
          "explorationPersons.person.profession",
          "explorationResources",
          "explorationResources.resource",
        ],
      });
      expect(result).toBe(exploration);
    });

    it("should throw when exploration is missing", async () => {
      explorationRepo.findOne.mockResolvedValue(null);

      await expect(service.findById(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe("cancel", () => {
    it("should throw when the exploration is missing", async () => {
      explorationRepo.findOne.mockResolvedValue(null);

      await expect(service.cancel(1, 8)).rejects.toThrow(NotFoundException);
    });

    it("should throw when the exploration is not scheduled", async () => {
      explorationRepo.findOne.mockResolvedValue({ status: "in_progress" });

      await expect(service.cancel(1, 8)).rejects.toThrow(ConflictException);
    });

    it("should cancel a scheduled exploration and refund outgoing resources", async () => {
      const exploration = {
        id: 33,
        camp_id: 2,
        name: "Salida este",
        status: "scheduled",
        explorationPersons: [
          {
            person: makePerson({
              id: 10,
              status: PersonStatus.EXPLORING,
              can_work: false,
            }),
          },
          {
            person: makePerson({
              id: 11,
              first_name: "Luis",
              status: PersonStatus.ACTIVE,
            }),
          },
        ],
        explorationResources: [
          { resource_id: 1, quantity: 12, flow: "out" },
          { resource_id: 2, quantity: 4, flow: "in" },
        ],
      } as any;

      explorationRepo.findOne.mockResolvedValue(exploration);
      auditRepo.create.mockImplementation((value) => value);
      resourcesService.createMovement.mockResolvedValue({});
      jest
        .spyOn(service, "findById")
        .mockResolvedValue({ id: 33 } as Exploration);

      const result = await service.cancel(33, 8);

      expect(resourcesService.createMovement).toHaveBeenCalledTimes(1);
      expect(resourcesService.createMovement).toHaveBeenCalledWith(
        expect.objectContaining({
          resource_id: 1,
          quantity: 12,
          type: "exploration_in",
        }),
        8,
      );
      expect(exploration.explorationPersons[0].person.status).toBe(
        PersonStatus.ACTIVE,
      );
      expect(exploration.explorationPersons[0].person.can_work).toBe(true);
      expect(exploration.status).toBe("cancelled");
      expect(auditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "exploration_cancelled",
          entity_id: 33,
        }),
      );
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
      expect(result).toEqual({ id: 33 });
    });

    it("should rollback when cancelling fails", async () => {
      const exploration = {
        id: 34,
        camp_id: 2,
        name: "Salida este",
        status: "scheduled",
        explorationPersons: [],
        explorationResources: [{ resource_id: 1, quantity: 12, flow: "out" }],
      } as any;

      explorationRepo.findOne.mockResolvedValue(exploration);
      resourcesService.createMovement.mockRejectedValue(
        new Error("refund failed"),
      );

      await expect(service.cancel(34, 8)).rejects.toThrow("refund failed");
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
    });
  });

  describe("depart", () => {
    it("should throw when the exploration is missing", async () => {
      explorationRepo.findOne.mockResolvedValue(null);

      await expect(service.depart(1, 10)).rejects.toThrow(NotFoundException);
    });

    it("should throw when the exploration is not scheduled", async () => {
      explorationRepo.findOne.mockResolvedValue({ status: "completed" });

      await expect(service.depart(1, 10)).rejects.toThrow(ConflictException);
    });

    it("should mark the exploration as in progress and register the audit event", async () => {
      const exploration = {
        id: 80,
        camp_id: 3,
        name: "Salida norte",
        destination_description: "Zona norte",
        estimated_days: 4,
        status: "scheduled",
        departure_date: new Date("2026-03-20T00:00:00.000Z"),
        explorationPersons: [
          {
            person_id: 10,
            is_leader: true,
            person: {
              id: 10,
              status: PersonStatus.EXPLORING,
              can_work: false,
              experience_level: 3,
              achievements: ["VETERANO_PARAMO"],
            },
          },
          {
            person_id: 11,
            is_leader: false,
            person: {
              id: 11,
              status: PersonStatus.EXPLORING,
              can_work: false,
              experience_level: 2,
              achievements: [],
            },
          },
        ],
      } as unknown as Exploration;

      explorationRepo.findOne.mockResolvedValue(exploration);
      explorationRepo.save.mockResolvedValue(exploration);
      auditRepo.create.mockImplementation((value) => value);
      auditRepo.save.mockResolvedValue({});
      jest
        .spyOn(service, "findById")
        .mockResolvedValue({ id: 80 } as Exploration);

      const result = await service.depart(80, 10);

      expect(exploration.status).toBe("in_progress");
      expect(exploration.departure_date).toBeInstanceOf(Date);
      expect(explorationRepo.save).toHaveBeenCalledWith(exploration);
      expect(pythonAiService.analyzeExpedition).toHaveBeenCalledWith(
        expect.objectContaining({
          explorers: [
            {
              id: 10,
              role: "leader",
              health_status: 85,
              achievements: ["VETERANO_PARAMO"],
            },
            {
              id: 11,
              role: "member",
              health_status: 85,
              achievements: [],
            },
          ],
        }),
      );
      expect(auditRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "exploration_departed",
          entity_id: 80,
          new_value: expect.objectContaining({
            expedition_ai_analysis: expect.anything(),
          }),
        }),
      );
      expect(result).toEqual({ id: 80 });
    });
  });
});
