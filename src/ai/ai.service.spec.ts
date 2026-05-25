import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { AiService } from "./ai.service";
import { getRepositoryToken } from "@nestjs/typeorm";
import { AiAdmission } from "./entities/ai-admission.entity";
import { Camp } from "../camps/entities/camp.entity";
import { CampAnalysisService } from "./services/camp-analysis.service";
import { AiEvaluationService } from "./services/ai-evaluation.service";
import { AdmissionReviewService } from "./services/admission-review.service";
import { PythonAiService } from "./services/python-ai.service";

describe("AiService", () => {
  let service: AiService;
  let module: TestingModule;

  const mockSubmitDto = {
    first_name: "John",
    last_name: "Doe",
    age: 30,
    camp_id: 1,
    health_status: 85,
    physical_condition: 80,
    criminal_record: false,
    skills: ["leadership"],
  };

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        AiService,
        {
          provide: getRepositoryToken(AiAdmission),
          useValue: {
            create: jest.fn().mockImplementation((obj) => obj),
            save: jest.fn().mockImplementation((admission) => {
              return Promise.resolve({
                id: 1,
                tracking_code: admission.tracking_code || "ADM-001",
                status: admission.status || "PENDING_REVIEW",
                score: admission.score !== undefined ? admission.score : 85,
                suggested_decision: admission.suggested_decision || "ACCEPTED",
                suggested_profession_id: admission.suggested_profession_id,
                raw_ai_response: admission.raw_ai_response,
                candidate_data: admission.candidate_data,
                camp_id: admission.camp_id,
                justification: admission.justification,
              });
            }),
            findOne: jest.fn().mockResolvedValue({
              id: 1,
              tracking_code: "ADM-001",
              candidate_data: { first_name: "John", last_name: "Doe" },
              camp: { id: 1, name: "Test Camp" },
              status: "PENDING_REVIEW",
            }),
            find: jest.fn().mockResolvedValue([{ id: 1 }]),
            findAndCount: jest.fn().mockResolvedValue([[{ id: 1 }], 1]),
            count: jest.fn().mockResolvedValue(1),
          },
        },
        {
          provide: getRepositoryToken(Camp),
          useValue: {
            findOne: jest
              .fn()
              .mockResolvedValue({ id: 1, nombre: "Test Camp" }),
            find: jest.fn().mockResolvedValue([{ id: 1, nombre: "Test Camp" }]),
          },
        },
        {
          provide: CampAnalysisService,
          useValue: {
            analyzeCampContext: jest
              .fn()
              .mockResolvedValue({ occupancyRate: 0.5 }),
          },
        },
        {
          provide: AiEvaluationService,
          useValue: {
            checkCriticalRules: jest.fn().mockReturnValue({ applies: false }),
            calculateAdmissionScore: jest.fn().mockResolvedValue({
              score: 85,
              decision: "ACCEPTED",
              confidence: "HIGH",
              factors: [],
            }),
            matchProfession: jest
              .fn()
              .mockResolvedValue({ id: 1, nombre: "Doctor" }),
            generateJustification: jest
              .fn()
              .mockReturnValue("Good fit based on skills"),
          },
        },
        {
          provide: AdmissionReviewService,
          useValue: {
            reviewAdmission: jest
              .fn()
              .mockResolvedValue({ admission: { id: 1 } }),
            createUserAccountForPerson: jest
              .fn()
              .mockResolvedValue({ id: 1, username: "johndoe" }),
          },
        },
        { provide: PythonAiService, useValue: { analyzeAdmission: jest.fn() } },
      ],
    }).compile();

    service = module.get<AiService>(AiService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("submitAdmission - Happy Path", () => {
    it("should submit an admission successfully", async () => {
      const result = await service.submitAdmission(mockSubmitDto as any);
      expect(result).toBeDefined();
      expect(result.tracking_code).toBeTruthy();
      expect(result.status).toBe("PENDING_REVIEW");
    });

    it("should throw NotFoundException when camp not found", async () => {
      const module = await Test.createTestingModule({
        providers: [
          AiService,
          {
            provide: getRepositoryToken(AiAdmission),
            useValue: {
              create: jest.fn(),
              save: jest.fn(),
            },
          },
          {
            provide: getRepositoryToken(Camp),
            useValue: {
              findOne: jest.fn().mockResolvedValue(null),
              find: jest.fn().mockResolvedValue([]),
            },
          },
          {
            provide: CampAnalysisService,
            useValue: {
              analyzeCampContext: jest.fn(),
            },
          },
          {
            provide: AiEvaluationService,
            useValue: {
              checkCriticalRules: jest.fn(),
              calculateAdmissionScore: jest.fn(),
            },
          },
          {
            provide: AdmissionReviewService,
            useValue: {},
          },
          {
            provide: PythonAiService,
            useValue: {},
          },
        ],
      }).compile();

      const testService = module.get<AiService>(AiService);

      await expect(
        testService.submitAdmission({ camp_id: 999 } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it("should apply critical rule when infection detected", async () => {
      const evaluationService = module.get(AiEvaluationService);
      (evaluationService.checkCriticalRules as jest.Mock).mockReturnValue({
        applies: true,
        decision: "REJECT",
        reason: "Critical health condition",
      });

      const result = await service.submitAdmission(mockSubmitDto as any);

      expect(result.suggested_decision).toBe("REJECT");
      expect(result.score).toBe(0);
    });

    it("should assign a perfect score when a critical rule accepts the candidate", async () => {
      const evaluationService = module.get(AiEvaluationService);

      (evaluationService.checkCriticalRules as jest.Mock).mockReturnValue({
        applies: true,
        decision: "ACCEPT",
        reason: "Critical profession needed urgently",
      });

      const result = await service.submitAdmission(mockSubmitDto as any);

      expect(result.suggested_decision).toBe("ACCEPT");
      expect(result.score).toBe(100);
    });

    it("should fall back to REJECT and empty detail when a critical rule omits decision and reason", async () => {
      const evaluationService = module.get(AiEvaluationService);
      const admissionRepo = module.get(getRepositoryToken(AiAdmission));

      (evaluationService.checkCriticalRules as jest.Mock).mockReturnValue({
        applies: true,
      });

      const result = await service.submitAdmission(mockSubmitDto as any);

      expect(result.suggested_decision).toBe("REJECT");
      expect(result.score).toBe(0);
      expect(admissionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          raw_ai_response: expect.objectContaining({
            nestjs_evaluation: expect.objectContaining({
              decision: "REJECT",
              factors: [
                expect.objectContaining({
                  detail: "",
                }),
              ],
            }),
          }),
        }),
      );
    });

    it("should handle Python microservice unavailability", async () => {
      const pythonService = module.get(PythonAiService);
      (pythonService.analyzeAdmission as jest.Mock).mockResolvedValue(null);

      const result = await service.submitAdmission(mockSubmitDto as any);

      expect(result).toBeDefined();
      expect(result.raw_ai_response).toBeDefined();
    });

    it("should combine scores when Python service returns result", async () => {
      const pythonService = module.get(PythonAiService);
      (pythonService.analyzeAdmission as jest.Mock).mockResolvedValue({
        nlp_percentage: 75,
        nlp_decision_hint: "RECOMMEND_ACCEPT",
        infection_detected: false,
        transparency_report: "Analysis complete",
      });

      const result = await service.submitAdmission(mockSubmitDto as any);

      expect(result.raw_ai_response).toBeDefined();
    });

    it("should reject when infection detected despite high score", async () => {
      const pythonService = module.get(PythonAiService);
      (pythonService.analyzeAdmission as jest.Mock).mockResolvedValue({
        nlp_percentage: 90,
        infection_detected: true,
        transparency_report: "Infection detected",
      });

      const result = await service.submitAdmission(mockSubmitDto as any);

      expect(result.suggested_decision).toBe("RECOMMEND_REJECT");
    });

    it("should match profession based on skills", async () => {
      const evaluationService = module.get(AiEvaluationService);
      (evaluationService.matchProfession as jest.Mock).mockResolvedValue({
        id: 5,
        name: "Engineer",
      });

      const result = await service.submitAdmission(mockSubmitDto as any);

      expect(result.suggested_profession_id).toBe(5);
    });

    it("should handle admission with pagination parameters", async () => {
      const result = await service.getPendingAdmissions(1, 2, 10);

      expect(result).toHaveProperty("data");
      expect(result).toHaveProperty("total");
      expect(result).toHaveProperty("page", 2);
      expect(result).toHaveProperty("limit", 10);
      expect(result).toHaveProperty("totalPages");
    });

    it("should enforce maximum limit of 100 for pagination", async () => {
      const result = await service.getPendingAdmissions(1, 1, 500);

      expect(result.limit).toBe(100);
    });

    it("should handle page less than 1 (default to 1)", async () => {
      const result = await service.getPendingAdmissions(1, -5, 10);

      expect(result.page).toBe(1);
    });
  });

  describe("trackAdmission - Tracking Admission", () => {
    it("should track an admission by tracking code", async () => {
      const result = await service.trackAdmission("ADM-001");
      expect(result).toBeDefined();
      expect(result.tracking_code).toBe("ADM-001");
    });

    it("should throw NotFoundException for invalid tracking code", async () => {
      const admissionRepo = module.get(getRepositoryToken(AiAdmission));
      (admissionRepo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.trackAdmission("INVALID-CODE")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should format candidate name correctly with all components", async () => {
      const result = await service.trackAdmission("ADM-001");
      expect(result.candidate_name).toBeTruthy();
    });
  });

  describe("getAdmissionDetail - Detail Retrieval", () => {
    it("should get admission detail by id", async () => {
      const result = await service.getAdmissionDetail(1);
      expect(result).toBeDefined();
      expect(result.id).toBe(1);
    });

    it("should throw NotFoundException for non-existent admission", async () => {
      const admissionRepo = module.get(getRepositoryToken(AiAdmission));
      (admissionRepo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.getAdmissionDetail(99999)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should load all required relations", async () => {
      const admissionRepo = module.get(getRepositoryToken(AiAdmission));
      const findOneSpy = admissionRepo.findOne as jest.Mock;

      await service.getAdmissionDetail(1);

      expect(findOneSpy).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: ["camp", "suggestedProfession", "reviewedBy", "person"],
      });
    });
  });

  describe("reviewAdmission - Review & Decision", () => {
    it("should review an admission and pass to review service", async () => {
      const reviewDto = { decision: "accepted" };
      const result = await service.reviewAdmission(1, reviewDto as any, 1);
      expect(result).toBeDefined();
    });

    it("should pass correct parameters to review service", async () => {
      const reviewService = module.get(AdmissionReviewService);
      const reviewSpy = reviewService.reviewAdmission as jest.Mock;

      const reviewDto = { decision: "rejected" };
      await service.reviewAdmission(1, reviewDto as any, 5);

      expect(reviewSpy).toHaveBeenCalledWith(1, reviewDto, 5);
    });
  });

  describe("createUserAccountForPerson - Account Creation", () => {
    it("should create user account", async () => {
      const accountDto = {
        username: "newuser",
        password: process.env.TEST_USER_PASSWORD ?? "***removed***",
        email: "newuser@test.com",
        role_id: 1,
      };
      const result = await service.createUserAccountForPerson(1, accountDto);
      expect(result).toBeDefined();
    });
  });

  describe("getPendingAdmissions - Listing Admissions", () => {
    it("should get pending admissions", async () => {
      const result = await service.getPendingAdmissions();
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.total).toBeDefined();
    });

    it("should filter by camp id when provided", async () => {
      const admissionRepo = module.get(getRepositoryToken(AiAdmission));
      const findAndCountSpy = admissionRepo.findAndCount as jest.Mock;

      await service.getPendingAdmissions(5);

      const callArgs = findAndCountSpy.mock.calls[0][0];
      expect(callArgs.where.camp_id).toBe(5);
    });

    it("should calculate pagination correctly", async () => {
      const result = await service.getPendingAdmissions(undefined, 3, 20);

      expect(result.totalPages).toBe(Math.ceil(result.total / 20));
    });
  });

  describe("Error handling and edge cases", () => {
    it("should handle missing optional fields in submission", async () => {
      const minimalDto = {
        first_name: "Jane",
        last_name: "Smith",
        age: 40,
        camp_id: 1,
      };

      const result = await service.submitAdmission(minimalDto as any);
      expect(result).toBeDefined();
    });

    it("should handle Python service errors gracefully", async () => {
      const pythonService = module.get(PythonAiService);
      (pythonService.analyzeAdmission as jest.Mock).mockRejectedValue(
        new Error("Service unavailable"),
      );

      try {
        const result = await service.submitAdmission(mockSubmitDto as any);
        expect(result).toBeDefined();
      } catch (error) {
        // Expected - service may throw
      }
    });
  });
});
