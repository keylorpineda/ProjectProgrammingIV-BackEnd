import { validate } from "class-validator";
import * as bcrypt from "bcrypt";
import { getMetadataArgsStorage } from "typeorm";
import { Asset } from "./entities/asset.entity";
import { Person } from "./entities/person.entity";
import { Profession } from "./entities/profession.entity";
import { Role } from "./entities/role.entity";
import { TemporaryAssignment } from "./entities/temporary-assignment.entity";
import { UserAccount } from "./entities/user-account.entity";
import { UserAsset } from "./entities/user-asset.entity";
import {
  DAILY_CONSUMPTION,
  NON_WORKING_STATUSES,
  PersonStatus,
  PROFESSIONS_CONFIG,
  TEMPORARY_ASSIGNMENT_CONFIG,
  WORKING_STATUSES,
} from "./constants/professions.constants";
import {
  getRolePermissions,
  roleHasPermission,
  ROLES_CONFIG,
  UserRole,
} from "./constants/roles.constants";
import { CreatePersonDto } from "./dto/create-person.dto";
import { CreateProfessionDto } from "./dto/create-profession.dto";
import { CreateTemporaryAssignmentDto } from "./dto/create-temporary-assignment.dto";
import { CreateUserAccountDto } from "./dto/create-user-account.dto";
import { UpdatePersonDto } from "./dto/update-person.dto";
import { UpdatePersonStatusDto } from "./dto/update-person-status.dto";
import { ApproveTemporaryAssignmentDto } from "./dto/approve-temporary-assignment.dto";
import { ProfessionsSeeder } from "./seeders/professions.seeder";
import { RolesSeeder } from "./seeders/roles.seeder";
import { AdminSeeder } from "./seeders/admin.seeder";
import { AiAdmission } from "../ai/entities/ai-admission.entity";
import { Camp } from "../camps/entities/camp.entity";
import { Session } from "../auth/entities/session.entity";

