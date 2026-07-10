import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { TransferExecutionService } from "./transfer-execution.service";
import { getRepositoryToken } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { BadRequestException } from "@nestjs/common";
import { IntercampRequest } from "../entities/intercamp-request.entity";
import { Person } from "../../users/entities/person.entity";
import { UserAccount } from "../../users/entities/user-account.entity";
import { Inventory } from "../../resources/entities/inventory.entity";
import { InventoryMovement } from "../../resources/entities/inventory-movement.entity";
import { RequestResourceDetail } from "../entities/request-resource-detail.entity";
import { RequestPersonDetail } from "../entities/request-person-detail.entity";
import { AuditLog } from "../../common/entities/audit-log.entity";
import { REDIS_CLIENT } from "../../redis/redis.constants";

describe("TransferExecutionService", () => {
  let service: TransferExecutionService;
  let dataSource: any;
  let queryRunner: any;

  beforeEach(async () => {
    queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        findOne: jest.fn(),
        create: jest.fn(),
        save: jest.fn(),
      },
    };

    dataSource = {
      createQueryRunner: jest.fn().mockReturnValue(queryRunner),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransferExecutionService,
        { provide: DataSource, useValue: dataSource },
        { provide: getRepositoryToken(IntercampRequest), useValue: {} },
        { provide: getRepositoryToken(Person), useValue: {} },
        { provide: getRepositoryToken(UserAccount), useValue: {} },
        { provide: getRepositoryToken(Inventory), useValue: {} },
        { provide: getRepositoryToken(InventoryMovement), useValue: {} },
        { provide: getRepositoryToken(RequestResourceDetail), useValue: {} },
        { provide: getRepositoryToken(RequestPersonDetail), useValue: {} },
        { provide: getRepositoryToken(AuditLog), useValue: {} },
        {
          provide: REDIS_CLIENT,
          useValue: { keys: jest.fn().mockResolvedValue([]), del: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<TransferExecutionService>(TransferExecutionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("departTransfer", () => {
    it("should throw if status is not approved", async () => {
      const request = { status: "pending" } as any;
      await expect(service.departTransfer(request, 1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should process departure correctly", async () => {
      const request = {
        id: 1,
        status: "approved",
        camp_origin_id: 1,
        camp_destination_id: 2,
        travel_days: 2,
        resourceDetails: [{ resource_id: 1, requested_quantity: 10 }],
        personDetails: [{ person_id: 1, transfer_status: "pending" }],
      } as any;

      queryRunner.manager.findOne.mockImplementation(
        (entity: any, options: any) => {
          if (entity.name === "Inventory") {
            // Both generic resource and food/water
            return Promise.resolve({
              current_quantity: 100,
              minimum_stock_required: 10,
            });
          }
          if (entity.name === "Person") {
            return Promise.resolve({ id: 1, status: "active" });
          }
          if (entity.name === "Resource") {
            // Food or water resources
            return Promise.resolve({
              id: 10,
              category: options.where.category,
            });
          }
          return Promise.resolve(null);
        },
      );

      await service.departTransfer(request, 1);

      expect(queryRunner.startTransaction).toHaveBeenCalled();
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
    });

    it("should rollback on failure during departure", async () => {
      const request = {
        id: 1,
        status: "approved",
        camp_origin_id: 1,
        resourceDetails: [{ resource_id: 1, requested_quantity: 100 }], // Requires 100
      } as any;

      // Make inventory return less than requested to trigger exception
      queryRunner.manager.findOne.mockResolvedValue({ current_quantity: 50 });

      await expect(service.departTransfer(request, 1)).rejects.toThrow(
        BadRequestException,
      );
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
    });

    it("should fail if food/water rations are insufficient", async () => {
      const request = {
        id: 1,
        status: "approved",
        camp_origin_id: 1,
        travel_days: 2,
        resourceDetails: [],
        personDetails: [{ person_id: 1, transfer_status: "pending" }],
      } as any;

      queryRunner.manager.findOne.mockImplementation((entity: any) => {
        if (entity.name === "Resource") return Promise.resolve({ id: 1 });
        if (entity.name === "Inventory") return Promise.resolve(null); // No food/water
        if (entity.name === "Person") return Promise.resolve({ id: 1 });
        return Promise.resolve(null);
      });

      await expect(service.departTransfer(request, 1)).rejects.toThrow(
        "No hay suficiente comida para el viaje",
      );
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it("should fail if water is insufficient", async () => {
      const request = {
        id: 1,
        status: "approved",
        camp_origin_id: 1,
        travel_days: 2,
        resourceDetails: [],
        personDetails: [{ person_id: 1, transfer_status: "pending" }],
      } as any;

      queryRunner.manager.findOne.mockImplementation(
        (entity: any, options: any) => {
          if (entity.name === "Resource") {
            if (options.where.category === "food")
              return Promise.resolve({ id: 1 });
            if (options.where.category === "water")
              return Promise.resolve({ id: 2 });
          }
          if (entity.name === "Inventory") {
            if (options.where.resource_id === 1)
              return Promise.resolve({ current_quantity: 100 });
            if (options.where.resource_id === 2) return Promise.resolve(null); // No water
          }
          if (entity.name === "Person") return Promise.resolve({ id: 1 });
          return Promise.resolve(null);
        },
      );

      await expect(service.departTransfer(request, 1)).rejects.toThrow(
        "No hay suficiente agua para el viaje",
      );
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });
});
