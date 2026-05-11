import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { RequestsService } from "./requests.service";
import { IntercampRequest } from "../entities/intercamp-request.entity";
import { RequestResourceDetail } from "../entities/request-resource-detail.entity";
import { RequestPersonDetail } from "../entities/request-person-detail.entity";
import { Camp } from "../../camps/entities/camp.entity";
import { Person } from "../../users/entities/person.entity";
import { Inventory } from "../../resources/entities/inventory.entity";
import { Resource } from "../../resources/entities/resource.entity";
import { AuditLog } from "../../common/entities/audit-log.entity";
import { NotificationsGateway } from "../../notifications/notifications.gateway";

const createRepoMock = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  save: jest.fn(async (value) => value),
  create: jest.fn((value) => value),
  createQueryBuilder: jest.fn(),
});

const createQueryRunnerMock = () => ({
  connect: jest.fn().mockResolvedValue(undefined),
  startTransaction: jest.fn().mockResolvedValue(undefined),
  commitTransaction: jest.fn().mockResolvedValue(undefined),
  rollbackTransaction: jest.fn().mockResolvedValue(undefined),
  release: jest.fn().mockResolvedValue(undefined),
  manager: {
    create: jest.fn((_entity, value) => value),
    save: jest.fn(async (_entity, value) => value),
    findOne: jest.fn(),
  },
});

