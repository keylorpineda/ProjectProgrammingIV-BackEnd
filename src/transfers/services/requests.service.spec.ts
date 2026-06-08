import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { RequestsService } from "./requests.service";
import { getRepositoryToken } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { NotFoundException, BadRequestException } from "@nestjs/common";
import { IntercampRequest } from "../entities/intercamp-request.entity";
import { RequestResourceDetail } from "../entities/request-resource-detail.entity";
import { RequestPersonDetail } from "../entities/request-person-detail.entity";
import { Camp } from "../../camps/entities/camp.entity";
import { Person } from "../../users/entities/person.entity";
import { Inventory } from "../../resources/entities/inventory.entity";
import { Resource } from "../../resources/entities/resource.entity";
import { AuditLog } from "../../common/entities/audit-log.entity";
import { NotificationsGateway } from "../../notifications/notifications.gateway";
import { REDIS_CLIENT } from "../../redis/redis.constants";

describe("RequestsService", () => {
  let service: RequestsService;
  let requestRepo: any;
  let campRepo: any;
  let auditRepo: any;
  let dataSource: any;
  let queryRunner: any;
  let notificationsGateway: any;

  beforeEach(async () => {
    requestRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn().mockImplementation((dto) => dto),
      createQueryBuilder: jest.fn().mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([{ id: 1 }]),
      }),
    };

    campRepo = {
      findOne: jest.fn(),
    };

    auditRepo = {
      save: jest.fn().mockImplementation((dto) => dto),
      create: jest.fn().mockImplementation((dto) => dto),
    };

    queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        create: jest.fn().mockImplementation((entity, dto) => dto),
        save: jest
          .fn()
          .mockImplementation(async (entity, dto) => ({ ...dto, id: 1 })),
        findOne: jest.fn(),
      },
    };

    dataSource = {
      createQueryRunner: jest.fn().mockReturnValue(queryRunner),
    };

    notificationsGateway = {
      emitTransferRequest: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RequestsService,
        {
          provide: getRepositoryToken(IntercampRequest),
          useValue: requestRepo,
        },
        { provide: getRepositoryToken(RequestResourceDetail), useValue: {} },
        { provide: getRepositoryToken(RequestPersonDetail), useValue: {} },
        { provide: getRepositoryToken(Camp), useValue: campRepo },
        { provide: getRepositoryToken(Person), useValue: {} },
        { provide: getRepositoryToken(Inventory), useValue: {} },
        { provide: getRepositoryToken(Resource), useValue: {} },
        { provide: getRepositoryToken(AuditLog), useValue: auditRepo },
        { provide: DataSource, useValue: dataSource },
        { provide: NotificationsGateway, useValue: notificationsGateway },
        {
          provide: REDIS_CLIENT,
          useValue: { keys: jest.fn().mockResolvedValue([]), del: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<RequestsService>(RequestsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("createRequest", () => {
    const dtoBase = {
      camp_origin_id: 1,
      camp_destination_id: 2,
      type: "personnel",
      notes: "test",
      resource_details: [],
      person_details: [],
    };

    it("should throw BadRequest if camps are same", async () => {
      await expect(
        service.createRequest({ ...dtoBase, camp_destination_id: 1 } as any, 1),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw NotFound if camp missing", async () => {
      campRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 2 });
      await expect(service.createRequest(dtoBase as any, 1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should rollback and throw on error during transaction", async () => {
      campRepo.findOne.mockResolvedValue({ id: 1, name: "A" });
      queryRunner.manager.save.mockRejectedValueOnce(new Error("DB Error"));
      await expect(service.createRequest(dtoBase as any, 1)).rejects.toThrow(
        "DB Error",
      );
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
    });

    it("should throw if resource not found", async () => {
      campRepo.findOne.mockResolvedValue({ id: 1, name: "A" });
      queryRunner.manager.findOne.mockResolvedValue(null); // resource find
      await expect(
        service.createRequest(
          {
            ...dtoBase,
            resource_details: [{ resource_id: 1, requested_quantity: 10 }],
          } as any,
          1,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw if resource inventory missing", async () => {
      campRepo.findOne.mockResolvedValue({ id: 1, name: "A" });
      queryRunner.manager.findOne
        .mockResolvedValueOnce({ id: 1, name: "Water" }) // resource
        .mockResolvedValueOnce(null); // inventory null

      await expect(
        service.createRequest(
          {
            ...dtoBase,
            resource_details: [{ resource_id: 1, requested_quantity: 10 }],
          } as any,
          1,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw if resource inventory insufficient", async () => {
      campRepo.findOne.mockResolvedValue({ id: 1, name: "A" });
      queryRunner.manager.findOne
        .mockResolvedValueOnce({ id: 1, name: "Water" }) // resource
        .mockResolvedValueOnce({ current_quantity: 5 }); // inventory

      await expect(
        service.createRequest(
          {
            ...dtoBase,
            resource_details: [{ resource_id: 1, requested_quantity: 10 }],
          } as any,
          1,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw if person not found", async () => {
      campRepo.findOne.mockResolvedValue({ id: 1, name: "A" });
      queryRunner.manager.findOne.mockResolvedValue(null); // person find
      await expect(
        service.createRequest(
          { ...dtoBase, person_details: [{ person_id: 1 }] } as any,
          1,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw if person not in origin camp", async () => {
      campRepo.findOne.mockResolvedValue({ id: 1, name: "A" });
      queryRunner.manager.findOne.mockResolvedValue({
        id: 1,
        userAccount: { camp_id: 99 },
      }); // person find
      await expect(
        service.createRequest(
          { ...dtoBase, person_details: [{ person_id: 1 }] } as any,
          1,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("should create successfully with details", async () => {
      campRepo.findOne.mockResolvedValue({ id: 1, name: "A" });

      // Mock for resources
      queryRunner.manager.findOne
        .mockResolvedValueOnce({ id: 1, name: "Water" }) // Resource (resource details logic)
        .mockResolvedValueOnce({ current_quantity: 20 }) // Inventory (resource details logic)
        // Mock for persons
        .mockResolvedValueOnce({ id: 1, userAccount: { camp_id: 1 } }); // Person (person details logic)

      // Mock for findRequestById after transaction
      requestRepo.findOne.mockResolvedValue({
        id: 1,
        type: "mixed",
        request_date: new Date(),
      });

      const res = await service.createRequest(
        {
          ...dtoBase,
          resource_details: [{ resource_id: 1, requested_quantity: 10 }],
          person_details: [{ person_id: 1 }],
        } as any,
        1,
      );

      expect(res.id).toBe(1);
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(notificationsGateway.emitTransferRequest).toHaveBeenCalled();
    });
  });

  describe("findRequestById", () => {
    it("should throw NotFound if not found", async () => {
      requestRepo.findOne.mockResolvedValue(null);
      await expect(service.findRequestById(1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should return request", async () => {
      requestRepo.findOne.mockResolvedValue({ id: 1 });
      const res = await service.findRequestById(1);
      expect(res).toEqual({ id: 1 });
    });
  });

  describe("findRequestsByCamp", () => {
    it("should find as origin", async () => {
      await service.findRequestsByCamp(1, "origin");
      expect(requestRepo.createQueryBuilder().where).toHaveBeenCalledWith(
        "req.camp_origin_id = :campId",
        { campId: 1 },
      );
    });

    it("should find as destination", async () => {
      await service.findRequestsByCamp(1, "destination");
      expect(requestRepo.createQueryBuilder().where).toHaveBeenCalledWith(
        "req.camp_destination_id = :campId",
        { campId: 1 },
      );
    });

    it("should find as both", async () => {
      await service.findRequestsByCamp(1);
      expect(requestRepo.createQueryBuilder().where).toHaveBeenCalledWith(
        "(req.camp_origin_id = :campId OR req.camp_destination_id = :campId)",
        { campId: 1 },
      );
    });

    it("should filter by allowed status", async () => {
      await service.findRequestsByCamp(1, "origin", "pending");
      expect(requestRepo.createQueryBuilder().andWhere).toHaveBeenCalledWith(
        "req.status = :status",
        { status: "pending" },
      );
    });

    it("should throw on invalid status", async () => {
      await expect(
        service.findRequestsByCamp(1, "origin", "invalid"),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("findPendingRequestsByCamp", () => {
    it("should return pending requests", async () => {
      requestRepo.find.mockResolvedValue([{ id: 1 }]);
      const res = await service.findPendingRequestsByCamp(1);
      expect(res).toEqual([{ id: 1 }]);
    });
  });

  describe("cancelRequest", () => {
    it("should throw if not pending", async () => {
      jest
        .spyOn(service, "findRequestById")
        .mockResolvedValue({ id: 1, status: "approved" } as any);
      await expect(service.cancelRequest(1, 1, 1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should throw if userCampId is not origin", async () => {
      jest.spyOn(service, "findRequestById").mockResolvedValue({
        id: 1,
        status: "pending",
        camp_origin_id: 2,
      } as any);
      await expect(service.cancelRequest(1, 1, 1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should cancel and save audit", async () => {
      jest.spyOn(service, "findRequestById").mockResolvedValue({
        id: 1,
        status: "pending",
        camp_origin_id: 1,
      } as any);
      await service.cancelRequest(1, 2, 1);
      expect(requestRepo.save).toHaveBeenCalled();
      expect(auditRepo.save).toHaveBeenCalled();
    });
  });

  describe("getTransferStatistics", () => {
    it("should calculate statistics", async () => {
      requestRepo.find.mockResolvedValue([
        { status: "pending", camp_origin_id: 1, camp_destination_id: 2 },
        { status: "approved", camp_origin_id: 2, camp_destination_id: 1 },
      ]);

      const res = await service.getTransferStatistics(1);
      expect(res.totalRequests).toBe(2);
      expect(res.pending).toBe(1);
      expect(res.approved).toBe(1);
      expect(res.asOrigin).toBe(1);
      expect(res.asDestination).toBe(1);
    });
  });
});
