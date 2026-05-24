import { Test, TestingModule } from "@nestjs/testing";
import { AiController } from "./ai.controller";
import { AiService } from "./ai.service";

describe("AiController", () => {
  let controller: AiController;
  let service: AiService;

  const mockAdmission: any = {
    id: 1,
    tracking_code: "ADM-001",
    camp_id: 1,
    person_id: 1,
    candidate_data: {},
    score: 85,
    status: "PENDING_REVIEW",
    suggested_decision: "ACCEPTED",
    suggested_profession_id: null,
    justification: "",
    raw_ai_response: {},
    reviewed_by_user_id: null,
    final_human_decision: null,
    admin_notes: "",
    submission_date: new Date(),
    review_date: null,
    camp: { id: 1, nombre: "Test Camp" },
    person: { id: 1, nombre: "John" },
    suggestedProfession: null,
    reviewedBy: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AiController],
      providers: [
        {
          provide: AiService,
          useValue: {
            submitAdmission: jest.fn(),
            trackAdmission: jest.fn(),
            getPendingAdmissions: jest.fn(),
            getAdmissionDetail: jest.fn(),
            reviewAdmission: jest.fn(),
            createUserAccountForPerson: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AiController>(AiController);
    service = module.get<AiService>(AiService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("submitAdmission", () => {
    it("should submit an admission", async () => {
      jest
        .spyOn(service, "submitAdmission")
        .mockResolvedValueOnce(mockAdmission);

      const dto = {
        first_name: "John",
        last_name: "Doe",
        age: 30,
        camp_id: 1,
        health_status: 85,
        physical_condition: 80,
        criminal_record: false,
        skills: ["leadership"],
      } as any;

      const result = await controller.submitAdmission(dto);

      expect(result).toEqual(mockAdmission);
      expect(service.submitAdmission).toHaveBeenCalledWith(dto);
    });
  });

  describe("trackAdmission", () => {
    it("should track an admission by code", async () => {
      jest
        .spyOn(service, "trackAdmission")
        .mockResolvedValueOnce(mockAdmission);

      const result = await controller.trackAdmission("ADM-001");

      expect(result).toEqual(mockAdmission);
      expect(service.trackAdmission).toHaveBeenCalledWith("ADM-001");
    });
  });

  describe("getPendingAdmissions", () => {
    it("should get pending admissions paginated", async () => {
      const mockPaginatedResult = {
        data: [mockAdmission],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      };
      jest
        .spyOn(service, "getPendingAdmissions")
        .mockResolvedValueOnce(mockPaginatedResult);

      const result = await controller.getPendingAdmissions();

      expect(result).toEqual(mockPaginatedResult);
      expect(service.getPendingAdmissions).toHaveBeenCalled();
    });

    it("should parse campId, page and limit query params before delegating", async () => {
      const mockPaginatedResult = {
        data: [mockAdmission],
        total: 1,
        page: 3,
        limit: 15,
        totalPages: 1,
      };
      jest
        .spyOn(service, "getPendingAdmissions")
        .mockResolvedValueOnce(mockPaginatedResult);

      const result = await controller.getPendingAdmissions("7", "3", "15");

      expect(result).toEqual(mockPaginatedResult);
      expect(service.getPendingAdmissions).toHaveBeenCalledWith(7, 3, 15);
    });
  });

  describe("getAdmissionDetail", () => {
    it("should get admission detail", async () => {
      jest
        .spyOn(service, "getAdmissionDetail")
        .mockResolvedValueOnce(mockAdmission);

      const result = await controller.getAdmissionDetail(1);

      expect(result).toEqual(mockAdmission);
      expect(service.getAdmissionDetail).toHaveBeenCalledWith(1);
    });
  });

  describe("reviewAdmission", () => {
    it("should review an admission", async () => {
      jest
        .spyOn(service, "reviewAdmission")
        .mockResolvedValueOnce(mockAdmission);

      const dto = { decision: "accepted", notes: "Approved" } as any;
      const result = await controller.reviewAdmission(1, dto, { id: 1 });

      expect(result).toEqual(mockAdmission);
      expect(service.reviewAdmission).toHaveBeenCalledWith(1, dto, 1);
    });
  });

  describe("createUserAccount", () => {
    it("should create a user account for accepted person", async () => {
      const mockUserAccount = {
        id: 1,
        username: "johndoe",
        email: "john@example.com",
        password_hash: "hashed_password",
        role_id: 1,
        is_active: true,
        created_at: new Date(),
      };
      jest
        .spyOn(service, "createUserAccountForPerson")
        .mockResolvedValueOnce(mockUserAccount as any);

      const dto = {
        username: "johndoe",
        email: "john@example.com",
        password: "Password123!",
        role_id: 1,
      } as any;

      const result = await controller.createUserAccount(1, dto);

      expect(result).toEqual(mockUserAccount);
      expect(service.createUserAccountForPerson).toHaveBeenCalledWith(1, dto);
    });
  });
});
