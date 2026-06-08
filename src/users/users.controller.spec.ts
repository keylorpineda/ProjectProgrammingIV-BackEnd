import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

describe("UsersController", () => {
  let controller: UsersController;
  let usersService: jest.Mocked<UsersService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: {
            findAllPersons: jest.fn(),
            findPersonById: jest.fn(),
            createPerson: jest.fn(),
            updatePerson: jest.fn(),
            updatePersonStatus: jest.fn(),
            deletePerson: jest.fn(),
            getPersonStatsByStatus: jest.fn(),
            getPersonStatsByProfession: jest.fn(),
            findAllProfessions: jest.fn(),
            findProfessionById: jest.fn(),
            createProfession: jest.fn(),
            getProfessionsNeedingWorkers: jest.fn(),
            getProfessionsWithExcess: jest.fn(),
            createTemporaryAssignment: jest.fn(),
            getActiveTemporaryAssignments: jest.fn(),
            endTemporaryAssignment: jest.fn(),
            calculateDailyProduction: jest.fn(),
            calculateDailyConsumption: jest.fn(),
            calculateDailyBalance: jest.fn(),
            getAssignedResourcesByUser: jest.fn(),
            getAllAssets: jest.fn(),
            getMyBadges: jest.fn(),
            toggleBadgeDisplay: jest.fn(),
            updateUserAvatar: jest.fn(),
            findUserById: jest.fn(),
            getMyAchievements: jest.fn(),
            awardFirstLoginAchievement: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(UsersController);
    usersService = module.get(UsersService);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  it("should get all persons parsing optional query params", async () => {
    const response = { data: [], total: 0, page: 3, limit: 15, totalPages: 0 };
    usersService.findAllPersons.mockResolvedValueOnce(response as any);

    await expect(
      controller.getAllPersons("7", "3", "15", "juan"),
    ).resolves.toEqual(response);
    expect(usersService.findAllPersons).toHaveBeenCalledWith(7, 3, 15, "juan");
  });

  it("should get all persons using defaults when query params are absent", async () => {
    const response = { data: [], total: 0, page: 1, limit: 20, totalPages: 0 };
    usersService.findAllPersons.mockResolvedValueOnce(response as any);

    await expect(controller.getAllPersons()).resolves.toEqual(response);
    expect(usersService.findAllPersons).toHaveBeenCalledWith(
      undefined,
      1,
      20,
      undefined,
    );
  });

  it("should proxy person endpoints", async () => {
    const person = { id: 4 };
    const dto = { first_name: "Lia" } as any;
    usersService.findPersonById.mockResolvedValueOnce(person as any);
    usersService.createPerson.mockResolvedValueOnce(person as any);
    usersService.updatePerson.mockResolvedValueOnce(person as any);
    usersService.updatePersonStatus.mockResolvedValueOnce(person as any);
    usersService.deletePerson.mockResolvedValueOnce(undefined);

    await expect(controller.getPersonById(4)).resolves.toEqual(person);
    await expect(controller.createPerson(dto)).resolves.toEqual(person);
    await expect(controller.updatePerson(4, dto)).resolves.toEqual(person);
    await expect(
      controller.updatePersonStatus(4, { status: "active" } as any),
    ).resolves.toEqual(person);
    await expect(controller.deletePerson(4)).resolves.toBeUndefined();
  });

  it("should proxy person stats endpoints with parsed campId", async () => {
    const byStatus = [{ status: "active", count: 2 }];
    const byProfession = [
      { professionName: "Guardia", total: 2, active: 2, inactive: 0 },
    ];
    usersService.getPersonStatsByStatus.mockResolvedValueOnce(byStatus as any);
    usersService.getPersonStatsByProfession.mockResolvedValueOnce(
      byProfession as any,
    );

    await expect(controller.getPersonStatsByStatus("11")).resolves.toEqual(
      byStatus,
    );
    await expect(controller.getPersonStatsByProfession("11")).resolves.toEqual(
      byProfession,
    );

    expect(usersService.getPersonStatsByStatus).toHaveBeenCalledWith(11);
    expect(usersService.getPersonStatsByProfession).toHaveBeenCalledWith(11);
  });

  it("should proxy profession stats without campId", async () => {
    const byProfession = [
      { professionName: "Guardia", total: 2, active: 2, inactive: 0 },
    ];
    usersService.getPersonStatsByProfession.mockResolvedValueOnce(
      byProfession as any,
    );

    await expect(controller.getPersonStatsByProfession()).resolves.toEqual(
      byProfession,
    );
    expect(usersService.getPersonStatsByProfession).toHaveBeenCalledWith(
      undefined,
    );
  });

  it("should proxy profession endpoints", async () => {
    const profession = { id: 5, name: "Explorador" };
    const dto = { name: "Explorador" } as any;
    usersService.findAllProfessions.mockResolvedValueOnce([profession] as any);
    usersService.findProfessionById.mockResolvedValueOnce(profession as any);
    usersService.createProfession.mockResolvedValueOnce(profession as any);
    usersService.getProfessionsNeedingWorkers.mockResolvedValueOnce([] as any);
    usersService.getProfessionsWithExcess.mockResolvedValueOnce([] as any);

    await expect(controller.getAllProfessions()).resolves.toEqual([profession]);
    await expect(controller.getProfessionById(5)).resolves.toEqual(profession);
    await expect(controller.createProfession(dto)).resolves.toEqual(profession);
    await expect(controller.getProfessionsNeedingWorkers()).resolves.toEqual(
      [],
    );
    await expect(controller.getProfessionsWithExcess()).resolves.toEqual([]);
  });

  it("should create and manage temporary assignments", async () => {
    const assignment = { id: 9 };
    const dto = { person_id: 2, profession_temporary_id: 3 } as any;
    usersService.createTemporaryAssignment.mockResolvedValueOnce(
      assignment as any,
    );
    usersService.getActiveTemporaryAssignments.mockResolvedValueOnce([
      assignment,
    ] as any);
    usersService.endTemporaryAssignment.mockResolvedValueOnce(
      assignment as any,
    );

    await expect(
      controller.createTemporaryAssignment(dto, { id: 44 }),
    ).resolves.toEqual(assignment);
    await expect(
      controller.getActiveTemporaryAssignments("8"),
    ).resolves.toEqual([assignment]);
    await expect(controller.endTemporaryAssignment(9)).resolves.toEqual(
      assignment,
    );

    expect(usersService.createTemporaryAssignment).toHaveBeenCalledWith(
      dto,
      44,
    );
    expect(usersService.getActiveTemporaryAssignments).toHaveBeenCalledWith(8);
  });

  it("should proxy production endpoints", async () => {
    const production = { totalFood: 1, totalWater: 2, byProfession: [] };
    const consumption = { totalFood: 3, totalWater: 4, totalPersons: 5 };
    const balance = {
      production: { food: 1, water: 2 },
      consumption: { food: 3, water: 4 },
      balance: { food: -2, water: -2 },
      persons: 5,
    };
    usersService.calculateDailyProduction.mockResolvedValueOnce(
      production as any,
    );
    usersService.calculateDailyConsumption.mockResolvedValueOnce(
      consumption as any,
    );
    usersService.calculateDailyBalance.mockResolvedValueOnce(balance as any);

    await expect(controller.getDailyProduction(1)).resolves.toEqual(production);
    await expect(controller.getDailyConsumption(1)).resolves.toEqual(
      consumption,
    );
    await expect(controller.getDailyBalance(1)).resolves.toEqual(balance);
  });

  it("should resolve current user id from userId first and then id", async () => {
    usersService.getAssignedResourcesByUser
      .mockResolvedValueOnce([] as any)
      .mockResolvedValueOnce([{ id: 2 }] as any);
    usersService.getMyBadges.mockResolvedValueOnce([] as any);
    usersService.toggleBadgeDisplay.mockResolvedValueOnce({ id: 1 } as any);

    await expect(
      controller.getMyAssignedResources({ userId: 12, id: 99 }),
    ).resolves.toEqual([]);
    await expect(
      controller.getMyAssignedResources({ id: 22 }),
    ).resolves.toEqual([{ id: 2 }]);
    await expect(controller.getMyBadges({ id: 13 })).resolves.toEqual([]);
    await expect(
      controller.toggleBadgeDisplay(3, true, { userId: 14 }),
    ).resolves.toEqual({ id: 1 });

    expect(usersService.getAssignedResourcesByUser).toHaveBeenNthCalledWith(
      1,
      12,
    );
    expect(usersService.getAssignedResourcesByUser).toHaveBeenNthCalledWith(
      2,
      22,
    );
    expect(usersService.getMyBadges).toHaveBeenCalledWith(13);
    expect(usersService.toggleBadgeDisplay).toHaveBeenCalledWith(14, 3, true);
  });

  it("should handle optional camp filter absence for status and assignment queries", async () => {
    usersService.getPersonStatsByStatus.mockResolvedValueOnce([] as any);
    usersService.getActiveTemporaryAssignments.mockResolvedValueOnce([] as any);
    usersService.toggleBadgeDisplay.mockResolvedValueOnce({ id: 2 } as any);

    await expect(controller.getPersonStatsByStatus()).resolves.toEqual([]);
    await expect(controller.getActiveTemporaryAssignments()).resolves.toEqual(
      [],
    );
    await expect(
      controller.toggleBadgeDisplay(4, false, { id: 21 }),
    ).resolves.toEqual({ id: 2 });

    expect(usersService.getPersonStatsByStatus).toHaveBeenCalledWith(undefined);
    expect(usersService.getActiveTemporaryAssignments).toHaveBeenCalledWith(
      undefined,
    );
    expect(usersService.toggleBadgeDisplay).toHaveBeenCalledWith(21, 4, false);
  });

  it("should proxy asset listing with optional type filter", async () => {
    const assets = [{ id: 1 }];
    usersService.getAllAssets.mockResolvedValueOnce(assets as any);

    await expect(controller.getAllAssets("badge")).resolves.toEqual(assets);
    expect(usersService.getAllAssets).toHaveBeenCalledWith("badge");
  });

  it("should test my endpoints correctly", async () => {
    const userResult = { id: 1 };
    usersService.updateUserAvatar.mockResolvedValue(userResult as any);
    usersService.findUserById.mockResolvedValue(userResult as any);
    usersService.getMyAchievements.mockResolvedValue([] as any);
    usersService.awardFirstLoginAchievement.mockResolvedValue({} as any);

    await expect(
      controller.updateMyAvatar({ userId: 1 }, { avatar_url: "url" }),
    ).resolves.toEqual(userResult);

    await expect(
      controller.updateMyAvatar(
        { userId: 1 },
        { avatar_url: "url", avatar_public_id: "pub" },
      ),
    ).resolves.toEqual(userResult);

    await expect(controller.getMe({ userId: 1 })).resolves.toEqual(userResult);

    // Testing getMyProfile with userId and id
    await expect(controller.getMyProfile({ userId: 1 })).resolves.toEqual(
      userResult,
    );
    await expect(controller.getMyProfile({ id: 2 })).resolves.toEqual(
      userResult,
    );

    await expect(controller.getMyAchievements({ userId: 1 })).resolves.toEqual(
      [],
    );
    await expect(controller.getMyAchievements({ id: 2 })).resolves.toEqual([]);

    await expect(
      controller.awardFirstLoginAchievement({ userId: 1 }),
    ).resolves.toEqual({});
    await expect(
      controller.awardFirstLoginAchievement({ id: 2 }),
    ).resolves.toEqual({});
  });
});
