import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { ApprovalsService } from "./approvals.service";
import { getRepositoryToken } from "@nestjs/typeorm";
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { Approval } from "../entities/approval.entity";
import { IntercampRequest } from "../entities/intercamp-request.entity";
import { UserAccount } from "../../users/entities/user-account.entity";
import { AuditLog } from "../../common/entities/audit-log.entity";
import { REDIS_CLIENT } from "../../redis/redis.constants";
import { DataSource } from "typeorm";

describe("ApprovalsService", () => {
  let service: ApprovalsService;
  let userRepo: any;
  let requestRepo: any;
  let approvalRepo: any;
  let auditRepo: any;
  let managerSave: jest.Mock;

  beforeEach(async () => {
    userRepo = { findOne: jest.fn() };
    requestRepo = { save: jest.fn() };
    approvalRepo = {
      create: jest.fn().mockImplementation((dto) => dto),
      save: jest.fn(),
    };
    auditRepo = {
      create: jest.fn().mockImplementation((dto) => dto),
      save: jest.fn(),
    };
    // The transactional manager: create() echoes the dto, save() echoes the
    // entity. approveOrReject does all its writes through this manager.
    managerSave = jest.fn(async (entity) => entity);
    const managerMock = {
      create: jest.fn((_entity, dto) => dto),
      save: managerSave,
    };
    const dataSourceMock = {
      transaction: jest.fn(async (cb: any) => cb(managerMock)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApprovalsService,
        { provide: getRepositoryToken(UserAccount), useValue: userRepo },
        {
          provide: getRepositoryToken(IntercampRequest),
          useValue: requestRepo,
        },
        { provide: getRepositoryToken(Approval), useValue: approvalRepo },
        { provide: getRepositoryToken(AuditLog), useValue: auditRepo },
        { provide: DataSource, useValue: dataSourceMock },
        {
          provide: REDIS_CLIENT,
          useValue: { keys: jest.fn().mockResolvedValue([]), del: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<ApprovalsService>(ApprovalsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("approveOrReject", () => {
    it("should throw NotFoundException if user not found", async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(
        service.approveOrReject({} as any, 1, { status: "approved" }),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw ForbiddenException if user not from origin or destination camp", async () => {
      userRepo.findOne.mockResolvedValue({ id: 1, camp_id: 3 });
      const request = { camp_origin_id: 1, camp_destination_id: 2 } as any;

      await expect(
        service.approveOrReject(request, 1, { status: "approved" }),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should throw BadRequestException if user already approved", async () => {
      userRepo.findOne.mockResolvedValue({ id: 1, camp_id: 1 });
      const request = {
        camp_origin_id: 1,
        camp_destination_id: 2,
        approvals: [{ user_id: 1, status: "approved" }],
      } as any;

      await expect(
        service.approveOrReject(request, 1, { status: "approved" }),
      ).rejects.toThrow(BadRequestException);
    });

    it("should reject the request correctly", async () => {
      userRepo.findOne.mockResolvedValue({ id: 1, camp_id: 1 });
      const request = {
        id: 1,
        camp_origin_id: 1,
        camp_destination_id: 2,
        approvals: [],
      } as any;

      const res = await service.approveOrReject(request, 1, {
        status: "rejected",
        notes: "No way",
      });

      expect(res.bothApproved).toBe(false);
      expect(request.status).toBe("rejected");
      expect(managerSave).toHaveBeenCalledWith(request);
      // approval + request + audit all persisted through the transaction manager
      expect(managerSave).toHaveBeenCalledTimes(3);
    });

    it("should partially approve if other camp hasn't approved", async () => {
      userRepo.findOne.mockResolvedValue({ id: 1, camp_id: 1 });
      const request = {
        id: 1,
        camp_origin_id: 1,
        camp_destination_id: 2,
        approvals: [{ user_id: 2, status: "rejected", user: { camp_id: 2 } }],
      } as any;

      const res = await service.approveOrReject(request, 1, {
        status: "approved",
      });

      expect(res.bothApproved).toBe(false);
      // status hasn't changed to approved yet (only approval + audit persisted)
      expect(request.status).toBeUndefined();
      expect(managerSave).toHaveBeenCalledTimes(2);
    });

    it("should fully approve if other camp has approved", async () => {
      userRepo.findOne.mockResolvedValue({ id: 1, camp_id: 1 });
      const request = {
        id: 1,
        camp_origin_id: 1,
        camp_destination_id: 2,
        approvals: [{ user_id: 2, status: "approved", user: { camp_id: 2 } }],
      } as any;

      const res = await service.approveOrReject(request, 1, {
        status: "approved",
      });

      expect(res.bothApproved).toBe(true);
      expect(request.status).toBe("approved");
      expect(managerSave).toHaveBeenCalledWith(request);
      expect(managerSave).toHaveBeenCalledTimes(3);
    });

    it("should fully approve if destination user approves and origin already approved", async () => {
      userRepo.findOne.mockResolvedValue({ id: 1, camp_id: 2 }); // destination
      const request = {
        id: 1,
        camp_origin_id: 1,
        camp_destination_id: 2,
        approvals: [{ user_id: 2, status: "approved", user: { camp_id: 1 } }],
      } as any;

      const res = await service.approveOrReject(request, 1, {
        status: "approved",
      });

      expect(res.bothApproved).toBe(true);
      expect(request.status).toBe("approved");
    });
  });
});
