import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { PersonsService } from "./persons.service";
import { Person } from "../entities/person.entity";
import { Profession } from "../entities/profession.entity";
import { PersonStatus } from "../constants/professions.constants";

describe("PersonsService", () => {
  let service: PersonsService;
  let personRepo: jest.Mocked<Repository<Person>>;
  let professionRepo: jest.Mocked<Repository<Profession>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PersonsService,
        {
          provide: getRepositoryToken(Person),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            remove: jest.fn(),
            count: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Profession),
          useValue: {
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(PersonsService);
    personRepo = module.get(getRepositoryToken(Person));
    professionRepo = module.get(getRepositoryToken(Profession));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should create a person with generated defaults", async () => {
    const dto = { profession_id: 2, first_name: "Eva", last_name: "Stone" };
    const profession = { id: 2 } as Profession;
    const created = { id: 1 } as Person;

    professionRepo.findOne.mockResolvedValueOnce(profession);
    personRepo.create.mockReturnValueOnce(created);
    personRepo.save.mockResolvedValueOnce(created);

    const result = await service.create(dto as any);

    expect(result).toBe(created);
    expect(professionRepo.findOne).toHaveBeenCalledWith({ where: { id: 2 } });
    expect(personRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        ...dto,
        status: PersonStatus.ACTIVE,
        can_work: true,
        join_date: expect.any(Date),
        identification_code: expect.stringMatching(/^SURVIVOR-/),
      }),
    );
  });

  it("should create a person without checking profession when profession_id is absent", async () => {
    const dto = { first_name: "Eva", last_name: "Stone" };
    const created = { id: 1 } as Person;
    personRepo.create.mockReturnValueOnce(created);
    personRepo.save.mockResolvedValueOnce(created);

    await service.create(dto as any);

    expect(professionRepo.findOne).not.toHaveBeenCalled();
  });

  it("should throw when creating a person with missing profession", async () => {
    professionRepo.findOne.mockResolvedValueOnce(null);

    await expect(
      service.create({
        profession_id: 55,
        first_name: "No",
        last_name: "Role",
      } as any),
    ).rejects.toThrow(new NotFoundException("Profession with ID 55 not found"));
  });

  it("should find all persons with search, paging and camp filter", async () => {
    const qb: any = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValueOnce([[{ id: 1 }], 1]),
    };
    personRepo.createQueryBuilder.mockReturnValueOnce(qb);

    const result = await service.findAll(9, 0, 500, "EvA");

    expect(result).toEqual({
      data: [{ id: 1 }],
      total: 1,
      page: 1,
      limit: 100,
      totalPages: 1,
    });
    expect(qb.where).toHaveBeenCalledWith("camp.id = :campId", { campId: 9 });
    expect(qb.andWhere).toHaveBeenCalledWith(
      "(LOWER(person.first_name) LIKE :s OR LOWER(person.last_name) LIKE :s OR person.identification_code LIKE :s)",
      { s: "%eva%" },
    );
    expect(qb.skip).toHaveBeenCalledWith(0);
    expect(qb.take).toHaveBeenCalledWith(100);
  });

  it("should use where for search when camp filter is absent", async () => {
    const qb: any = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValueOnce([[], 0]),
    };
    personRepo.createQueryBuilder.mockReturnValueOnce(qb);

    await service.findAll(undefined, 2, 10, "lee");

    expect(qb.where).toHaveBeenCalledWith(
      "(LOWER(person.first_name) LIKE :s OR LOWER(person.last_name) LIKE :s OR person.identification_code LIKE :s)",
      { s: "%lee%" },
    );
  });

  it("should find all persons without search filters", async () => {
    const qb: any = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValueOnce([[], 0]),
    };
    personRepo.createQueryBuilder.mockReturnValueOnce(qb);

    const result = await service.findAll();

    expect(result).toEqual({
      data: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0,
    });
    expect(qb.where).not.toHaveBeenCalled();
    expect(qb.andWhere).not.toHaveBeenCalled();
  });

  it("should find a person by id with relations", async () => {
    const person = { id: 1 } as Person;
    personRepo.findOne.mockResolvedValueOnce(person);

    await expect(service.findById(1)).resolves.toBe(person);
  });

  it("should throw when person is not found by id", async () => {
    personRepo.findOne.mockResolvedValueOnce(null);

    await expect(service.findById(404)).rejects.toThrow(
      new NotFoundException("Person with ID 404 not found"),
    );
  });

  it("should update a person and validate a new profession", async () => {
    const person = { id: 1, profession_id: 1 } as Person;
    jest.spyOn(service, "findById").mockResolvedValueOnce(person);
    professionRepo.findOne.mockResolvedValueOnce({ id: 3 } as Profession);
    personRepo.save.mockResolvedValueOnce({
      ...person,
      profession_id: 3,
    } as Person);

    const result = await service.update(1, { profession_id: 3 } as any);

    expect(professionRepo.findOne).toHaveBeenCalledWith({ where: { id: 3 } });
    expect(result.profession_id).toBe(3);
  });

  it("should update a person without rechecking the same profession", async () => {
    const person = { id: 1, profession_id: 3 } as Person;
    jest.spyOn(service, "findById").mockResolvedValueOnce(person);
    personRepo.save.mockResolvedValueOnce(person);

    await service.update(1, { profession_id: 3, first_name: "New" } as any);

    expect(professionRepo.findOne).not.toHaveBeenCalled();
  });

  it("should throw when updating a person with a missing profession", async () => {
    jest
      .spyOn(service, "findById")
      .mockResolvedValueOnce({ id: 1, profession_id: 1 } as Person);
    professionRepo.findOne.mockResolvedValueOnce(null);

    await expect(
      service.update(1, { profession_id: 8 } as any),
    ).rejects.toThrow(new NotFoundException("Profession with ID 8 not found"));
  });

  it("should update a person status, can_work and append notes", async () => {
    const person = {
      id: 1,
      status: PersonStatus.ACTIVE,
      can_work: true,
      notes: "prev",
    } as Person;
    jest.spyOn(service, "findById").mockResolvedValueOnce(person);
    personRepo.save.mockImplementation(async (value) => value as Person);

    const result = await service.updateStatus(1, {
      status: PersonStatus.SICK,
      notes: "reposo",
    } as any);

    expect(result.status).toBe(PersonStatus.SICK);
    expect(result.can_work).toBe(false);
    expect(result.notes).toContain(
      "Status changed from active to sick: reposo",
    );
  });

  it("should initialize notes when updating status with a new note and no previous notes", async () => {
    const person = {
      id: 1,
      status: PersonStatus.ACTIVE,
      can_work: true,
    } as Person;
    jest.spyOn(service, "findById").mockResolvedValueOnce(person);
    personRepo.save.mockImplementation(async (value) => value as Person);

    const result = await service.updateStatus(1, {
      status: PersonStatus.SICK,
      notes: "aislamiento",
    } as any);

    expect(result.notes).toContain(
      "Status changed from active to sick: aislamiento",
    );
    expect(result.notes?.startsWith("[")).toBe(true);
  });

  it("should update a person status without notes", async () => {
    const person = {
      id: 1,
      status: PersonStatus.SICK,
      can_work: false,
    } as Person;
    jest.spyOn(service, "findById").mockResolvedValueOnce(person);
    personRepo.save.mockImplementation(async (value) => value as Person);

    const result = await service.updateStatus(1, {
      status: PersonStatus.ACTIVE,
    } as any);

    expect(result.can_work).toBe(true);
    expect(result.notes).toBeUndefined();
  });

  it("should delete a person without active user account", async () => {
    const person = { id: 1, userAccount: null } as any;
    jest.spyOn(service, "findById").mockResolvedValueOnce(person);
    personRepo.remove.mockResolvedValueOnce(person);

    await expect(service.delete(1)).resolves.toBeUndefined();
    expect(personRepo.remove).toHaveBeenCalledWith(person);
  });

  it("should reject deletion when person has a user account", async () => {
    jest
      .spyOn(service, "findById")
      .mockResolvedValueOnce({ id: 1, userAccount: { id: 2 } } as any);

    await expect(service.delete(1)).rejects.toThrow(
      new BadRequestException(
        "Cannot delete person with an active user account. Delete the user account first.",
      ),
    );
  });

  it("should count active workers without excluding a person", async () => {
    personRepo.count.mockResolvedValueOnce(2);

    const result = await service.countActiveWorkers(5);

    expect(result).toBe(2);
    expect(personRepo.count).toHaveBeenCalledWith({
      where: {
        profession_id: 5,
        can_work: true,
        status: expect.any(Object),
        id: undefined,
      },
    });
  });

  it("should count active workers optionally excluding one person", async () => {
    personRepo.count.mockResolvedValueOnce(4);

    const result = await service.countActiveWorkers(5, 8);

    expect(result).toBe(4);
    expect(personRepo.count).toHaveBeenCalledWith({
      where: {
        profession_id: 5,
        can_work: true,
        status: expect.any(Object),
        id: expect.any(Object),
      },
    });
  });

  it("should find active workers by camp", async () => {
    const qb: any = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValueOnce([{ id: 1 }]),
    };
    personRepo.createQueryBuilder.mockReturnValueOnce(qb);

    await expect(service.findActiveWorkersByCamp(3)).resolves.toEqual([
      { id: 1 },
    ]);
    expect(qb.where).toHaveBeenCalledWith("userAccount.camp_id = :campId", {
      campId: 3,
    });
  });

  it("should count persons by camp and optionally exclude deceased", async () => {
    const qbExclude: any = {
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValueOnce(6),
    };
    const qbAll: any = {
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValueOnce(8),
    };
    personRepo.createQueryBuilder
      .mockReturnValueOnce(qbExclude)
      .mockReturnValueOnce(qbAll);

    await expect(service.countPersonsByCamp(2)).resolves.toBe(6);
    await expect(service.countPersonsByCamp(2, false)).resolves.toBe(8);
    expect(qbExclude.andWhere).toHaveBeenCalled();
    expect(qbAll.andWhere).not.toHaveBeenCalled();
  });

  it("should get stats by status with optional camp filter", async () => {
    const qbWithCamp: any = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawMany: jest
        .fn()
        .mockResolvedValueOnce([{ status: "active", count: 1 }]),
    };
    const qbWithoutCamp: any = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValueOnce([]),
    };
    personRepo.createQueryBuilder
      .mockReturnValueOnce(qbWithCamp)
      .mockReturnValueOnce(qbWithoutCamp);

    await expect(service.getStatsByStatus(4)).resolves.toEqual([
      { status: "active", count: 1 },
    ]);
    await expect(service.getStatsByStatus()).resolves.toEqual([]);
  });

  it("should get stats by profession with optional camp filter", async () => {
    const qb: any = {
      leftJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawMany: jest
        .fn()
        .mockResolvedValueOnce([
          { professionName: "Medico", total: 2, active: 1, inactive: 1 },
        ]),
    };
    personRepo.createQueryBuilder.mockReturnValueOnce(qb);

    await expect(service.getStatsByProfession(4)).resolves.toEqual([
      { professionName: "Medico", total: 2, active: 1, inactive: 1 },
    ]);
    expect(qb.where).toHaveBeenCalledWith("userAccount.camp_id = :campId", {
      campId: 4,
    });
  });

  it("should get stats by profession without camp filter", async () => {
    const qb: any = {
      leftJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValueOnce([]),
    };
    personRepo.createQueryBuilder.mockReturnValueOnce(qb);

    await expect(service.getStatsByProfession()).resolves.toEqual([]);
    expect(qb.where).not.toHaveBeenCalled();
  });
});