describe("RequestsService", () => {
  let service: RequestsService;
  let requestRepo: ReturnType<typeof createRepoMock>;
  let auditRepo: ReturnType<typeof createRepoMock>;
  let campRepo: ReturnType<typeof createRepoMock>;
  let dataSource: { createQueryRunner: jest.Mock };
  let queryRunner: ReturnType<typeof createQueryRunnerMock>;

  beforeEach(async () => {
    queryRunner = createQueryRunnerMock();
    dataSource = { createQueryRunner: jest.fn(() => queryRunner) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RequestsService,
        {
          provide: getRepositoryToken(IntercampRequest),
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
        { provide: getRepositoryToken(Camp), useValue: createRepoMock() },
        { provide: getRepositoryToken(Person), useValue: createRepoMock() },
        { provide: getRepositoryToken(Inventory), useValue: createRepoMock() },
        { provide: getRepositoryToken(Resource), useValue: createRepoMock() },
        { provide: getRepositoryToken(AuditLog), useValue: createRepoMock() },
        { provide: DataSource, useValue: dataSource },
        {
          provide: NotificationsGateway,
          useValue: {
            emitTransferRequest: jest.fn(),
            emitTransferStatusUpdate: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(RequestsService);
    requestRepo = module.get(getRepositoryToken(IntercampRequest));
    auditRepo = module.get(getRepositoryToken(AuditLog));
    campRepo = module.get(getRepositoryToken(Camp));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  it("should reject when origin and destination camps are the same", async () => {
    await expect(
      service.createRequest(
        {
          camp_origin_id: 1,
          camp_destination_id: 1,
          type: "resources",
        } as any,
        7,
      ),
    ).rejects.toThrow(
      new BadRequestException(
        "El campamento origen y destino no pueden ser el mismo",
      ),
    );
  });

  it("should reject when one of the camps does not exist", async () => {
    campRepo.findOne
      .mockResolvedValueOnce({ id: 1 })
      .mockResolvedValueOnce(null);

    await expect(
      service.createRequest(
        {
          camp_origin_id: 1,
          camp_destination_id: 2,
          type: "resources",
        } as any,
        7,
      ),
    ).rejects.toThrow(
      new NotFoundException("Uno o ambos campamentos no existen"),
    );
  });

  it("should create a request without extra details", async () => {
    campRepo.findOne.mockResolvedValue({ id: 1 });
    queryRunner.manager.save
      .mockResolvedValueOnce({ id: 90 })
      .mockResolvedValueOnce(undefined);
    jest
      .spyOn(service, "findRequestById")
      .mockResolvedValueOnce({ id: 90 } as any);

    const result = await service.createRequest(
      {
        camp_origin_id: 10,
        camp_destination_id: 20,
        type: "resources",
        notes: "Solo cabecera",
      } as any,
      7,
    );

    expect(queryRunner.commitTransaction).toHaveBeenCalled();
    expect(result).toEqual({ id: 90 });
  });

  it("should create a request with resource and person details", async () => {
    campRepo.findOne.mockResolvedValue({ id: 1 });
    queryRunner.manager.save
      .mockResolvedValueOnce({ id: 100 })
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined);
    queryRunner.manager.findOne
      .mockResolvedValueOnce({ id: 30, name: "Agua" })
      .mockResolvedValueOnce({ current_quantity: 10 })
      .mockResolvedValueOnce({
        id: 40,
        first_name: "Ana",
        last_name: "Lopez",
        userAccount: { camp_id: 10 },
      });
    jest
      .spyOn(service, "findRequestById")
      .mockResolvedValueOnce({ id: 100 } as any);

    const result = await service.createRequest(
      {
        camp_origin_id: 10,
        camp_destination_id: 20,
        type: "both",
        notes: "Mover apoyo",
        resource_details: [{ resource_id: 30, requested_quantity: 4 }],
        person_details: [{ person_id: 40, is_leader: true }],
      } as any,
      7,
    );

    expect(queryRunner.manager.create).toHaveBeenCalledWith(IntercampRequest, {
      camp_origin_id: 10,
      camp_destination_id: 20,
      type: "both",
      status: "pending",
      request_date: expect.any(Date),
      notes: "Mover apoyo",
      travel_days: 1,
    });
    expect(queryRunner.manager.save).toHaveBeenCalledWith(
      RequestResourceDetail,
      {
        request_id: 100,
        resource_id: 30,
        requested_quantity: 4,
        approved_quantity: null,
        received_quantity: null,
      },
    );
    expect(queryRunner.manager.save).toHaveBeenCalledWith(RequestPersonDetail, {
      request_id: 100,
      person_id: 40,
      is_leader: true,
      transfer_status: "pending",
    });
    expect(queryRunner.commitTransaction).toHaveBeenCalled();
    expect(result).toEqual({ id: 100 });
  });

  it("should rollback and rethrow when creating a request fails", async () => {
    const failure = new Error("save failed");
    campRepo.findOne.mockResolvedValue({ id: 1 });
    queryRunner.manager.save.mockRejectedValueOnce(failure);

    await expect(
      service.createRequest(
        {
          camp_origin_id: 10,
          camp_destination_id: 20,
          type: "resources",
        } as any,
        7,
      ),
    ).rejects.toThrow(failure);

    expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    expect(queryRunner.release).toHaveBeenCalled();
  });

  it("should reject resource details when the resource does not exist", async () => {
    campRepo.findOne.mockResolvedValue({ id: 1 });
    queryRunner.manager.save.mockResolvedValueOnce({ id: 100 });
    queryRunner.manager.findOne.mockResolvedValueOnce(null);

    await expect(
      service.createRequest(
        {
          camp_origin_id: 10,
          camp_destination_id: 20,
          type: "resources",
          resource_details: [{ resource_id: 30, requested_quantity: 4 }],
        } as any,
        7,
      ),
    ).rejects.toThrow(new NotFoundException("Recurso con ID 30 no encontrado"));
  });

  it("should reject resource details when inventory is insufficient", async () => {
    campRepo.findOne.mockResolvedValue({ id: 1 });
    queryRunner.manager.save.mockResolvedValueOnce({ id: 100 });
    queryRunner.manager.findOne
      .mockResolvedValueOnce({ id: 30, name: "Agua" })
      .mockResolvedValueOnce({ current_quantity: 2 });

    await expect(
      service.createRequest(
        {
          camp_origin_id: 10,
          camp_destination_id: 20,
          type: "resources",
          resource_details: [{ resource_id: 30, requested_quantity: 4 }],
        } as any,
        7,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it("should reject resource details when the origin inventory is missing", async () => {
    campRepo.findOne.mockResolvedValue({ id: 1 });
    queryRunner.manager.save.mockResolvedValueOnce({ id: 101 });
    queryRunner.manager.findOne
      .mockResolvedValueOnce({ id: 30, name: "Agua" })
      .mockResolvedValueOnce(null);

    await expect(
      service.createRequest(
        {
          camp_origin_id: 10,
          camp_destination_id: 20,
          type: "resources",
          resource_details: [{ resource_id: 30, requested_quantity: 4 }],
        } as any,
        7,
      ),
    ).rejects.toThrow(
      new BadRequestException(
        'Recurso "Agua" insuficiente en campamento origen. Disponible: 0, Solicitado: 4',
      ),
    );
  });

  it("should reject person details when the person does not exist", async () => {
    campRepo.findOne.mockResolvedValue({ id: 1 });
    queryRunner.manager.save.mockResolvedValueOnce({ id: 100 });
    queryRunner.manager.findOne.mockResolvedValueOnce(null);

    await expect(
      service.createRequest(
        {
          camp_origin_id: 10,
          camp_destination_id: 20,
          type: "people",
          person_details: [{ person_id: 40 }],
        } as any,
        7,
      ),
    ).rejects.toThrow(new NotFoundException("Persona con ID 40 no encontrada"));
  });

  it("should reject person details when the person belongs to another camp", async () => {
    campRepo.findOne.mockResolvedValue({ id: 1 });
    queryRunner.manager.save.mockResolvedValueOnce({ id: 100 });
    queryRunner.manager.findOne.mockResolvedValueOnce({
      id: 40,
      first_name: "Ana",
      last_name: "Lopez",
      userAccount: { camp_id: 99 },
    });

    await expect(
      service.createRequest(
        {
          camp_origin_id: 10,
          camp_destination_id: 20,
          type: "people",
          person_details: [{ person_id: 40 }],
        } as any,
        7,
      ),
    ).rejects.toThrow(
      new BadRequestException(
        "La persona Ana Lopez no pertenece al campamento origen",
      ),
    );
  });

  it("should default is_leader to false when creating person details", async () => {
    campRepo.findOne.mockResolvedValue({ id: 1 });
    queryRunner.manager.save
      .mockResolvedValueOnce({ id: 102 })
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined);
    queryRunner.manager.findOne.mockResolvedValueOnce({
      id: 41,
      first_name: "Luis",
      last_name: "Perez",
      userAccount: { camp_id: 10 },
    });
    jest
      .spyOn(service, "findRequestById")
      .mockResolvedValueOnce({ id: 102 } as any);

    const result = await service.createRequest(
      {
        camp_origin_id: 10,
        camp_destination_id: 20,
        type: "people",
        person_details: [{ person_id: 41 }],
      } as any,
      7,
    );

    expect(queryRunner.manager.save).toHaveBeenCalledWith(RequestPersonDetail, {
      request_id: 102,
      person_id: 41,
      is_leader: false,
      transfer_status: "pending",
    });
    expect(result).toEqual({ id: 102 });
  });

  it("should find a request by id with all relations", async () => {
    requestRepo.findOne.mockResolvedValueOnce({ id: 1 });

    await expect(service.findRequestById(1)).resolves.toEqual({ id: 1 });
    expect(requestRepo.findOne).toHaveBeenCalledWith({
      where: { id: 1 },
      relations: [
        "campOrigin",
        "campDestination",
        "resourceDetails",
        "resourceDetails.resource",
        "personDetails",
        "personDetails.person",
        "approvals",
        "approvals.user",
      ],
    });
  });

  it("should throw when the request is not found by id", async () => {
    requestRepo.findOne.mockResolvedValueOnce(null);

    await expect(service.findRequestById(404)).rejects.toThrow(
      new NotFoundException(
        "Solicitud de transferencia con ID 404 no encontrada",
      ),
    );
  });

  it("should find requests by camp for the origin role", async () => {
    const queryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([{ id: 1 }]),
    };
    requestRepo.createQueryBuilder.mockReturnValueOnce(queryBuilder);

    const result = await service.findRequestsByCamp(10, "origin");

    expect(queryBuilder.where).toHaveBeenCalledWith(
      "req.camp_origin_id = :campId",
      {
        campId: 10,
      },
    );
    expect(result).toEqual([{ id: 1 }]);
  });

  it("should find requests by camp for the destination role", async () => {
    const queryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([{ id: 2 }]),
    };
    requestRepo.createQueryBuilder.mockReturnValueOnce(queryBuilder);

    const result = await service.findRequestsByCamp(20, "destination");

    expect(queryBuilder.where).toHaveBeenCalledWith(
      "req.camp_destination_id = :campId",
      { campId: 20 },
    );
    expect(result).toEqual([{ id: 2 }]);
  });

  it("should find requests by camp for both roles when role is omitted", async () => {
    const queryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([{ id: 3 }]),
    };
    requestRepo.createQueryBuilder.mockReturnValueOnce(queryBuilder);

    const result = await service.findRequestsByCamp(20);

    expect(queryBuilder.where).toHaveBeenCalledWith(
      "(req.camp_origin_id = :campId OR req.camp_destination_id = :campId)",
      { campId: 20 },
    );
    expect(queryBuilder.orderBy).toHaveBeenCalledWith(
      "req.request_date",
      "DESC",
    );
    expect(result).toEqual([{ id: 3 }]);
  });

  it("should find pending requests by camp", async () => {
    requestRepo.find.mockResolvedValueOnce([{ id: 1 }]);

    await expect(service.findPendingRequestsByCamp(10)).resolves.toEqual([
      { id: 1 },
    ]);
    expect(requestRepo.find).toHaveBeenCalledWith({
      where: [
        { camp_origin_id: 10, status: "pending" },
        { camp_destination_id: 10, status: "pending" },
      ],
      relations: [
        "campOrigin",
        "campDestination",
        "resourceDetails",
        "resourceDetails.resource",
        "personDetails",
        "personDetails.person",
        "approvals",
        "approvals.user",
      ],
      order: { request_date: "DESC" },
    });
  });

  it("should cancel a pending request from the origin camp", async () => {
    jest
      .spyOn(service, "findRequestById")
      .mockResolvedValueOnce({
        id: 1,
        camp_origin_id: 10,
        status: "pending",
      } as any)
      .mockResolvedValueOnce({
        id: 1,
        camp_origin_id: 10,
        status: "cancelled",
      } as any);
    requestRepo.save.mockResolvedValueOnce(undefined);
    auditRepo.create.mockImplementation((value) => value);
    auditRepo.save.mockResolvedValueOnce(undefined);

    const result = await service.cancelRequest(1, 7, 10);

    expect(requestRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: "cancelled" }),
    );
    expect(auditRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: "intercamp_request_cancelled" }),
    );
    expect(result.status).toBe("cancelled");
  });

  it("should reject cancelling a non-pending request", async () => {
    jest.spyOn(service, "findRequestById").mockResolvedValueOnce({
      id: 1,
      camp_origin_id: 10,
      status: "approved",
    } as any);

    await expect(service.cancelRequest(1, 7, 10)).rejects.toThrow(
      new BadRequestException("Solo se pueden cancelar solicitudes pendientes"),
    );
  });

  it("should reject cancelling from a different camp", async () => {
    jest.spyOn(service, "findRequestById").mockResolvedValueOnce({
      id: 1,
      camp_origin_id: 10,
      status: "pending",
    } as any);

    await expect(service.cancelRequest(1, 7, 20)).rejects.toThrow(
      new BadRequestException(
        "Solo el campamento origen puede cancelar la solicitud",
      ),
    );
  });

  it("should build transfer statistics", async () => {
    requestRepo.find.mockResolvedValueOnce([
      { status: "pending", camp_origin_id: 10, camp_destination_id: 20 },
      { status: "completed", camp_origin_id: 99, camp_destination_id: 10 },
      { status: "cancelled", camp_origin_id: 10, camp_destination_id: 77 },
      { status: "approved", camp_origin_id: 10, camp_destination_id: 10 },
      { status: "rejected", camp_origin_id: 88, camp_destination_id: 10 },
    ]);

    await expect(service.getTransferStatistics(10)).resolves.toEqual({
      totalRequests: 5,
      pending: 1,
      approved: 1,
      completed: 1,
      rejected: 1,
      cancelled: 1,
      asOrigin: 3,
      asDestination: 3,
    });
  });
});
