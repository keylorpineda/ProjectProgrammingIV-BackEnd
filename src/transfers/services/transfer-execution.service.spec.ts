import { BadRequestException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { TransferExecutionService } from "./transfer-execution.service";
import { IntercampRequest } from "../entities/intercamp-request.entity";
import { Person } from "../../users/entities/person.entity";
import { UserAccount } from "../../users/entities/user-account.entity";
import { Inventory } from "../../resources/entities/inventory.entity";
import { Resource } from "../../resources/entities/resource.entity";
import { InventoryMovement } from "../../resources/entities/inventory-movement.entity";
import { RequestResourceDetail } from "../entities/request-resource-detail.entity";
import { RequestPersonDetail } from "../entities/request-person-detail.entity";
import { AuditLog } from "../../common/entities/audit-log.entity";
import { PersonStatus } from "../../users/constants/professions.constants";

const createRepoMock = () => ({
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
});

const createQueryRunnerMock = () => ({
  connect: jest.fn().mockResolvedValue(undefined),
  startTransaction: jest.fn().mockResolvedValue(undefined),
  commitTransaction: jest.fn().mockResolvedValue(undefined),
  rollbackTransaction: jest.fn().mockResolvedValue(undefined),
  release: jest.fn().mockResolvedValue(undefined),
  manager: {
    create: jest.fn((_entity: unknown, value: unknown) => value),
    findOne: jest.fn(),
    save: jest.fn(async (_entity: unknown, value: unknown) => value),
  },
});

describe("TransferExecutionService", () => {
  let service: TransferExecutionService;
  let dataSource: { createQueryRunner: jest.Mock };
  let queryRunner: ReturnType<typeof createQueryRunnerMock>;

  beforeEach(async () => {
    queryRunner = createQueryRunnerMock();
    dataSource = { createQueryRunner: jest.fn(() => queryRunner) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransferExecutionService,
        {
          provide: getRepositoryToken(IntercampRequest),
          useValue: createRepoMock(),
        },
        { provide: getRepositoryToken(Person), useValue: createRepoMock() },
        {
          provide: getRepositoryToken(UserAccount),
          useValue: createRepoMock(),
        },
        { provide: getRepositoryToken(Inventory), useValue: createRepoMock() },
        {
          provide: getRepositoryToken(InventoryMovement),
          useValue: createRepoMock(),
        },
        {
          provide: getRepositoryToken(RequestResourceDetail),
          useValue: createRepoMock(),
        },
        {
          provide: getRepositoryToken(RequestPersonDetail),
          useValue: createRepoMock(),
        },
        { provide: getRepositoryToken(AuditLog), useValue: createRepoMock() },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get(TransferExecutionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  it("should reject departure when the request is not approved", async () => {
    await expect(
      service.departTransfer({ status: "pending" } as any, 7),
    ).rejects.toThrow(
      new BadRequestException(
        "La solicitud debe estar aprobada para poder salir",
      ),
    );
  });

  it("should depart transfer with resources, persons, and travel supplies", async () => {
    const request = {
      id: 1,
      status: "approved",
      camp_origin_id: 10,
      camp_destination_id: 20,
      travel_days: 2,
      resourceDetails: [
        {
          request_id: 1,
          resource_id: 30,
          requested_quantity: 4,
        },
      ],
      personDetails: [
        { request_id: 1, person_id: 40, transfer_status: "pending" },
      ],
    } as any;

    queryRunner.manager.findOne.mockImplementation(
      async (entity: unknown, options: any) => {
        if (entity === Inventory) {
          if (options.where.resource_id === 30) {
            return {
              camp_id: 10,
              resource_id: 30,
              current_quantity: 8,
              minimum_stock_required: 5,
              alert_active: false,
            };
          }
          if (options.where.resource_id === 101) {
            return {
              camp_id: 10,
              resource_id: 101,
              current_quantity: 20,
              minimum_stock_required: 2,
              alert_active: false,
            };
          }
          if (options.where.resource_id === 102) {
            return {
              camp_id: 10,
              resource_id: 102,
              current_quantity: 30,
              minimum_stock_required: 3,
              alert_active: false,
            };
          }
        }

        if (entity === Person) {
          return {
            id: 40,
            status: "active",
          };
        }

        if (entity === Resource && options.where.category === "food") {
          return { id: 101, category: "food" };
        }

        if (entity === Resource && options.where.category === "water") {
          return { id: 102, category: "water" };
        }

        return null;
      },
    );

    await service.departTransfer(request, 7);

    expect(queryRunner.manager.save).toHaveBeenCalledWith(
      Inventory,
      expect.objectContaining({
        camp_id: 10,
        resource_id: 30,
        current_quantity: 4,
        alert_active: true,
      }),
    );
    expect(queryRunner.manager.save).toHaveBeenCalledWith(
      Person,
      expect.objectContaining({
        id: 40,
        status: PersonStatus.TRAVELING,
      }),
    );
    expect(queryRunner.manager.save).toHaveBeenCalledWith(
      RequestPersonDetail,
      expect.objectContaining({
        transfer_status: "in_transit",
      }),
    );
    expect(queryRunner.manager.save).toHaveBeenCalledWith(
      InventoryMovement,
      expect.objectContaining({
        type: "transfer_out",
        camp_id: 10,
      }),
    );
    expect(queryRunner.manager.save).toHaveBeenCalledWith(
      IntercampRequest,
      expect.objectContaining({ status: "in_transit" }),
    );
    expect(queryRunner.manager.save).toHaveBeenCalledWith(
      AuditLog,
      expect.objectContaining({
        action: "intercamp_transfer_departed",
        camp_id: 10,
      }),
    );
    expect(queryRunner.commitTransaction).toHaveBeenCalled();
  });

  it("should rollback departure when origin resource is insufficient", async () => {
    const request = {
      id: 1,
      status: "approved",
      camp_origin_id: 10,
      resourceDetails: [
        {
          request_id: 1,
          resource_id: 30,
          requested_quantity: 9,
        },
      ],
      personDetails: [],
    } as any;

    queryRunner.manager.findOne.mockResolvedValueOnce({
      camp_id: 10,
      resource_id: 30,
      current_quantity: 8,
      minimum_stock_required: 5,
    });

    await expect(service.departTransfer(request, 7)).rejects.toThrow(
      new BadRequestException(
        "Recurso insuficiente en origen para recurso ID 30",
      ),
    );
    expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    expect(queryRunner.release).toHaveBeenCalled();
  });

  it("should rollback departure when travel food is insufficient", async () => {
    const request = {
      id: 1,
      status: "approved",
      camp_origin_id: 10,
      travel_days: 2,
      resourceDetails: [],
      personDetails: [{ person_id: 40, transfer_status: "pending" }],
    } as any;

    queryRunner.manager.findOne.mockImplementation(
      async (entity: unknown, options: any) => {
        if (entity === Person) {
          return { id: 40, status: "active" };
        }
        if (entity === Resource && options.where.category === "food") {
          return { id: 101, category: "food" };
        }
        if (entity === Resource && options.where.category === "water") {
          return null;
        }
        if (entity === Inventory && options.where.resource_id === 101) {
          return {
            camp_id: 10,
            resource_id: 101,
            current_quantity: 1,
            minimum_stock_required: 1,
          };
        }
        return null;
      },
    );

    await expect(service.departTransfer(request, 7)).rejects.toThrow(
      new BadRequestException("No hay suficiente comida para el viaje"),
    );
    expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
  });

  it("should rollback departure when travel water is insufficient", async () => {
    const request = {
      id: 1,
      status: "approved",
      camp_origin_id: 10,
      travel_days: 2,
      resourceDetails: [],
      personDetails: [{ person_id: 40, transfer_status: "pending" }],
    } as any;

    queryRunner.manager.findOne.mockImplementation(
      async (entity: unknown, options: any) => {
        if (entity === Person) {
          return { id: 40, status: "active" };
        }
        if (entity === Resource && options.where.category === "food") {
          return { id: 101, category: "food" };
        }
        if (entity === Resource && options.where.category === "water") {
          return { id: 102, category: "water" };
        }
        if (entity === Inventory && options.where.resource_id === 101) {
          return {
            camp_id: 10,
            resource_id: 101,
            current_quantity: 20,
            minimum_stock_required: 1,
          };
        }
        if (entity === Inventory && options.where.resource_id === 102) {
          return {
            camp_id: 10,
            resource_id: 102,
            current_quantity: 1,
            minimum_stock_required: 1,
          };
        }
        return null;
      },
    );

    await expect(service.departTransfer(request, 7)).rejects.toThrow(
      new BadRequestException("No hay suficiente agua para el viaje"),
    );
    expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
  });

  it("should reject arrival when request is not in transit", async () => {
    await expect(
      service.arriveTransfer({ status: "approved" } as any, 7),
    ).rejects.toThrow(
      new BadRequestException(
        "La solicitud debe estar en tránsito para poder recibirla",
      ),
    );
  });

  it("should arrive transfer and create destination inventory when missing", async () => {
    const request = {
      id: 1,
      status: "in_transit",
      camp_origin_id: 10,
      camp_destination_id: 20,
      travel_days: 3,
      resourceDetails: [{ resource_id: 30, requested_quantity: 4 }],
      personDetails: [{ person_id: 40, transfer_status: "in_transit" }],
    } as any;

    queryRunner.manager.findOne.mockImplementation(
      async (entity: unknown, options: any) => {
        if (entity === Inventory) {
          return null;
        }
        if (entity === Person) {
          return {
            id: 40,
            experience_level: 5,
            status: PersonStatus.TRAVELING,
            userAccount: { id: 2, camp_id: 10 },
          };
        }
        return null;
      },
    );

    await service.arriveTransfer(request, 7);

    expect(queryRunner.manager.create).toHaveBeenCalledWith(
      Inventory,
      expect.objectContaining({
        camp_id: 20,
        resource_id: 30,
      }),
    );
    expect(queryRunner.manager.save).toHaveBeenCalledWith(
      Inventory,
      expect.objectContaining({
        camp_id: 20,
        resource_id: 30,
        current_quantity: 4,
      }),
    );
    expect(queryRunner.manager.save).toHaveBeenCalledWith(
      UserAccount,
      expect.objectContaining({ camp_id: 20 }),
    );
    expect(queryRunner.manager.save).toHaveBeenCalledWith(
      Person,
      expect.objectContaining({
        status: PersonStatus.ACTIVE,
        experience_level: 35,
      }),
    );
    expect(queryRunner.manager.save).toHaveBeenCalledWith(
      RequestResourceDetail,
      expect.objectContaining({
        approved_quantity: 4,
        received_quantity: 4,
      }),
    );
    expect(queryRunner.manager.save).toHaveBeenCalledWith(
      RequestPersonDetail,
      expect.objectContaining({ transfer_status: "completed" }),
    );
    expect(queryRunner.manager.save).toHaveBeenCalledWith(
      IntercampRequest,
      expect.objectContaining({ status: "completed" }),
    );
    expect(queryRunner.manager.save).toHaveBeenCalledWith(
      AuditLog,
      expect.objectContaining({
        action: "intercamp_transfer_arrived",
        camp_id: 20,
      }),
    );
    expect(queryRunner.commitTransaction).toHaveBeenCalled();
  });

  it("should arrive transfer without user account update when person account is absent", async () => {
    const request = {
      id: 2,
      status: "in_transit",
      camp_origin_id: 10,
      camp_destination_id: 20,
      travel_days: 1,
      resourceDetails: [],
      personDetails: [{ person_id: 41, transfer_status: "in_transit" }],
    } as any;

    queryRunner.manager.findOne.mockImplementation(async (entity: unknown) => {
      if (entity === Person) {
        return {
          id: 41,
          experience_level: 0,
          status: PersonStatus.TRAVELING,
          userAccount: null,
        };
      }
      return null;
    });

    await service.arriveTransfer(request, 8);

    expect(queryRunner.manager.save).not.toHaveBeenCalledWith(
      UserAccount,
      expect.anything(),
    );
    expect(queryRunner.manager.save).toHaveBeenCalledWith(
      RequestPersonDetail,
      expect.objectContaining({ transfer_status: "completed" }),
    );
    expect(queryRunner.commitTransaction).toHaveBeenCalled();
  });

  it("should complete person detail update even when person record is missing on arrival", async () => {
    const request = {
      id: 4,
      status: "in_transit",
      camp_origin_id: 10,
      camp_destination_id: 20,
      travel_days: 1,
      resourceDetails: [],
      personDetails: [{ person_id: 999, transfer_status: "in_transit" }],
    } as any;

    queryRunner.manager.findOne.mockResolvedValue(null);

    await service.arriveTransfer(request, 10);

    expect(queryRunner.manager.save).toHaveBeenCalledWith(
      RequestPersonDetail,
      expect.objectContaining({ transfer_status: "completed" }),
    );
    expect(queryRunner.manager.save).toHaveBeenCalledWith(
      IntercampRequest,
      expect.objectContaining({ status: "completed" }),
    );
    expect(queryRunner.commitTransaction).toHaveBeenCalled();
  });

  it("should use default travel days for experience when travel_days is missing", async () => {
    const request = {
      id: 5,
      status: "in_transit",
      camp_origin_id: 10,
      camp_destination_id: 20,
      resourceDetails: [],
      personDetails: [{ person_id: 42, transfer_status: "in_transit" }],
    } as any;

    queryRunner.manager.findOne.mockResolvedValue({
      id: 42,
      experience_level: 5,
      status: PersonStatus.TRAVELING,
      userAccount: null,
    });

    await service.arriveTransfer(request, 11);

    expect(queryRunner.manager.save).toHaveBeenCalledWith(
      Person,
      expect.objectContaining({
        id: 42,
        experience_level: 15,
        status: PersonStatus.ACTIVE,
      }),
    );
    expect(queryRunner.commitTransaction).toHaveBeenCalled();
  });

  it("should rollback arrival transaction on persistence error", async () => {
    const request = {
      id: 3,
      status: "in_transit",
      camp_origin_id: 10,
      camp_destination_id: 20,
      resourceDetails: [{ resource_id: 30, requested_quantity: 1 }],
      personDetails: [],
    } as any;

    queryRunner.manager.findOne.mockResolvedValue({
      camp_id: 20,
      resource_id: 30,
      current_quantity: 0,
      minimum_stock_required: 0,
      alert_active: false,
    });
    queryRunner.manager.save.mockRejectedValueOnce(new Error("save failed"));

    await expect(service.arriveTransfer(request, 9)).rejects.toThrow(
      "save failed",
    );
    expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    expect(queryRunner.release).toHaveBeenCalled();
  });


});