describe("Users support files", () => {
  describe("constants", () => {
    it("should expose profession and assignment configuration", () => {
      expect(PersonStatus.ACTIVE).toBe("active");
      expect(PROFESSIONS_CONFIG.RECOLECTOR.daily_food_production).toBe(10);
      expect(DAILY_CONSUMPTION).toEqual({
        FOOD_PER_PERSON: 2,
        WATER_PER_PERSON: 3,
      });
      expect(TEMPORARY_ASSIGNMENT_CONFIG).toEqual({
        DEFAULT_DURATION_DAYS: 7,
        MAX_DURATION_DAYS: 30,
        MIN_DURATION_DAYS: 1,
      });
      expect(WORKING_STATUSES).toEqual([PersonStatus.ACTIVE]);
      expect(NON_WORKING_STATUSES).toContain(PersonStatus.SICK);
      expect(NON_WORKING_STATUSES).toContain(PersonStatus.OUT_OF_CAMP);
    });

    it("should expose role permissions helpers", () => {
      expect(ROLES_CONFIG[UserRole.ADMIN].permissions).toContain(
        "view_all_camps",
      );
      expect(roleHasPermission(UserRole.ADMIN, "manage_admissions")).toBe(true);
      expect(roleHasPermission(UserRole.WORKER, "manage_admissions")).toBe(
        false,
      );
      expect(
        roleHasPermission("unknown" as UserRole, "manage_admissions"),
      ).toBe(false);
      expect(getRolePermissions(UserRole.RESOURCE_MANAGER)).toContain(
        "manage_inventory",
      );
      expect(getRolePermissions("unknown" as UserRole)).toEqual([]);
    });
  });

  describe("dto validation", () => {
    it("should validate create person dto", async () => {
      const dto = Object.assign(new CreatePersonDto(), {
        profession_id: 1,
        first_name: "Ana",
        last_name: "Doe",
        birth_date: "2026-03-20",
      });

      await expect(validate(dto)).resolves.toHaveLength(0);
    });

    it("should validate create profession dto minimum", async () => {
      const dto = Object.assign(new CreateProfessionDto(), {
        name: "Guardia",
        minimum_active_required: 0,
      });

      const errors = await validate(dto);
      expect(errors).not.toHaveLength(0);
    });

    it("should validate create temporary assignment dto boundaries", async () => {
      const dto = Object.assign(new CreateTemporaryAssignmentDto(), {
        person_id: 1,
        profession_temporary_id: 2,
        duration_days: 31,
      });

      const errors = await validate(dto);
      expect(errors).not.toHaveLength(0);
    });

    it("should validate create user account dto fields", async () => {
      const dto = Object.assign(new CreateUserAccountDto(), {
        camp_id: 1,
        person_id: 2,
        username: "user",
        email: "bad-email",
        password: "123",
      });

      const errors = await validate(dto);
      expect(errors).not.toHaveLength(0);
    });

    it("should validate update person dto", async () => {
      const dto = Object.assign(new UpdatePersonDto(), {
        experience_level: 3,
        can_work: true,
      });

      await expect(validate(dto)).resolves.toHaveLength(0);
    });

    it("should validate update person status dto enum", async () => {
      const validDto = Object.assign(new UpdatePersonStatusDto(), {
        status: PersonStatus.ACTIVE,
      });
      const invalidDto = Object.assign(new UpdatePersonStatusDto(), {
        status: "invalid",
      });

      await expect(validate(validDto)).resolves.toHaveLength(0);
      await expect(validate(invalidDto)).resolves.not.toHaveLength(0);
    });

    it("should validate approve temporary assignment dto", async () => {
      const dto = Object.assign(new ApproveTemporaryAssignmentDto(), {
        assignment_id: 99,
      });

      await expect(validate(dto)).resolves.toHaveLength(0);
    });
  });

  describe("entities", () => {
    it("should register TypeORM relation metadata for user entities", () => {
      type EntityConstructor = new (...args: unknown[]) => unknown;
      const relations = getMetadataArgsStorage().relations;
      const findRelation = (target: EntityConstructor, propertyName: string) =>
        relations.find(
          (relation) =>
            relation.target === target &&
            relation.propertyName === propertyName,
        );
      const resolveRelationType = (
        target: EntityConstructor,
        propertyName: string,
      ) => {
        const relationType = findRelation(target, propertyName)?.type as
          | (() => unknown)
          | undefined;
        return relationType?.();
      };
      const resolveInverseRelation = (
        target: EntityConstructor,
        propertyName: string,
        mockEntity: Record<string, unknown>,
      ) => {
        const inverse = findRelation(target, propertyName)
          ?.inverseSideProperty as
          | ((value: Record<string, unknown>) => unknown)
          | undefined;
        return inverse?.(mockEntity);
      };

      expect(resolveRelationType(Person, "profession")).toBe(Profession);
      expect(
        resolveInverseRelation(Person, "profession", { persons: "persons" }),
      ).toBe("persons");
      expect(resolveRelationType(Person, "userAccount")).toBe(UserAccount);
      expect(
        resolveInverseRelation(Person, "userAccount", { person: "person" }),
      ).toBe("person");
      expect(resolveRelationType(Person, "aiAdmissions")).toBe(AiAdmission);
      expect(
        resolveInverseRelation(Person, "aiAdmissions", { person: "person" }),
      ).toBe("person");

      expect(resolveRelationType(Profession, "persons")).toBe(Person);
      expect(
        resolveInverseRelation(Profession, "persons", {
          profession: "profession",
        }),
      ).toBe("profession");
      expect(resolveRelationType(Profession, "originAssignments")).toBe(
        TemporaryAssignment,
      );
      expect(
        resolveInverseRelation(Profession, "originAssignments", {
          professionOrigin: "professionOrigin",
        }),
      ).toBe("professionOrigin");
      expect(resolveRelationType(Profession, "temporaryAssignments")).toBe(
        TemporaryAssignment,
      );
      expect(
        resolveInverseRelation(Profession, "temporaryAssignments", {
          professionTemporary: "professionTemporary",
        }),
      ).toBe("professionTemporary");

      expect(resolveRelationType(TemporaryAssignment, "userAccount")).toBe(
        UserAccount,
      );
      expect(
        resolveInverseRelation(TemporaryAssignment, "userAccount", {
          approvedAssignments: "approvedAssignments",
        }),
      ).toBe("approvedAssignments");
      expect(resolveRelationType(TemporaryAssignment, "professionOrigin")).toBe(
        Profession,
      );
      expect(
        resolveInverseRelation(TemporaryAssignment, "professionOrigin", {
          originAssignments: "originAssignments",
        }),
      ).toBe("originAssignments");
      expect(
        resolveRelationType(TemporaryAssignment, "professionTemporary"),
      ).toBe(Profession);
      expect(
        resolveInverseRelation(TemporaryAssignment, "professionTemporary", {
          temporaryAssignments: "temporaryAssignments",
        }),
      ).toBe("temporaryAssignments");
      expect(resolveRelationType(TemporaryAssignment, "userApprove")).toBe(
        UserAccount,
      );

      expect(resolveRelationType(UserAccount, "camp")).toBe(Camp);
      expect(
        resolveInverseRelation(UserAccount, "camp", {
          userAccounts: "userAccounts",
        }),
      ).toBe("userAccounts");
      expect(resolveRelationType(UserAccount, "person")).toBe(Person);
      expect(
        resolveInverseRelation(UserAccount, "person", {
          userAccount: "userAccount",
        }),
      ).toBe("userAccount");
      expect(resolveRelationType(UserAccount, "role")).toBe(Role);
      expect(resolveRelationType(UserAccount, "sessions")).toBe(Session);
      expect(
        resolveInverseRelation(UserAccount, "sessions", { user: "user" }),
      ).toBe("user");
      expect(resolveRelationType(UserAccount, "approvedAssignments")).toBe(
        TemporaryAssignment,
      );
      expect(
        resolveInverseRelation(UserAccount, "approvedAssignments", {
          userApprove: "userApprove",
        }),
      ).toBe("userApprove");
      expect(resolveRelationType(UserAccount, "userAssets")).toBe(UserAsset);
      expect(
        resolveInverseRelation(UserAccount, "userAssets", {
          userAccount: "userAccount",
        }),
      ).toBe("userAccount");

      expect(resolveRelationType(UserAsset, "userAccount")).toBe(UserAccount);
      expect(
        resolveInverseRelation(UserAsset, "userAccount", {
          userAssets: "userAssets",
        }),
      ).toBe("userAssets");
      expect(resolveRelationType(UserAsset, "asset")).toBe(Asset);
    });

    it("should instantiate all user entities", () => {
      const asset = Object.assign(new Asset(), {
        id: 1,
        name: "Badge",
        asset_type: "badge",
        url: "https://example.com",
        public_id: "badge-1",
        active: true,
      });
      const profession = Object.assign(new Profession(), {
        id: 2,
        name: "Guardia",
        can_explore: false,
        minimum_active_required: 2,
      });
      const role = Object.assign(new Role(), {
        id: 3,
        name: UserRole.ADMIN,
        description: "Admin",
      });
      const person = Object.assign(new Person(), {
        id: 4,
        profession_id: 2,
        first_name: "Ana",
        last_name: "Doe",
        can_work: true,
        profession,
      });
      const userAccount = Object.assign(new UserAccount(), {
        id: 5,
        username: "ana",
        email: "ana@example.com",
        password_hash: "hash",
        role,
        person,
      });
      const tempAssignment = Object.assign(new TemporaryAssignment(), {
        id: 6,
        user_account_id: 5,
        profession_origin_id: 2,
        profession_temporary_id: 8,
        start_date: new Date(),
        userAccount,
      });
      const userAsset = Object.assign(new UserAsset(), {
        id: 7,
        user_account_id: 5,
        asset_id: 1,
        relation_type: "badge",
        is_displayed: true,
        userAccount,
        asset,
      });

      expect(asset.name).toBe("Badge");
      expect(profession.name).toBe("Guardia");
      expect(role.name).toBe(UserRole.ADMIN);
      expect(person.profession).toBe(profession);
      expect(userAccount.person).toBe(person);
      expect(tempAssignment.userAccount).toBe(userAccount);
      expect(userAsset.asset).toBe(asset);
    });
  });

  describe("seeders", () => {
    it("should skip profession seeding when data already exists", async () => {
      const logger = {
        log: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };
      const professionRepo = {
        find: jest.fn().mockResolvedValueOnce([{ id: 1 }]),
        save: jest.fn(),
        delete: jest.fn(),
      };
      const seeder = new ProfessionsSeeder(professionRepo as any);
      Object.assign(seeder as any, { logger });

      await seeder.seedProfessions();

      expect(professionRepo.save).not.toHaveBeenCalled();
      expect(logger.log).toHaveBeenCalled();
    });

    it("should seed professions and reset them", async () => {
      const logger = {
        log: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };
      const professionRepo = {
        find: jest.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([]),
        save: jest
          .fn()
          .mockResolvedValue([
            { name: "Guardia", minimum_active_required: 2, can_explore: false },
          ]),
        delete: jest.fn().mockResolvedValueOnce(undefined),
      };
      const seeder = new ProfessionsSeeder(professionRepo as any);
      Object.assign(seeder as any, { logger });

      await seeder.seedProfessions();
      await seeder.resetProfessions();
      jest.spyOn(seeder, "seedProfessions").mockResolvedValueOnce(undefined);
      await seeder.onModuleInit();

      expect(professionRepo.save).toHaveBeenCalled();
      expect(professionRepo.delete).toHaveBeenCalledWith({});
      expect(logger.warn).toHaveBeenCalled();
    });

    it("should handle profession seeding errors on module init", async () => {
      const seeder = new ProfessionsSeeder({ find: jest.fn() } as any);
      const logger = { error: jest.fn(), log: jest.fn(), warn: jest.fn() };
      Object.assign(seeder as any, { logger });
      jest
        .spyOn(seeder, "seedProfessions")
        .mockRejectedValueOnce(new Error("boom"));

      await seeder.onModuleInit();

      expect(logger.error).toHaveBeenCalled();
    });

    it("should skip role seeding when roles already exist", async () => {
      const logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
      const roleRepo = {
        find: jest.fn().mockResolvedValueOnce([{ id: 1 }]),
        save: jest.fn(),
        delete: jest.fn(),
      };
      const seeder = new RolesSeeder(roleRepo as any);
      Object.assign(seeder as any, { logger });

      await seeder.seedRoles();

      expect(roleRepo.save).not.toHaveBeenCalled();
      expect(logger.log).toHaveBeenCalled();
    });

    it("should seed roles, reset them and handle init errors", async () => {
      const logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
      const roleRepo = {
        find: jest.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([]),
        save: jest
          .fn()
          .mockResolvedValue([{ name: "admin", description: "desc" }]),
        delete: jest.fn().mockResolvedValueOnce(undefined),
      };
      const seeder = new RolesSeeder(roleRepo as any);
      Object.assign(seeder as any, { logger });

      await seeder.seedRoles();
      await seeder.resetRoles();
      expect(roleRepo.save).toHaveBeenCalled();
      expect(roleRepo.delete).toHaveBeenCalledWith({});

      jest.spyOn(seeder, "seedRoles").mockRejectedValueOnce(new Error("boom"));
      await seeder.onModuleInit();

      expect(logger.error).toHaveBeenCalled();
    });

    it("should skip admin seeding when admin exists", async () => {
      const logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
      const userRepo = {
        findOne: jest.fn().mockResolvedValueOnce({ id: 1 }),
        create: jest.fn(),
        save: jest.fn(),
      };
      const roleRepo = { findOne: jest.fn() };
      const seeder = new AdminSeeder(userRepo as any, roleRepo as any);
      Object.assign(seeder as any, { logger });

      await seeder.seedAdmin();

      expect(userRepo.create).not.toHaveBeenCalled();
      expect(logger.log).toHaveBeenCalled();
    });

    it("should skip admin seeding when admin role is missing", async () => {
      const logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
      const userRepo = {
        findOne: jest.fn().mockResolvedValueOnce(null),
        create: jest.fn(),
        save: jest.fn(),
      };
      const roleRepo = { findOne: jest.fn().mockResolvedValueOnce(null) };
      const seeder = new AdminSeeder(userRepo as any, roleRepo as any);
      Object.assign(seeder as any, { logger });

      await seeder.seedAdmin();

      expect(logger.warn).toHaveBeenCalled();
      expect(userRepo.create).not.toHaveBeenCalled();
    });

    it("should seed admin and handle init errors", async () => {
      jest
        .spyOn(bcrypt, "hash")
        .mockResolvedValueOnce("hashed-password" as never);

      const logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
      const userRepo = {
        findOne: jest.fn().mockResolvedValueOnce(null),
        create: jest.fn().mockReturnValueOnce({ id: 1 }),
        save: jest.fn().mockResolvedValueOnce({ id: 1 }),
      };
      const roleRepo = {
        findOne: jest
          .fn()
          .mockResolvedValueOnce({ id: 9, name: UserRole.ADMIN }),
      };
      const seeder = new AdminSeeder(userRepo as any, roleRepo as any);
      Object.assign(seeder as any, { logger });

      await seeder.seedAdmin();
      jest.spyOn(seeder, "seedAdmin").mockRejectedValueOnce(new Error("boom"));
      await seeder.onModuleInit();

      expect(userRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          username: "admin",
          email: "admin@system.local",
          password_hash: "hashed-password",
          role_id: 9,
          last_access: expect.any(Date),
        }),
      );
      expect(userRepo.save).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalled();
    });
  });
});
