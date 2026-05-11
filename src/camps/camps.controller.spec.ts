import { Test, TestingModule } from "@nestjs/testing";
import { CampsController } from "./camps.controller";
import { CampsService } from "./camps.service";
import { CreateCampDto } from "./dto/create-camp.dto";
import { UpdateCampDto } from "./dto/update-camp.dto";

describe("CampsController", () => {
  let controller: CampsController;
  let service: CampsService;

  const mockCamp = {
    id: 1,
    name: "Camp Alpha",
    location: "Location 1",
    active: true,
    foundation_date: new Date("2024-01-01"),
  };

  const mockCampMetrics = {
    camp: mockCamp,
    metrics: {
      totalResources: 3,
      resourcesWithAlerts: 1,
      inventorySummary: [
        {
          resource: "Tent",
          quantity: 10,
          unit: "pieces",
          alert: false,
        },
        {
          resource: "Food",
          quantity: 2,
          unit: "boxes",
          alert: true,
        },
        {
          resource: "Water",
          quantity: 50,
          unit: "liters",
          alert: false,
        },
      ],
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CampsController],
      providers: [
        {
          provide: CampsService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<CampsController>(CampsController);
    service = module.get<CampsService>(CampsService);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("create", () => {
    it("should create a camp", async () => {
      const createDto: CreateCampDto = {
        name: "New Camp",
        location_description: "New Location",
      };

      jest.spyOn(service, "create").mockResolvedValue(mockCamp as any);

      const result = await controller.create(createDto);

      expect(service.create).toHaveBeenCalledWith(createDto);
      expect(result).toEqual(mockCamp);
    });

    it("should create a camp with foundation_date", async () => {
      const createDto: CreateCampDto = {
        name: "New Camp",
        location_description: "New Location",
        foundation_date: "2024-06-01",
      };

      jest.spyOn(service, "create").mockResolvedValue(mockCamp as any);

      const result = await controller.create(createDto);

      expect(service.create).toHaveBeenCalledWith(createDto);
      expect(result).toEqual(mockCamp);
    });

    it("should pass dto to service", async () => {
      const createDto: CreateCampDto = {
        name: "Camp Beta",
        location_description: "Location 2",
      };

      jest.spyOn(service, "create").mockResolvedValue(mockCamp as any);

      await controller.create(createDto);

      expect(service.create).toHaveBeenCalledWith(createDto);
    });
  });

  describe("findAll", () => {
    it("should return an array of camps", async () => {
      const camps = [mockCamp];

      jest.spyOn(service, "findAll").mockResolvedValue(camps as any);

      const result = await controller.findAll();

      expect(service.findAll).toHaveBeenCalled();
      expect(result).toEqual(camps);
    });

    it("should return empty array if no camps", async () => {
      jest.spyOn(service, "findAll").mockResolvedValue([]);

      const result = await controller.findAll();

      expect(result).toEqual([]);
    });

    it("should return camps sorted by id", async () => {
      const camps = [
        { ...mockCamp, id: 1 },
        { ...mockCamp, id: 2 },
        { ...mockCamp, id: 3 },
      ];

      jest.spyOn(service, "findAll").mockResolvedValue(camps as any);

      const result = await controller.findAll();

      expect(result).toEqual(camps);
    });
  });

  describe("findOne", () => {
    it("should return a camp with metrics", async () => {
      jest.spyOn(service, "findOne").mockResolvedValue(mockCampMetrics as any);

      const result = await controller.findOne(1);

      expect(service.findOne).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockCampMetrics);
    });

    it("should return camp details", async () => {
      jest.spyOn(service, "findOne").mockResolvedValue(mockCampMetrics as any);

      const result = await controller.findOne(1);

      expect(result.camp).toEqual(mockCamp);
      expect(result.metrics).toBeDefined();
    });

    it("should return inventory summary", async () => {
      jest.spyOn(service, "findOne").mockResolvedValue(mockCampMetrics as any);

      const result = await controller.findOne(1);

      expect(result.metrics.inventorySummary).toHaveLength(3);
      expect(result.metrics.totalResources).toBe(3);
      expect(result.metrics.resourcesWithAlerts).toBe(1);
    });

    it("should call service with correct camp id", async () => {
      jest.spyOn(service, "findOne").mockResolvedValue(mockCampMetrics as any);

      await controller.findOne(5);

      expect(service.findOne).toHaveBeenCalledWith(5);
    });
  });

  describe("update", () => {
    it("should update a camp", async () => {
      const updateDto: UpdateCampDto = {
        name: "Updated Camp",
        location_description: "Updated Location",
      };

      const updatedCamp = { ...mockCamp, ...updateDto };

      jest.spyOn(service, "update").mockResolvedValue(updatedCamp as any);

      const result = await controller.update(1, updateDto);

      expect(service.update).toHaveBeenCalledWith(1, updateDto);
      expect(result).toEqual(updatedCamp);
    });

    it("should update with foundation_date", async () => {
      const updateDto: UpdateCampDto = {
        foundation_date: "2024-12-25",
      };

      jest.spyOn(service, "update").mockResolvedValue(mockCamp as any);

      const result = await controller.update(1, updateDto);

      expect(service.update).toHaveBeenCalledWith(1, updateDto);
      expect(result).toEqual(mockCamp);
    });

    it("should passId and dto to service", async () => {
      const updateDto: UpdateCampDto = {
        name: "Camp Gamma",
      };

      jest.spyOn(service, "update").mockResolvedValue(mockCamp as any);

      await controller.update(3, updateDto);

      expect(service.update).toHaveBeenCalledWith(3, updateDto);
    });

    it("should update multiple fields", async () => {
      const updateDto: UpdateCampDto = {
        name: "New Name",
        location_description: "New Location",
        foundation_date: "2025-01-01",
      };

      jest.spyOn(service, "update").mockResolvedValue(mockCamp as any);

      await controller.update(1, updateDto);

      expect(service.update).toHaveBeenCalledWith(1, updateDto);
    });
  });

  describe("remove", () => {
    it("should remove a camp", async () => {
      const response = {
        message: 'Campamento "Camp Alpha" desactivado correctamente',
      };

      jest.spyOn(service, "remove").mockResolvedValue(response as any);

      const result = await controller.remove(1);

      expect(service.remove).toHaveBeenCalledWith(1);
      expect(result).toEqual(response);
    });

    it("should return success message", async () => {
      const response = {
        message: 'Campamento "Camp Alpha" desactivado correctamente',
      };

      jest.spyOn(service, "remove").mockResolvedValue(response as any);

      const result = await controller.remove(1);

      expect(result.message).toBeDefined();
      expect(result.message).toContain("desactivado");
    });

    it("should return camp name in message", async () => {
      const response = {
        message: 'Campamento "Camp Custom" desactivado correctamente',
      };

      jest.spyOn(service, "remove").mockResolvedValue(response as any);

      const result = await controller.remove(2);

      expect(result.message).toContain("Camp Custom");
    });

    it("should call service with correct camp id", async () => {
      const response = {
        message: 'Campamento "Camp Alpha" desactivado correctamente',
      };

      jest.spyOn(service, "remove").mockResolvedValue(response as any);

      await controller.remove(7);

      expect(service.remove).toHaveBeenCalledWith(7);
    });

    it("should return message with special characters in camp name", async () => {
      const response = {
        message: 'Campamento "Camp a e i o u" desactivado correctamente',
      };

      jest.spyOn(service, "remove").mockResolvedValue(response as any);

      const result = await controller.remove(1);

      expect(result.message).toContain("a e i o u");
    });
  });
});
