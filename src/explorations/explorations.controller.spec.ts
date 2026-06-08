import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { ExplorationsController } from "./explorations.controller";
import { ExplorationsService } from "./explorations.service";
import type { CreateExplorationDto } from "./dto/create-exploration.dto";
import type { ReturnExplorationDto } from "./dto/return-exploration.dto";

describe("ExplorationsController", () => {
  let controller: ExplorationsController;
  let service: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExplorationsController],
      providers: [
        {
          provide: ExplorationsService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findById: jest.fn(),
            depart: jest.fn(),
            registerReturn: jest.fn(),
            cancel: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<ExplorationsController>(ExplorationsController);
    service = module.get(ExplorationsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  it("should create an exploration with the current user id", async () => {
    const dto: CreateExplorationDto = {
      camp_id: 1,
      name: "Salida norte",
      destination_description: "Bosque cercano",
      departure_date: "2026-03-25T10:00:00.000Z",
      estimated_days: 2,
      grace_days: 1,
      persons: [{ person_id: 10, is_leader: true }],
      resources: [{ resource_id: 5, flow: "out", quantity: 3 }],
    };
    const created = { id: 99, ...dto };
    service.create.mockResolvedValue(created);

    const result = await controller.create(dto, { id: 7 });

    expect(service.create).toHaveBeenCalledWith(dto, 7);
    expect(result).toEqual(created);
  });

  it("should create an exploration without user id when current user is missing", async () => {
    const dto: CreateExplorationDto = {
      camp_id: 1,
      name: "Salida norte",
      departure_date: "2026-03-25T10:00:00.000Z",
      estimated_days: 2,
      persons: [{ person_id: 10 }],
    };
    service.create.mockResolvedValue({ id: 1, ...dto });

    await controller.create(dto, undefined);

    expect(service.create).toHaveBeenCalledWith(dto, undefined);
  });

  it("should list explorations with parsed campId", async () => {
    const explorations = [{ id: 1, status: "scheduled" }];
    service.findAll.mockResolvedValue(explorations);

    const result = await controller.findAll("3", "scheduled");

    expect(service.findAll).toHaveBeenCalledWith(3, "scheduled");
    expect(result).toEqual(explorations);
  });

  it("should list explorations without filters", async () => {
    service.findAll.mockResolvedValue([]);

    await controller.findAll();

    expect(service.findAll).toHaveBeenCalledWith(undefined, undefined);
  });

  it("should get one exploration by id", async () => {
    const exploration = { id: 12 };
    service.findById.mockResolvedValue(exploration);

    const result = await controller.findById(12);

    expect(service.findById).toHaveBeenCalledWith(12);
    expect(result).toEqual(exploration);
  });

  it("should depart an exploration", async () => {
    const exploration = { id: 9, status: "in_progress" };
    service.depart.mockResolvedValue(exploration);

    const result = await controller.depart(9, { id: 55 });

    expect(service.depart).toHaveBeenCalledWith(9, 55);
    expect(result).toEqual(exploration);
  });

  it("should depart an exploration without current user", async () => {
    service.depart.mockResolvedValue({ id: 9, status: "in_progress" });

    await controller.depart(9, null);

    expect(service.depart).toHaveBeenCalledWith(9, undefined);
  });

  it("should register the return of an exploration", async () => {
    const dto: ReturnExplorationDto = {
      real_return_date: "2026-03-27T10:00:00.000Z",
      notes: "Volvieron con provisiones",
      found_resources: [{ resource_id: 5, flow: "in", quantity: 4 }],
    };
    const updated = { id: 3, status: "completed" };
    service.registerReturn.mockResolvedValue(updated);

    const result = await controller.registerReturn(3, dto, { id: 8 });

    expect(service.registerReturn).toHaveBeenCalledWith(3, dto, 8);
    expect(result).toEqual(updated);
  });

  it("should cancel an exploration", async () => {
    const cancelled = { id: 4, status: "cancelled" };
    service.cancel.mockResolvedValue(cancelled);

    const result = await controller.cancel(4, { id: 18 });

    expect(service.cancel).toHaveBeenCalledWith(4, 18);
    expect(result).toEqual(cancelled);
  });

  it("should cancel an exploration without current user", async () => {
    service.cancel.mockResolvedValue({ id: 4, status: "cancelled" });

    await controller.cancel(4, undefined);

    expect(service.cancel).toHaveBeenCalledWith(4, undefined);
  });
});
