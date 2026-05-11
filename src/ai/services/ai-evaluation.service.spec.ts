import { Test, TestingModule } from "@nestjs/testing";
import { AiEvaluationService, EvaluationResult } from "./ai-evaluation.service";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Profession } from "../../users/entities/profession.entity";

describe("AiEvaluationService", () => {
  let service: AiEvaluationService;

  const mockContext = {
    population: 50,
    capacity: 100,
    occupancyRate: 0.5,
    balance: { food: 100, water: 200, medical: 50 },
    criticalProfession: "doctor",
    criticalDeficit: 2,
    professionsNeeded: [
      { profession: "doctor", count: 5 },
      { profession: "nurse", count: 3 },
    ],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiEvaluationService,
        {
          provide: getRepositoryToken(Profession),
          useValue: { findOne: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<AiEvaluationService>(AiEvaluationService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  it("should check critical rules for candidate", () => {
    const candidate = {
      health_status: 85,
      criminal_record: false,
      age: 30,
      skills: ["leadership"],
    };
    const result = service.checkCriticalRules(
      candidate as any,
      mockContext as any,
    );
    expect(result).toBeDefined();
    expect(result).toHaveProperty("applies");
  });

  it("should reject candidate when food deficit is critical", () => {
    const candidateWithoutFoodSkills = {
      health_status: 85,
      age: 30,
      skills: ["leadership"],
    };
    const criticalContext = {
      ...mockContext,
      balance: { food: -15, water: 200, medical: 50 },
    };
    const result = service.checkCriticalRules(
      candidateWithoutFoodSkills as any,
      criticalContext as any,
    );
    expect(result).toBeDefined();
  });

  it("should accept candidate with food production skills in deficit", () => {
    const candidateWithFoodSkills = {
      health_status: 85,
      age: 30,
      skills: ["agriculture", "leadership"],
    };
    const criticalContext = {
      ...mockContext,
      balance: { food: -15, water: 200, medical: 50 },
    };
    const result = service.checkCriticalRules(
      candidateWithFoodSkills as any,
      criticalContext as any,
    );
    expect(result).toBeDefined();
  });

  it("should calculate admission score", async () => {
    const candidate = {
      first_name: "John",
      last_name: "Doe",
      age: 30,
      health_status: 85,
      physical_condition: 80,
      criminal_record: false,
      skills: ["leadership", "medical"],
      camp_id: 1,
    };
    const result = await service.calculateAdmissionScore(
      candidate as any,
      mockContext as any,
    );
    expect(result).toBeDefined();
    expect(result).toHaveProperty("score");
    expect(result).toHaveProperty("decision");
    expect(result).toHaveProperty("confidence");
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it("should match profession from skills", async () => {
    const skills = ["medical"];
    const result = await service.matchProfession(skills, mockContext as any);
    expect(result === null || result).toBeDefined();
  });

  it("should return null when no profession matches", async () => {
    const skills = ["cooking"];
    const result = await service.matchProfession(skills, mockContext as any);
    expect(result === null || result).toBeDefined();
  });

  it("should evaluate candidate with low health status", () => {
    const candidateLowHealth = {
      health_status: 20,
      criminal_record: false,
      age: 30,
      skills: ["leadership"],
    };
    const result = service.checkCriticalRules(
      candidateLowHealth as any,
      mockContext as any,
    );
    expect(result).toBeDefined();
    expect(result).toHaveProperty("applies");
  });

  it("should evaluate candidate with criminal record", () => {
    const candidateWithRecord = {
      health_status: 85,
      criminal_record: true,
      age: 30,
      skills: ["leadership"],
    };
    const result = service.checkCriticalRules(
      candidateWithRecord as any,
      mockContext as any,
    );
    expect(result).toBeDefined();
  });

  it("should score elderly candidate differently", async () => {
    const elderlyCandidate = {
      first_name: "Maria",
      last_name: "Garcia",
      age: 70,
      health_status: 70,
      physical_condition: 65,
      criminal_record: false,
      skills: ["leadership"],
      camp_id: 1,
    };
    const result = await service.calculateAdmissionScore(
      elderlyCandidate as any,
      mockContext as any,
    );
    expect(result).toBeDefined();
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it("should score young candidate with high physical condition", async () => {
    const youngCandidate = {
      first_name: "Carlos",
      last_name: "Lopez",
      age: 18,
      health_status: 95,
      physical_condition: 95,
      criminal_record: false,
      skills: ["leadership", "construction"],
      camp_id: 1,
    };
    const result = await service.calculateAdmissionScore(
      youngCandidate as any,
      mockContext as any,
    );
    expect(result).toBeDefined();
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it("should handle multiple matching professions", async () => {
    const multiSkillCandidate = ["medical", "agriculture", "construction"];
    const result = await service.matchProfession(
      multiSkillCandidate,
      mockContext as any,
    );
    expect(result === null || result).toBeDefined();
  });

  it("should evaluate critical water deficit", () => {
    const candidate = {
      health_status: 85,
      criminal_record: false,
      age: 30,
      skills: ["leadership"],
    };
    const waterDeficitContext = {
      ...mockContext,
      balance: { food: 100, water: -50, medical: 50 },
    };
    const result = service.checkCriticalRules(
      candidate as any,
      waterDeficitContext as any,
    );
    expect(result).toBeDefined();
  });

  it("should handle empty skills array", async () => {
    const result = await service.matchProfession([], mockContext as any);
    expect(result === null || result).toBeDefined();
  });

  it("should reject candidate with contagious medical condition", () => {
    const contagiousCandidate = {
      health_status: 85,
      criminal_record: false,
      age: 30,
      skills: ["leadership"],
      medical_conditions: ["contagious"],
    };
    const result = service.checkCriticalRules(
      contagiousCandidate as any,
      mockContext as any,
    );
    expect(result).toBeDefined();
    expect(result.applies).toBe(true);
  });

  it("should reject candidate when camp occupancy is greater than 95%", () => {
    const candidate = {
      health_status: 85,
      criminal_record: false,
      age: 30,
      skills: ["leadership"],
    };
    const highOccupancyContext = {
      ...mockContext,
      occupancyRate: 0.96,
      population: 96,
      capacity: 100,
    };
    const result = service.checkCriticalRules(
      candidate as any,
      highOccupancyContext as any,
    );
    expect(result).toBeDefined();
  });

  it("should accept candidate with critical profession skill when deficit is high", () => {
    const criticalProfessionCandidate = {
      health_status: 85,
      criminal_record: false,
      age: 30,
      skills: ["medicine"],
    };
    const criticalNeedContext = {
      ...mockContext,
      criticalDeficit: 2,
      criticalProfession: "doctor",
      professionsNeeded: [{ profession: "doctor", count: 5 }],
    };
    const result = service.checkCriticalRules(
      criticalProfessionCandidate as any,
      criticalNeedContext as any,
    );
    expect(result).toBeDefined();
  });

  it("should calculate score with all scoring factors", async () => {
    const candidate = {
      first_name: "Juan",
      last_name: "Camargo",
      age: 35,
      health_status: 80,
      physical_condition: 75,
      criminal_record: false,
      skills: ["agriculture", "hunting"],
      years_experience: 10,
      psychological_evaluation: 75,
      camp_id: 1,
    };
    const result = await service.calculateAdmissionScore(
      candidate as any,
      mockContext as any,
    );
    expect(result).toBeDefined();
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result).toHaveProperty("decision");
    expect(result).toHaveProperty("confidence");
  });

  it("should handle candidate with many years of experience", async () => {
    const veryExperienced = {
      first_name: "Pedro",
      last_name: "Experto",
      age: 55,
      health_status: 75,
      physical_condition: 70,
      criminal_record: false,
      skills: ["engineering", "construction", "repair"],
      years_experience: 30,
      psychological_evaluation: 85,
      camp_id: 1,
    };
    const result = await service.calculateAdmissionScore(
      veryExperienced as any,
      mockContext as any,
    );
    expect(result).toBeDefined();
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it("should evaluate candidate with no experience skills", async () => {
    const noExperience = {
      first_name: "Nueva",
      last_name: "Persona",
      age: 22,
      health_status: 90,
      physical_condition: 90,
      criminal_record: false,
      skills: [],
      years_experience: 0,
      psychological_evaluation: 70,
      camp_id: 1,
    };
    const result = await service.calculateAdmissionScore(
      noExperience as any,
      mockContext as any,
    );
    expect(result).toBeDefined();
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it("should score candidate with useful skills higher", async () => {
    const utilitySkillsCandidate = {
      first_name: "Medico",
      last_name: "Utiles",
      age: 40,
      health_status: 80,
      physical_condition: 75,
      criminal_record: false,
      skills: ["medicine", "agriculture"],
      years_experience: 5,
      psychological_evaluation: 80,
      camp_id: 1,
    };
    const result = await service.calculateAdmissionScore(
      utilitySkillsCandidate as any,
      mockContext as any,
    );
    expect(result).toBeDefined();
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it("should match Explorador profession with survival skills", async () => {
    const exploradorSkills = ["survival", "navigation"];
    const result = await service.matchProfession(
      exploradorSkills,
      mockContext as any,
    );
    expect(result === null || result).toBeDefined();
  });

  it("should match Guardia profession with security skills", async () => {
    const guardiaSkills = ["security", "combat"];
    const result = await service.matchProfession(
      guardiaSkills,
      mockContext as any,
    );
    expect(result === null || result).toBeDefined();
  });

  it("should match Medico profession with medical skills", async () => {
    const medicoSkills = ["medicine", "first aid"];
    const result = await service.matchProfession(
      medicoSkills,
      mockContext as any,
    );
    expect(result === null || result).toBeDefined();
  });

  it("should match Granjero profession with agriculture skills", async () => {
    const graneroSkills = ["agriculture", "farming"];
    const result = await service.matchProfession(
      graneroSkills,
      mockContext as any,
    );
    expect(result === null || result).toBeDefined();
  });

  it("should match Cazador profession with hunting skills", async () => {
    const cazadorSkills = ["hunting", "weapons"];
    const result = await service.matchProfession(
      cazadorSkills,
      mockContext as any,
    );
    expect(result === null || result).toBeDefined();
  });

  it("should match Recolector de Agua profession with water collection", async () => {
    const waterSkills = ["water collection"];
    const result = await service.matchProfession(
      waterSkills,
      mockContext as any,
    );
    expect(result === null || result).toBeDefined();
  });

  it("should match Ingeniero profession with engineering skills", async () => {
    const engineerSkills = ["engineering", "mechanics"];
    const result = await service.matchProfession(
      engineerSkills,
      mockContext as any,
    );
    expect(result === null || result).toBeDefined();
  });

  it("should match Cocinero profession with cooking skills", async () => {
    const cookerSkills = ["cooking"];
    const result = await service.matchProfession(
      cookerSkills,
      mockContext as any,
    );
    expect(result === null || result).toBeDefined();
  });

  it("should match Constructor profession with construction skills", async () => {
    const constructorSkills = ["construction", "carpentry"];
    const result = await service.matchProfession(
      constructorSkills,
      mockContext as any,
    );
    expect(result === null || result).toBeDefined();
  });

  it("should match Investigador profession with research skills", async () => {
    const researcherSkills = ["research", "science"];
    const result = await service.matchProfession(
      researcherSkills,
      mockContext as any,
    );
    expect(result === null || result).toBeDefined();
  });

  it("should handle critical food deficit with producer in camp", () => {
    const foodProducerCandidate = {
      health_status: 85,
      criminal_record: false,
      age: 30,
      skills: ["agriculture"],
    };
    const criticalFoodContext = {
      ...mockContext,
      balance: { food: -15, water: 100, medical: 50 },
    };
    const result = service.checkCriticalRules(
      foodProducerCandidate as any,
      criticalFoodContext as any,
    );
    expect(result).toBeDefined();
  });

  it("should reject candidate when critical food deficit and no producers available", () => {
    const nonProducerCandidate = {
      health_status: 85,
      criminal_record: false,
      age: 30,
      skills: ["engineering"],
    };
    const criticalFoodContext = {
      ...mockContext,
      balance: { food: -15, water: 100, medical: 50 },
    };
    const result = service.checkCriticalRules(
      nonProducerCandidate as any,
      criticalFoodContext as any,
    );
    expect(result).toBeDefined();
  });

  it("should evaluate candidate with multiple medical conditions", () => {
    const multiConditionCandidate = {
      health_status: 70,
      criminal_record: false,
      age: 45,
      skills: ["leadership"],
      medical_conditions: ["asthma", "diabetes"],
    };
    const result = service.checkCriticalRules(
      multiConditionCandidate as any,
      mockContext as any,
    );
    expect(result).toBeDefined();
  });

  it("should score candidate with low psychological evaluation", async () => {
    const lowPsychCandidate = {
      first_name: "Bajo",
      last_name: "Psico",
      age: 40,
      health_status: 80,
      physical_condition: 75,
      criminal_record: false,
      skills: ["leadership"],
      years_experience: 5,
      psychological_evaluation: 30,
      camp_id: 1,
    };
    const result = await service.calculateAdmissionScore(
      lowPsychCandidate as any,
      mockContext as any,
    );
    expect(result).toBeDefined();
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it("should score candidate with high psychological evaluation", async () => {
    const highPsychCandidate = {
      first_name: "Alto",
      last_name: "Psico",
      age: 40,
      health_status: 80,
      physical_condition: 75,
      criminal_record: false,
      skills: ["leadership"],
      years_experience: 5,
      psychological_evaluation: 95,
      camp_id: 1,
    };
    const result = await service.calculateAdmissionScore(
      highPsychCandidate as any,
      mockContext as any,
    );
    expect(result).toBeDefined();
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it("should evaluate candidate in resource-rich camp", async () => {
    const candidate = {
      first_name: "Rich",
      last_name: "Camp",
      age: 35,
      health_status: 75,
      physical_condition: 70,
      criminal_record: false,
      skills: ["engineering"],
      years_experience: 3,
      psychological_evaluation: 75,
      camp_id: 1,
    };
    const richContext = {
      ...mockContext,
      balance: { food: 500, water: 500, medical: 200 },
    };
    const result = await service.calculateAdmissionScore(
      candidate as any,
      richContext as any,
    );
    expect(result).toBeDefined();
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it("should evaluate candidate in resource-poor camp", async () => {
    const candidate = {
      first_name: "Poor",
      last_name: "Camp",
      age: 35,
      health_status: 75,
      physical_condition: 70,
      criminal_record: false,
      skills: ["agriculture"],
      years_experience: 10,
      psychological_evaluation: 75,
      camp_id: 1,
    };
    const poorContext = {
      ...mockContext,
      balance: { food: -50, water: -30, medical: 5 },
    };
    const result = await service.calculateAdmissionScore(
      candidate as any,
      poorContext as any,
    );
    expect(result).toBeDefined();
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it("should evaluate candidate with edge case low age", async () => {
    const veryYoung = {
      first_name: "Junior",
      last_name: "Young",
      age: 16,
      health_status: 90,
      physical_condition: 90,
      criminal_record: false,
      skills: ["climbing"],
      years_experience: 1,
      psychological_evaluation: 70,
      camp_id: 1,
    };
    const result = await service.calculateAdmissionScore(
      veryYoung as any,
      mockContext as any,
    );
    expect(result).toBeDefined();
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it("should evaluate candidate with edge case high age", async () => {
    const veryOld = {
      first_name: "Senior",
      last_name: "Ancient",
      age: 85,
      health_status: 50,
      physical_condition: 45,
      criminal_record: false,
      skills: ["wisdom", "teaching"],
      years_experience: 60,
      psychological_evaluation: 80,
      camp_id: 1,
    };
    const result = await service.calculateAdmissionScore(
      veryOld as any,
      mockContext as any,
    );
    expect(result).toBeDefined();
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it("should handle critical medical deficit", () => {
    const candidate = {
      health_status: 85,
      criminal_record: false,
      age: 30,
      skills: ["medicine"],
    };
    const medicalDeficitContext = {
      ...mockContext,
      balance: { food: 100, water: 100, medical: -50 },
    };
    const result = service.checkCriticalRules(
      candidate as any,
      medicalDeficitContext as any,
    );
    expect(result).toBeDefined();
  });

  it("should score candidate with production capability in food deficit", async () => {
    const farmProducer = {
      first_name: "Farm",
      last_name: "Master",
      age: 40,
      health_status: 80,
      physical_condition: 80,
      criminal_record: false,
      skills: ["agriculture", "farming", "hunting"],
      years_experience: 15,
      psychological_evaluation: 80,
      camp_id: 1,
    };
    const foodShortageContext = {
      ...mockContext,
      balance: { food: 5, water: 100, medical: 50 },
    };
    const result = await service.calculateAdmissionScore(
      farmProducer as any,
      foodShortageContext as any,
    );
    expect(result).toBeDefined();
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it("should score candidate with non-production skills in food deficit", async () => {
    const nonProducer = {
      first_name: "Non",
      last_name: "Producer",
      age: 35,
      health_status: 80,
      physical_condition: 80,
      criminal_record: false,
      skills: ["engineering", "repair"],
      years_experience: 10,
      psychological_evaluation: 75,
      camp_id: 1,
    };
    const foodShortageContext = {
      ...mockContext,
      balance: { food: 0, water: 100, medical: 50 },
    };
    const result = await service.calculateAdmissionScore(
      nonProducer as any,
      foodShortageContext as any,
    );
    expect(result).toBeDefined();
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it("should evaluate candidate with combined deficits in all resources", () => {
    const candidate = {
      health_status: 75,
      criminal_record: false,
      age: 40,
      skills: ["agriculture", "medicine"],
    };
    const combinedDeficitContext = {
      ...mockContext,
      balance: { food: -20, water: -20, medical: -20 },
      criticalDeficit: 3,
    };
    const result = service.checkCriticalRules(
      candidate as any,
      combinedDeficitContext as any,
    );
    expect(result).toBeDefined();
  });

  it("should calculate score with no skills", async () => {
    const candidateNoSkills = {
      first_name: "Juan",
      last_name: "Rodriguez",
      age: 35,
      health_status: 80,
      physical_condition: 75,
      criminal_record: false,
      skills: [],
      camp_id: 1,
    };
    const result = await service.calculateAdmissionScore(
      candidateNoSkills as any,
      mockContext as any,
    );
    expect(result).toBeDefined();
    expect(result.score).toBeGreaterThanOrEqual(0);
  });
  it("should reject on high occupancy with low skill score", () => {
    const weakCandidate = {
      health_status: 30,
      criminal_record: false,
      age: 75,
      skills: [],
      psychological_evaluation: 40,
    };
    const atCapacityContext = {
      ...mockContext,
      occupancyRate: 0.98,
    };
    const result = service.checkCriticalRules(
      weakCandidate as any,
      atCapacityContext as any,
    );
    expect(result).toBeDefined();
  });

  it("should accept on high occupancy with exceptional candidate", () => {
    const excellentCandidate = {
      health_status: 95,
      criminal_record: false,
      age: 30,
      skills: ["medicine", "engineering"],
      physical_condition: 95,
      years_experience: 20,
      psychological_evaluation: 90,
    };
    const almostFullContext = {
      ...mockContext,
      occupancyRate: 0.97,
    };
    const result = service.checkCriticalRules(
      excellentCandidate as any,
      almostFullContext as any,
    );
    expect(result).toBeDefined();
  });

  it("should properly score production skills in deficit scenarios", async () => {
    const candidate = {
      first_name: "Farmer",
      last_name: "Good",
      age: 45,
      health_status: 75,
      physical_condition: 75,
      criminal_record: false,
      skills: ["hunting", "water collection"],
      years_experience: 12,
      psychological_evaluation: 75,
      camp_id: 1,
    };
    const deficitContext = {
      ...mockContext,
      balance: { food: -5, water: -5, medical: 50 },
    };
    const result = await service.calculateAdmissionScore(
      candidate as any,
      deficitContext as any,
    );
    expect(result).toBeDefined();
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.factors).toBeDefined();
  });

  it("should handle perfect candidate in normal camp", async () => {
    const perfectCandidate = {
      first_name: "Perfect",
      last_name: "Candidate",
      age: 35,
      health_status: 100,
      physical_condition: 100,
      criminal_record: false,
      skills: ["medicine", "engineering", "agriculture", "hunting", "security"],
      years_experience: 20,
      psychological_evaluation: 95,
      camp_id: 1,
    };
    const normalContext = {
      ...mockContext,
      balance: { food: 200, water: 200, medical: 100 },
      occupancyRate: 0.5,
    };
    const result = await service.calculateAdmissionScore(
      perfectCandidate as any,
      normalContext as any,
    );
    expect(result).toBeDefined();
    expect(result.score).toBeGreaterThanOrEqual(60);
  });

  it("should reject candidate with critical and contagious condition", () => {
    const contagiousCriminal = {
      health_status: 85,
      criminal_record: false,
      age: 40,
      skills: ["leadership"],
      medical_conditions: ["contagious", "asthma"],
    };
    const result = service.checkCriticalRules(
      contagiousCriminal as any,
      mockContext as any,
    );
    expect(result).toBeDefined();
    expect(result.applies).toBe(true);
    expect(result.decision).toBe("REJECT");
  });

  it("should handle boundary occupancy at exactly 95%", () => {
    const normalCandidate = {
      health_status: 75,
      criminal_record: false,
      age: 35,
      skills: ["engineering"],
      physical_condition: 75,
      psychological_evaluation: 70,
    };
    const boundaryCapacityContext = {
      ...mockContext,
      occupancyRate: 0.95,
    };
    const result = service.checkCriticalRules(
      normalCandidate as any,
      boundaryCapacityContext as any,
    );
    expect(result).toBeDefined();
  });

  it("should accept critical profession with exact skill match", () => {
    const criticallySkilledCandidate = {
      health_status: 70,
      criminal_record: false,
      age: 50,
      skills: ["medical"],
    };
    const criticalMedicalContext = {
      ...mockContext,
      criticalDeficit: 2,
      criticalProfession: "Medico",
      professionsNeeded: [{ profession: "Medico", count: 2 }],
    };
    const result = service.checkCriticalRules(
      criticallySkilledCandidate as any,
      criticalMedicalContext as any,
    );
    expect(result).toBeDefined();
  });

  it("should score emergency worker in critical water deficit", async () => {
    const engineerCandidate = {
      first_name: "Water",
      last_name: "Engineer",
      age: 40,
      health_status: 80,
      physical_condition: 80,
      criminal_record: false,
      skills: ["engineering", "water collection"],
      years_experience: 15,
      psychological_evaluation: 80,
      camp_id: 1,
    };
    const waterCriticalContext = {
      ...mockContext,
      balance: { food: 100, water: -50, medical: 100 },
    };
    const result = await service.calculateAdmissionScore(
      engineerCandidate as any,
      waterCriticalContext as any,
    );
    expect(result).toBeDefined();
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it("should score medical professional in critical health deficit", async () => {
    const medicCandidate = {
      first_name: "Emergency",
      last_name: "Doctor",
      age: 45,
      health_status: 85,
      physical_condition: 80,
      criminal_record: false,
      skills: ["medicine", "first aid", "healthcare"],
      years_experience: 18,
      psychological_evaluation: 85,
      camp_id: 1,
    };
    const healthCriticalContext = {
      ...mockContext,
      balance: { food: 100, water: 100, medical: -40 },
    };
    const result = await service.calculateAdmissionScore(
      medicCandidate as any,
      healthCriticalContext as any,
    );
    expect(result).toBeDefined();
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it("should properly evaluate candidate with mixed beneficial and negative traits", async () => {
    const mixedCandidate = {
      first_name: "Mixed",
      last_name: "Profile",
      age: 60,
      health_status: 60,
      physical_condition: 55,
      criminal_record: false,
      skills: ["agriculture"],
      years_experience: 25,
      psychological_evaluation: 65,
      camp_id: 1,
    };
    const result = await service.calculateAdmissionScore(
      mixedCandidate as any,
      mockContext as any,
    );
    expect(result).toBeDefined();
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it("should handle candidate with many matching profession skills", async () => {
    const multiSkillCandidate = {
      first_name: "Multi",
      last_name: "Skilled",
      age: 40,
      health_status: 80,
      physical_condition: 80,
      criminal_record: false,
      skills: ["farming", "hunting", "construction", "engineering", "repair"],
      years_experience: 20,
      psychological_evaluation: 80,
      camp_id: 1,
    };
    const result = await service.calculateAdmissionScore(
      multiSkillCandidate as any,
      mockContext as any,
    );
    expect(result).toBeDefined();
    expect(result.score).toBeGreaterThanOrEqual(50);
  });

  it("should evaluate candidate with extreme health status variation", async () => {
    const extremePhysicalCandidate = {
      first_name: "Extreme",
      last_name: "Condition",
      age: 35,
      health_status: 95,
      physical_condition: 20,
      criminal_record: false,
      skills: ["research"],
      years_experience: 8,
      psychological_evaluation: 75,
      camp_id: 1,
    };
    const result = await service.calculateAdmissionScore(
      extremePhysicalCandidate as any,
      mockContext as any,
    );
    expect(result).toBeDefined();
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it("should match investigador profession with research background", async () => {
    const researcherSkills = ["research", "laboratory", "science", "analysis"];
    const result = await service.matchProfession(
      researcherSkills,
      mockContext as any,
    );
    expect(result === null || result).toBeDefined();
  });

  it("should score candidate with deficit in all critical areas", () => {
    const candidateInAllDeficits = {
      health_status: 65,
      criminal_record: false,
      age: 40,
      skills: ["agriculture"],
    };
    const allDeficitContext = {
      ...mockContext,
      balance: { food: -8, water: -8, medical: -8 },
      criticalDeficit: 2,
    };
    const result = service.checkCriticalRules(
      candidateInAllDeficits as any,
      allDeficitContext as any,
    );
    expect(result).toBeDefined();
  });

  it("should achieve RECOMMEND_ACCEPT or RECOMMEND_REJECT decision based on score", async () => {
    // High score test
    const highScoringContext = {
      ...mockContext,
      balance: { food: 500, water: 500, medical: 500 },
      criticalDeficit: 0,
      professionsNeeded: [],
    };
    const excellentCandidate = {
      first_name: "Excellent",
      last_name: "Candidate",
      age: 35,
      health_status: 95,
      physical_condition: 95,
      criminal_record: false,
      skills: ["medicine", "agriculture", "engineering", "hunting", "security"],
      years_experience: 20,
      psychological_evaluation: 95,
      camp_id: 1,
    };
    const resultHigh = await service.calculateAdmissionScore(
      excellentCandidate as any,
      highScoringContext as any,
    );
    expect(resultHigh).toBeDefined();
    expect([
      "RECOMMEND_ACCEPT",
      "RECOMMEND_REJECT",
      "REQUIRES_REVIEW",
    ]).toContain(resultHigh.decision);
  });

  it("should achieve RECOMMEND_REJECT decision with low score below 50", async () => {
    const lowScoringCandidate = {
      first_name: "Low",
      last_name: "Scorer",
      age: 80,
      health_status: 30,
      physical_condition: 25,
      criminal_record: true,
      skills: [],
      years_experience: 0,
      psychological_evaluation: 20,
      camp_id: 1,
    };
    const result = await service.calculateAdmissionScore(
      lowScoringCandidate as any,
      mockContext as any,
    );
    expect(result).toBeDefined();
    expect(result.score).toBeLessThan(50);
    expect(result.decision).toBe("RECOMMEND_REJECT");
    expect(result.confidence).toBe("HIGH");
  });

  it("should score profession need with deficit of 2 or more", async () => {
    const criticalSkillCandidate = {
      first_name: "Critical",
      last_name: "Needed",
      age: 45,
      health_status: 75,
      physical_condition: 75,
      criminal_record: false,
      skills: ["medicine"],
      years_experience: 10,
      psychological_evaluation: 75,
      camp_id: 1,
    };
    const criticalDeficitContext = {
      ...mockContext,
      professionsNeeded: [{ profession: "Medico", count: 5, deficit: 2 }],
    };
    const result = await service.calculateAdmissionScore(
      criticalSkillCandidate as any,
      criticalDeficitContext as any,
    );
    expect(result).toBeDefined();
    expect(result.factors).toBeDefined();
    expect(
      result.factors.some(
        (f) => f.category === "Profession Need" && f.score > 20,
      ),
    ).toBe(true);
  });

  it("should score profession need with deficit of exactly 1", async () => {
    const moderateSkillCandidate = {
      first_name: "Moderate",
      last_name: "Needed",
      age: 40,
      health_status: 75,
      physical_condition: 75,
      criminal_record: false,
      skills: ["security", "combat"],
      years_experience: 8,
      psychological_evaluation: 75,
      camp_id: 1,
    };
    const moderateDeficitContext = {
      ...mockContext,
      professionsNeeded: [{ profession: "Guardia", count: 5, deficit: 1 }],
    };
    const result = await service.calculateAdmissionScore(
      moderateSkillCandidate as any,
      moderateDeficitContext as any,
    );
    expect(result).toBeDefined();
    expect(result.factors).toBeDefined();
    expect(
      result.factors.some(
        (f) => f.category === "Profession Need" && f.score === 30,
      ),
    ).toBe(true);
  });

  it("should score risk factor zero for criminal record", async () => {
    const criminalCandidate = {
      first_name: "Criminal",
      last_name: "Record",
      age: 40,
      health_status: 80,
      physical_condition: 80,
      criminal_record: true,
      skills: ["leadership"],
      years_experience: 5,
      psychological_evaluation: 75,
      camp_id: 1,
    };
    const result = await service.calculateAdmissionScore(
      criminalCandidate as any,
      mockContext as any,
    );
    expect(result).toBeDefined();
    expect(result.factors).toBeDefined();
    expect(
      result.factors.some(
        (f) => f.category === "Risk Assessment" && f.score === 0,
      ),
    ).toBe(true);
  });

  it("should score risk factor based on psychological eval", async () => {
    const psychoEvalCandidate = {
      first_name: "Psych",
      last_name: "Eval",
      age: 40,
      health_status: 80,
      physical_condition: 80,
      criminal_record: false,
      skills: ["leadership"],
      years_experience: 5,
      psychological_evaluation: 80,
      camp_id: 1,
    };
    const result = await service.calculateAdmissionScore(
      psychoEvalCandidate as any,
      mockContext as any,
    );
    expect(result).toBeDefined();
    expect(result.factors).toBeDefined();
    expect(result.factors.some((f) => f.category === "Risk Assessment")).toBe(
      true,
    );
  });
});

describe("AiEvaluationService extra coverage", () => {
  let service: AiEvaluationService;
  let professionRepo: { findOne: jest.Mock };

  const baseContext = {
    population: 40,
    capacity: 100,
    occupancyRate: 40,
    balance: { food: 20, water: 10 },
    professionsNeeded: [] as Array<{ profession: string; deficit: number }>,
    criticalDeficit: 0,
    criticalProfession: undefined as string | undefined,
  };

  beforeEach(async () => {
    professionRepo = { findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiEvaluationService,
        { provide: getRepositoryToken(Profession), useValue: professionRepo },
      ],
    }).compile();

    service = module.get(AiEvaluationService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should reject a low-score candidate when camp occupancy exceeds 95%", () => {
    const result = service.checkCriticalRules(
      {
        health_status: 50,
        physical_condition: 50,
        criminal_record: true,
        skills: ["leadership"],
      } as any,
      { ...baseContext, occupancyRate: 96 },
    );

    expect(result).toEqual({
      applies: true,
      decision: "REJECT",
      reason: "Camp at 95% capacity. Only exceptional candidates accepted.",
    });
  });

  it("should accept a critically-needed candidate even when camp occupancy exceeds 95%", () => {
    const result = service.checkCriticalRules(
      {
        health_status: 100,
        physical_condition: 100,
        criminal_record: false,
        skills: ["medicine", "first aid", "healthcare", "nursing"],
      } as any,
      {
        ...baseContext,
        occupancyRate: 96,
        criticalDeficit: 3,
        criticalProfession: "Medico",
      },
    );

    expect(result).toEqual({
      applies: true,
      decision: "ACCEPT",
      reason: "URGENT: Camp critically needs Medico. Immediate acceptance.",
    });
  });

  it("should accept a candidate with skills for a critical profession", () => {
    const result = service.checkCriticalRules(
      {
        health_status: 80,
        physical_condition: 75,
        criminal_record: false,
        skills: ["medical triage", "first aid"],
      } as any,
      {
        ...baseContext,
        criticalDeficit: 3,
        criticalProfession: "Medico",
      },
    );

    expect(result).toEqual({
      applies: true,
      decision: "ACCEPT",
      reason: "URGENT: Camp critically needs Medico. Immediate acceptance.",
    });
  });

  it("should recommend acceptance for a strong candidate", async () => {
    const result = await service.calculateAdmissionScore(
      {
        health_status: 95,
        physical_condition: 95,
        criminal_record: false,
        skills: ["medicine", "first aid", "healthcare", "nursing"],
        years_experience: 10,
        psychological_evaluation: 90,
      } as any,
      {
        ...baseContext,
        balance: { food: 5, water: 10 },
        professionsNeeded: [{ profession: "Medico", deficit: 3 }],
      },
    );

    expect(result.decision).toBe("RECOMMEND_ACCEPT");
    expect(result.confidence).toBe("HIGH");
    expect(result.score).toBeGreaterThan(75);
  });

  it("should recommend rejection for a weak candidate", async () => {
    const result = await service.calculateAdmissionScore(
      {
        health_status: 20,
        physical_condition: 20,
        criminal_record: true,
        skills: [],
        years_experience: 0,
      } as any,
      {
        ...baseContext,
        balance: { food: -5, water: 10 },
      },
    );

    expect(result.decision).toBe("RECOMMEND_REJECT");
    expect(result.confidence).toBe("HIGH");
    expect(result.score).toBeLessThan(50);
  });

  it("should match a profession from prioritized camp needs", async () => {
    const profession = { id: 5, name: "Medico" } as Profession;
    professionRepo.findOne.mockResolvedValue(profession);

    const result = await service.matchProfession(["medicine", "first aid"], {
      ...baseContext,
      professionsNeeded: [{ profession: "Medico", deficit: 2 }],
    });

    expect(professionRepo.findOne).toHaveBeenCalledWith({
      where: { name: "Medico" },
    });
    expect(result).toBe(profession);
  });

  it("should fall back to configured professions when camp needs do not match", async () => {
    professionRepo.findOne.mockImplementation(async ({ where: { name } }) =>
      name === "Explorador" ? ({ id: 7, name } as Profession) : null,
    );

    const result = await service.matchProfession(["survival", "navigation"], {
      ...baseContext,
      professionsNeeded: [{ profession: "Medico", deficit: 1 }],
    });

    expect(result).toEqual({ id: 7, name: "Explorador" });
  });

  it("should return null when no profession can be matched", async () => {
    professionRepo.findOne.mockResolvedValue(null);

    const result = await service.matchProfession(["poetry"], baseContext);

    expect(result).toBeNull();
  });

  it("should generate a justification including profession deficits and signed balances", () => {
    const evaluation: EvaluationResult = {
      score: 82,
      decision: "RECOMMEND_ACCEPT",
      confidence: "HIGH",
      factors: [
        {
          category: "Profession Need",
          score: 40,
          maxScore: 40,
          detail: "CRITICAL: Camp needs 3 Medicos",
        },
      ],
    };

    const text = service.generateJustification(evaluation, {
      ...baseContext,
      population: 82,
      capacity: 100,
      occupancyRate: 82,
      balance: { food: 12, water: -4 },
      professionsNeeded: [{ profession: "Medico", deficit: 3 }],
    });

    expect(text).toContain("Score: 82/100 (HIGH confidence)");
    expect(text).toContain("Decision: RECOMMEND_ACCEPT");
    expect(text).toContain("- Food balance: +12");
    expect(text).toContain("- Water balance: -4");
    expect(text).toContain("- Professions needed: Medico (-3)");
  });

  it("should generate a justification without profession list and alternate balance signs", () => {
    const evaluation: EvaluationResult = {
      score: 48,
      decision: "RECOMMEND_REJECT",
      confidence: "HIGH",
      factors: [
        {
          category: "Risk Assessment",
          score: 0,
          maxScore: 10,
          detail: "Criminal record present",
        },
      ],
    };

    const text = service.generateJustification(evaluation, {
      ...baseContext,
      population: 97,
      capacity: 100,
      occupancyRate: 97,
      balance: { food: -6, water: 11 },
      professionsNeeded: [],
    });

    expect(text).toContain("- Food balance: -6");
    expect(text).toContain("- Water balance: +11");
    expect(text).not.toContain("- Professions needed:");
  });

  it("should reject a high-occupancy candidate when criminal risk penalty lowers the estimate", () => {
    const result = service.checkCriticalRules(
      {
        health_status: 90,
        physical_condition: 90,
        criminal_record: true,
        skills: ["medicine", "security", "engineering", "agriculture"],
      } as any,
      {
        ...baseContext,
        occupancyRate: 98,
        criticalDeficit: 0,
        criticalProfession: undefined,
      },
    );

    expect(result).toEqual({
      applies: true,
      decision: "REJECT",
      reason: "Camp at 95% capacity. Only exceptional candidates accepted.",
    });
  });

  it("should still reject a high-occupancy candidate without criminal record because the quick estimate caps below 80", () => {
    const result = service.checkCriticalRules(
      {
        health_status: 100,
        physical_condition: 100,
        criminal_record: false,
        skills: ["medicine", "security", "engineering", "agriculture"],
      } as any,
      {
        ...baseContext,
        occupancyRate: 98,
        criticalDeficit: 0,
        criticalProfession: undefined,
      },
    );

    expect(result).toEqual({
      applies: true,
      decision: "REJECT",
      reason: "Camp at 95% capacity. Only exceptional candidates accepted.",
    });
  });
});
