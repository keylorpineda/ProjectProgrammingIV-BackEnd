import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { NotFoundException } from "@nestjs/common";
import type { Repository } from "typeorm";
import { UsersService } from "./users.service";
import { UserAccount } from "./entities/user-account.entity";
import { UserAsset } from "./entities/user-asset.entity";
import { Asset } from "./entities/asset.entity";
import { PersonsService } from "./services/persons.service";
import { ProfessionsService } from "./services/professions.service";
import { AssignmentsService } from "./services/assignments.service";
import { ProductionService } from "./services/production.service";
import { PersonAchievement } from "./entities/person-achievement.entity";

describe("UsersService", () => {
  let service: UsersService;
  let userAccountRepo: jest.Mocked<Repository<UserAccount>>;
  let userAssetRepo: jest.Mocked<Repository<UserAsset>> & {
    manager: { find: jest.Mock };
  };
  let personsService: jest.Mocked<PersonsService>;
  let professionsService: jest.Mocked<ProfessionsService>;
  let assignmentsService: jest.Mocked<AssignmentsService>;
  let productionService: jest.Mocked<ProductionService>;
  let personAchievementRepo: jest.Mocked<Repository<PersonAchievement>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(UserAccount),
          useValue: {
            findOne: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(UserAsset),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn(),
            manager: {
              find: jest.fn(),
            },
          },
        },
        {
          provide: getRepositoryToken(PersonAchievement),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
            find: jest.fn(),
          },
        },
        {
          provide: PersonsService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findById: jest.fn(),
            update: jest.fn(),
            updateStatus: jest.fn(),
            delete: jest.fn(),
            getStatsByStatus: jest.fn(),
            getStatsByProfession: jest.fn(),
          },
        },
        {
          provide: ProfessionsService,
          useValue: {
            findAll: jest.fn(),
            findById: jest.fn(),
            create: jest.fn(),
            checkMinimumWorkers: jest.fn(),
            getProfessionsNeedingWorkers: jest.fn(),
            getProfessionsWithExcess: jest.fn(),
          },
        },
        {
          provide: AssignmentsService,
          useValue: {
            create: jest.fn(),
            findActive: jest.fn(),
            end: jest.fn(),
          },
        },
        {
          provide: ProductionService,
          useValue: {
            calculateDailyProduction: jest.fn(),
            calculateDailyConsumption: jest.fn(),
            calculateDailyBalance: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(UsersService);
    userAccountRepo = module.get(getRepositoryToken(UserAccount));
    userAssetRepo = module.get(getRepositoryToken(UserAsset));
    personsService = module.get(PersonsService);
    professionsService = module.get(ProfessionsService);
    assignmentsService = module.get(AssignmentsService);
    productionService = module.get(ProductionService);
    personAchievementRepo = module.get(getRepositoryToken(PersonAchievement));
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  it("should find a user by id with relations", async () => {
    const user = { id: 1 } as UserAccount;
    userAccountRepo.findOne.mockResolvedValueOnce(user);

    const result = await service.findUserById(1);

    expect(result).toBe(user);
    expect(userAccountRepo.findOne).toHaveBeenCalledWith({
      where: { id: 1 },
      relations: ["role", "person", "person.profession", "camp"],
    });
  });

  it("should find a user by username with relations", async () => {
    const user = { id: 2, username: "survivor" } as UserAccount;
    userAccountRepo.findOne.mockResolvedValueOnce(user);

    const result = await service.findUserByUsername("survivor");

    expect(result).toBe(user);
    expect(userAccountRepo.findOne).toHaveBeenCalledWith({
      where: { username: "survivor" },
      relations: ["role", "person", "person.profession", "camp"],
    });
  });

  it("should return null if user by username not found", async () => {
    userAccountRepo.findOne.mockResolvedValue(null);
    const res = await service.findUserByUsername("ghost");
    expect(res).toBeNull();
  });

  describe("updateUserAvatar", () => {
    it("should update user avatar with public id", async () => {
      userAccountRepo.update.mockResolvedValue({ affected: 1 } as any);
      const res = await service.updateUserAvatar(
        1,
        "http://avatar.com",
        "public123",
      );
      expect(userAccountRepo.update).toHaveBeenCalledWith(1, {
        avatar_url: "http://avatar.com",
        avatar_public_id: "public123",
      });
      expect(res).toEqual({
        avatar_url: "http://avatar.com",
        avatar_public_id: "public123",
      });
    });

    it("should update user avatar without public id", async () => {
      userAccountRepo.update.mockResolvedValue({ affected: 1 } as any);
      const res = await service.updateUserAvatar(1, "http://avatar.com", null);
      expect(userAccountRepo.update).toHaveBeenCalledWith(1, {
        avatar_url: "http://avatar.com",
      });
      expect(res).toEqual({
        avatar_url: "http://avatar.com",
        avatar_public_id: null,
      });
    });
  });

  it("should delegate findAllPersons using default pagination values", async () => {
    const response = {
      data: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0,
    };
    personsService.findAll.mockResolvedValueOnce(response as any);

    await expect(service.findAllPersons()).resolves.toEqual(response);
    expect(personsService.findAll).toHaveBeenCalledWith(
      undefined,
      1,
      20,
      undefined,
    );
  });

  it("should delegate person operations", async () => {
    const person = { id: 10 } as any;
    const dto = { first_name: "Ana", last_name: "Test" } as any;
    personsService.create.mockResolvedValueOnce(person);
    personsService.findAll.mockResolvedValueOnce({
      data: [person],
      total: 1,
      page: 2,
      limit: 5,
      totalPages: 1,
    });
    personsService.findById.mockResolvedValueOnce(person);
    personsService.update.mockResolvedValueOnce(person);
    personsService.updateStatus.mockResolvedValueOnce(person);
    personsService.delete.mockResolvedValueOnce(undefined);
    personsService.getStatsByStatus.mockResolvedValueOnce([
      { status: "active", count: 1 },
    ]);
    personsService.getStatsByProfession.mockResolvedValueOnce([
      { professionName: "Medico", total: 1, active: 1, inactive: 0 },
    ]);

    await expect(service.createPerson(dto)).resolves.toBe(person);
    await expect(service.findAllPersons(1, 2, 5, "ana")).resolves.toEqual({
      data: [person],
      total: 1,
      page: 2,
      limit: 5,
      totalPages: 1,
    });
    await expect(service.findPersonById(10)).resolves.toBe(person);
    await expect(service.updatePerson(10, dto)).resolves.toBe(person);
    await expect(
      service.updatePersonStatus(10, { status: "sick" } as any),
    ).resolves.toBe(person);
    await expect(service.deletePerson(10)).resolves.toBeUndefined();
    await expect(service.getPersonStatsByStatus(1)).resolves.toEqual([
      { status: "active", count: 1 },
    ]);
    await expect(service.getPersonStatsByProfession(1)).resolves.toEqual([
      { professionName: "Medico", total: 1, active: 1, inactive: 0 },
    ]);

    expect(personsService.create).toHaveBeenCalledWith(dto);
    expect(personsService.findAll).toHaveBeenCalledWith(1, 2, 5, "ana");
    expect(personsService.findById).toHaveBeenCalledWith(10);
    expect(personsService.update).toHaveBeenCalledWith(10, dto);
    expect(personsService.updateStatus).toHaveBeenCalledWith(10, {
      status: "sick",
    });
    expect(personsService.delete).toHaveBeenCalledWith(10);
    expect(personsService.getStatsByStatus).toHaveBeenCalledWith(1);
    expect(personsService.getStatsByProfession).toHaveBeenCalledWith(1);
  });

  it("should delegate profession operations", async () => {
    const profession = { id: 3, name: "Guardia" } as any;
    const createDto = {
      name: "Guardia",
      can_explore: false,
      minimum_active_required: 2,
    };
    const minimumResult = {
      needsWorkers: true,
      currentWorkers: 1,
      minimumRequired: 2,
    };
    const needingWorkers = [
      {
        profession,
        currentWorkers: 1,
        minimumRequired: 2,
        deficit: 1,
      },
    ];
    const withExcess = [
      {
        profession,
        currentWorkers: 4,
        minimumRequired: 2,
        excess: 2,
      },
    ];

    professionsService.findAll.mockResolvedValueOnce([profession]);
    professionsService.findById.mockResolvedValueOnce(profession);
    professionsService.create.mockResolvedValueOnce(profession);
    professionsService.checkMinimumWorkers.mockResolvedValueOnce(minimumResult);
    professionsService.getProfessionsNeedingWorkers.mockResolvedValueOnce(
      needingWorkers,
    );
    professionsService.getProfessionsWithExcess.mockResolvedValueOnce(
      withExcess,
    );

    await expect(service.findAllProfessions()).resolves.toEqual([profession]);
    await expect(service.findProfessionById(3)).resolves.toBe(profession);
    await expect(service.createProfession(createDto)).resolves.toBe(profession);
    await expect(service.checkProfessionMinimumWorkers(3, 9)).resolves.toEqual(
      minimumResult,
    );
    await expect(service.getProfessionsNeedingWorkers()).resolves.toEqual(
      needingWorkers,
    );
    await expect(service.getProfessionsWithExcess()).resolves.toEqual(
      withExcess,
    );
  });

  it("should delegate temporary assignments and production operations", async () => {
    const assignment = { id: 6 } as any;
    const activeAssignments = [assignment];
    const createDto = { person_id: 3, profession_temporary_id: 4 } as any;
    const production = {
      totalFood: 10,
      totalWater: 5,
      byProfession: [],
    };
    const consumption = { totalFood: 8, totalWater: 6, totalPersons: 2 };
    const balance = {
      production: { food: 10, water: 5 },
      consumption: { food: 8, water: 6 },
      balance: { food: 2, water: -1 },
      persons: 2,
    };

    assignmentsService.create.mockResolvedValueOnce(assignment);
    assignmentsService.findActive.mockResolvedValueOnce(activeAssignments);
    assignmentsService.end.mockResolvedValueOnce(assignment);
    productionService.calculateDailyProduction.mockResolvedValueOnce(
      production,
    );
    productionService.calculateDailyConsumption.mockResolvedValueOnce(
      consumption,
    );
    productionService.calculateDailyBalance.mockResolvedValueOnce(balance);

    await expect(
      service.createTemporaryAssignment(createDto, 77),
    ).resolves.toBe(assignment);
    await expect(service.getActiveTemporaryAssignments(9)).resolves.toEqual(
      activeAssignments,
    );
    await expect(service.endTemporaryAssignment(6)).resolves.toBe(assignment);
    await expect(service.calculateDailyProduction(1)).resolves.toEqual(
      production,
    );
    await expect(service.calculateDailyConsumption(1)).resolves.toEqual(
      consumption,
    );
    await expect(service.calculateDailyBalance(1)).resolves.toEqual(balance);
  });

  it("should return assigned resources ordered by acquired date", async () => {
    const resources = [{ id: 1 }] as UserAsset[];
    userAssetRepo.find.mockResolvedValueOnce(resources);

    const result = await service.getAssignedResourcesByUser(12);

    expect(result).toBe(resources);
    expect(userAssetRepo.find).toHaveBeenCalledWith({
      where: { user_account_id: 12, relation_type: "assigned" },
      relations: ["asset"],
      order: { acquired_at: "DESC" },
    });
  });

  it("should list all active assets without type filter", async () => {
    const assets = [{ id: 1, active: true }] as Asset[];
    userAssetRepo.manager.find.mockResolvedValueOnce(assets);

    const result = await service.getAllAssets();

    expect(result).toBe(assets);
    expect(userAssetRepo.manager.find).toHaveBeenCalledWith(Asset, {
      where: { active: true },
      order: { rarity: "ASC" },
    });
  });

  it("should list all active assets by type", async () => {
    const assets = [{ id: 2, asset_type: "badge" }] as Asset[];
    userAssetRepo.manager.find.mockResolvedValueOnce(assets);

    const result = await service.getAllAssets("badge");

    expect(result).toBe(assets);
    expect(userAssetRepo.manager.find).toHaveBeenCalledWith(Asset, {
      where: { active: true, asset_type: "badge" },
      order: { rarity: "ASC" },
    });
  });

  it("should return user badges ordered by acquired date", async () => {
    const badges = [{ id: 4 }] as UserAsset[];
    userAssetRepo.find.mockResolvedValueOnce(badges);

    const result = await service.getMyBadges(20);

    expect(result).toBe(badges);
    expect(userAssetRepo.find).toHaveBeenCalledWith({
      where: { user_account_id: 20, relation_type: "badge" },
      relations: ["asset"],
      order: { acquired_at: "DESC" },
    });
  });

  it("should toggle badge display when badge belongs to user", async () => {
    const badge = {
      id: 8,
      user_account_id: 10,
      relation_type: "badge",
      is_displayed: false,
    } as UserAsset;
    const updatedBadge = { ...badge, is_displayed: true } as UserAsset;

    userAssetRepo.findOne.mockResolvedValueOnce(badge);
    userAssetRepo.save.mockResolvedValueOnce(updatedBadge);

    const result = await service.toggleBadgeDisplay(10, 8, true);

    expect(result).toEqual(updatedBadge);
    expect(userAssetRepo.findOne).toHaveBeenCalledWith({
      where: { user_account_id: 10, id: 8, relation_type: "badge" },
      relations: ["asset"],
    });
    expect(userAssetRepo.save).toHaveBeenCalledWith({
      ...badge,
      is_displayed: true,
    });
  });

  it("should throw when toggling a badge that does not belong to the user", async () => {
    userAssetRepo.findOne.mockResolvedValueOnce(null);

    await expect(service.toggleBadgeDisplay(10, 999, true)).rejects.toThrow(
      new NotFoundException(
        "Badge no encontrado o no pertenece a este usuario",
      ),
    );
  });

  it("should award first login achievement if not already awarded", async () => {
    userAccountRepo.findOne.mockResolvedValueOnce({
      id: 1,
      person_id: "100",
    } as unknown as UserAccount);
    personAchievementRepo.findOne.mockResolvedValueOnce(null);
    personAchievementRepo.create.mockReturnValueOnce({} as PersonAchievement);
    personAchievementRepo.save.mockResolvedValueOnce({} as PersonAchievement);

    const result = await service.awardFirstLoginAchievement(1);
    expect(result).toEqual({ awarded: true });
    expect(personAchievementRepo.save).toHaveBeenCalled();
  });

  it("should not award first login achievement if already awarded", async () => {
    userAccountRepo.findOne.mockResolvedValueOnce({
      id: 1,
      person_id: "100",
    } as unknown as UserAccount);
    personAchievementRepo.findOne.mockResolvedValueOnce({
      id: 99,
    } as PersonAchievement);

    const result = await service.awardFirstLoginAchievement(1);
    expect(result).toEqual({ awarded: false });
    expect(personAchievementRepo.save).not.toHaveBeenCalled();
  });

  it("should not award first login achievement if user has no person_id", async () => {
    userAccountRepo.findOne.mockResolvedValueOnce({
      id: 1,
    } as unknown as UserAccount);

    const result = await service.awardFirstLoginAchievement(1);
    expect(result).toEqual({ awarded: false });
  });

  it("should return my achievements", async () => {
    userAccountRepo.findOne.mockResolvedValueOnce({
      id: 1,
      person_id: "100",
    } as unknown as UserAccount);
    const achievements = [{ id: 1 }] as PersonAchievement[];
    personAchievementRepo.find.mockResolvedValueOnce(achievements);

    const result = await service.getMyAchievements(1);
    expect(result).toBe(achievements);
    expect(personAchievementRepo.find).toHaveBeenCalledWith({
      where: { person_id: 100 },
      order: { obtained_at: "ASC" },
    });
  });

  it("should return empty array for achievements if no person_id", async () => {
    userAccountRepo.findOne.mockResolvedValueOnce({
      id: 1,
    } as unknown as UserAccount);

    const result = await service.getMyAchievements(1);
    expect(result).toEqual([]);
  });
});
