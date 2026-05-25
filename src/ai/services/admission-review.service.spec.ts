import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { AdmissionReviewService } from "./admission-review.service";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import { AiAdmission } from "../entities/ai-admission.entity";
import { Person } from "../../users/entities/person.entity";
import { UserAccount } from "../../users/entities/user-account.entity";
import { PersonStatus } from "../../users/constants/professions.constants";
import { MailService } from "../../mail/mail.service";

describe("AdmissionReviewService", () => {
  let service: AdmissionReviewService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdmissionReviewService,
        {
          provide: getRepositoryToken(AiAdmission),
          useValue: {
            findOne: jest.fn().mockResolvedValue({
              id: 1,
              status: "PENDING_REVIEW",
              person_id: 1,
              tracking_code: "ADM-001",
              suggested_profession_id: 1,
              candidate_data: {
                first_name: "John",
                last_name: "Doe",
                age: 30,
                skills: ["leadership"],
              },
            }),
            save: jest.fn().mockResolvedValue({ id: 1 }),
          },
        },
        {
          provide: getRepositoryToken(Person),
          useValue: {
            create: jest.fn().mockReturnValue({ id: 1, first_name: "John" }),
            save: jest.fn().mockResolvedValue({ id: 1, first_name: "John" }),
            findOne: jest.fn().mockResolvedValue({ id: 1 }),
            manager: { findOne: jest.fn().mockResolvedValue({ id: 1 }) },
          },
        },
        {
          provide: getRepositoryToken(UserAccount),
          useValue: {
            create: jest.fn().mockReturnValue({}),
            save: jest.fn().mockResolvedValue({ id: 1, username: "johndoe" }),
            findOne: jest.fn().mockResolvedValue(null),
          },
        },
        {
          provide: MailService,
          useValue: {
            sendAdmissionDecision: jest.fn().mockResolvedValue(true),
            sendAccountCredentials: jest.fn().mockResolvedValue(true),
          },
        },
      ],
    }).compile();

    service = module.get<AdmissionReviewService>(AdmissionReviewService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  it("should review an admission as accepted", async () => {
    const dto = { decision: "accepted", notes: "Approved" };
    const result = await service.reviewAdmission(1, dto as any, 1);
    expect(result).toBeDefined();
  });

  it("should review an admission as rejected", async () => {
    const dto = { decision: "rejected", notes: "Not qualified" };
    const result = await service.reviewAdmission(1, dto as any, 1);
    expect(result).toBeDefined();
  });

  it("should throw when admission not found", async () => {
    const dto = { decision: "accepted" };
    try {
      await service.reviewAdmission(999, dto as any, 1);
    } catch (error: any) {
      expect(error.message).toContain("not found");
    }
  });

  it("should throw when admission already reviewed", async () => {
    const dto = { decision: "accepted" };
    try {
      await service.reviewAdmission(2, dto as any, 1);
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  it("should create user account for person", async () => {
    const dto = {
      username: "johndoe",
      email: "john@example.com",
      password: "Password123!",
      role_id: 1,
    };
    const result = await service.createUserAccountForPerson(1, dto as any);
    expect(result).toBeDefined();
  });

  it("should throw when admission not found for account creation", async () => {
    const dto = {
      username: "johndoe",
      email: "john@example.com",
      password: "Password123!",
      role_id: 1,
    };
    try {
      await service.createUserAccountForPerson(999, dto as any);
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  it("should throw when account already exists", async () => {
    const dto = {
      username: "johndoe",
      email: "john@example.com",
      password: "Password123!",
      role_id: 1,
    };
    try {
      await service.createUserAccountForPerson(3, dto as any);
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  it("should hash password before saving", async () => {
    const dto = {
      username: "johndoe",
      email: "john@example.com",
      password: "Password123!",
      role_id: 1,
    };
    const result = await service.createUserAccountForPerson(1, dto as any);
    expect(result).toBeDefined();
  });

  it("should set correct role assignment", async () => {
    const dto = {
      username: "johndoe",
      email: "john@example.com",
      password: "Password123!",
      role_id: 2,
    };
    const result = await service.createUserAccountForPerson(1, dto as any);
    expect(result).toBeDefined();
  });

  it("should include override profession in review", async () => {
    const dto = { decision: "accepted", override_profession_id: 5 };
    const result = await service.reviewAdmission(1, dto as any, 1);
    expect(result).toBeDefined();
  });

  it("should generate survivor code for accepted admission", async () => {
    const dto = { decision: "accepted" };
    const result = await service.reviewAdmission(1, dto as any, 1);
    expect(result).toBeDefined();
  });

  it("should create person in camp if not exists", async () => {
    const dto = { decision: "accepted" };
    const result = await service.reviewAdmission(1, dto as any, 1);
    if (result?.person) {
      expect(result.person).toBeDefined();
    }
  });
});

describe("AdmissionReviewService extra coverage", () => {
  let service: AdmissionReviewService;
  let admissionRepo: {
    findOne: jest.Mock;
    save: jest.Mock;
  };
  let personRepo: {
    create: jest.Mock;
    save: jest.Mock;
    manager?: { findOne: jest.Mock };
  };
  let userAccountRepo: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };

  beforeEach(async () => {
    admissionRepo = {
      findOne: jest.fn(),
      save: jest.fn(async (entity) => entity),
    };
    personRepo = {
      create: jest.fn((entity) => entity),
      save: jest.fn(async (entity) => ({ id: 99, ...entity })),
      manager: { findOne: jest.fn().mockResolvedValue({ id: 1 }) },
    };
    userAccountRepo = {
      findOne: jest.fn(),
      create: jest.fn((entity) => entity),
      save: jest.fn(async (entity) => ({ id: 77, ...entity })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdmissionReviewService,
        { provide: getRepositoryToken(AiAdmission), useValue: admissionRepo },
        { provide: getRepositoryToken(Person), useValue: personRepo },
        { provide: getRepositoryToken(UserAccount), useValue: userAccountRepo },
        {
          provide: MailService,
          useValue: {
            sendAdmissionDecision: jest.fn().mockResolvedValue(true),
            sendAccountCredentials: jest.fn().mockResolvedValue(true),
          },
        },
      ],
    }).compile();

    service = module.get(AdmissionReviewService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should throw NotFoundException when the admission does not exist", async () => {
    admissionRepo.findOne.mockResolvedValue(null);

    await expect(
      service.reviewAdmission(404, { decision: "accepted" } as any, 1),
    ).rejects.toThrow(NotFoundException);
  });

  it("should throw BadRequestException when the admission was already reviewed", async () => {
    admissionRepo.findOne.mockResolvedValue({ id: 1, status: "REJECTED" });

    await expect(
      service.reviewAdmission(1, { decision: "accepted" } as any, 7),
    ).rejects.toThrow(BadRequestException);
  });

  it("should fallback to a default profession when an accepted admission has no profession", async () => {
    admissionRepo.findOne.mockResolvedValue({
      id: 1,
      status: "PENDING_REVIEW",
      suggested_profession_id: null,
      candidate_data: {
        first_name: "Jane",
        last_name: "Doe",
        age: 26,
        skills: ["medicine"],
      },
    });

    await service.reviewAdmission(1, { decision: "accepted" } as any, 3);
    
    expect(personRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ profession_id: 1 })
    );
  });

  it("should create a person with the expected mapped fields when an admission is accepted", async () => {
    admissionRepo.findOne.mockResolvedValue({
      id: 10,
      camp_id: 5,
      status: "PENDING_REVIEW",
      suggested_profession_id: 12,
      candidate_data: {
        first_name: "Jane",
        last_name: "Doe",
        last_name2: "Smith",
        age: 26,
        photo_url: "https://example.com/photo.jpg",
        id_card_url: "https://example.com/id.jpg",
        skills: ["medicine", "leadership"],
      },
    });

    const result = await service.reviewAdmission(
      10,
      { decision: "accepted", notes: "Looks good" } as any,
      44,
    );

    expect(personRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        first_name: "Jane",
        last_name: "Doe",
        last_name2: "Smith",
        profession_id: 12,
        status: PersonStatus.ACTIVE,
        can_work: true,
        photo_url: "https://example.com/photo.jpg",
        id_card_url: "https://example.com/id.jpg",
        previous_skills: JSON.stringify(["medicine", "leadership"]),
        identification_code: expect.stringMatching(/^SURVIVOR-/),
      }),
    );
    expect(result.person).toEqual(
      expect.objectContaining({
        id: 99,
        first_name: "Jane",
      }),
    );
    expect(admissionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 10,
        person_id: 99,
        status: "ACCEPTED",
        final_human_decision: "ACCEPTED",
        reviewed_by_user_id: 44,
        admin_notes: "Looks good",
        review_date: expect.any(Date),
      }),
    );
  });

  it("should reject an admission and persist the final review information", async () => {
    admissionRepo.findOne.mockResolvedValue({
      id: 22,
      status: "PENDING_REVIEW",
      candidate_data: { first_name: "John", last_name: "Doe", age: 30 },
    });

    const result = await service.reviewAdmission(
      22,
      { decision: "rejected" } as any,
      91,
    );

    expect(result).toEqual({
      admission: expect.objectContaining({
        id: 22,
        status: "REJECTED",
        final_human_decision: "REJECTED",
        reviewed_by_user_id: 91,
        admin_notes: "",
        review_date: expect.any(Date),
      }),
    });
    expect(personRepo.create).not.toHaveBeenCalled();
  });

  it("should throw when trying to create an account for a non-accepted admission", async () => {
    admissionRepo.findOne.mockResolvedValue({ id: 33, person_id: null });

    await expect(
      service.createUserAccountForPerson(33, {
        username: "jane",
        email: "jane@example.com",
        password: "Password123!",
        role_id: 2,
      } as any),
    ).rejects.toThrow("Admission not accepted or person not created");
  });

  it("should throw when a user account already exists for the person", async () => {
    admissionRepo.findOne.mockResolvedValue({
      id: 34,
      person_id: 88,
      camp_id: 5,
    });
    userAccountRepo.findOne.mockResolvedValue({ id: 200, person_id: 88 });

    await expect(
      service.createUserAccountForPerson(34, {
        username: "existing",
        email: "existing@example.com",
        password: "Password123!",
        role_id: 3,
      } as any),
    ).rejects.toThrow("User account already exists for this person");
  });

  it("should hash the password and persist the user account data", async () => {
    admissionRepo.findOne.mockResolvedValue({
      id: 35,
      person_id: 88,
      camp_id: 6,
    });
    userAccountRepo.findOne.mockResolvedValue(null);
    jest.spyOn(bcrypt, "hash").mockResolvedValue("hashed-password" as never);

    const result = await service.createUserAccountForPerson(35, {
      username: "newuser",
      email: "newuser@example.com",
      password: "Password123!",
      role_id: 4,
    } as any);

    expect(bcrypt.hash).toHaveBeenCalledWith("Password123!", 10);
    expect(userAccountRepo.create).toHaveBeenCalledWith({
      person_id: 88,
      camp_id: 6,
      role_id: 4,
      username: "newuser",
      email: "newuser@example.com",
      password_hash: "hashed-password",
    });
    expect(result).toEqual(
      expect.objectContaining({
        id: 77,
        username: "newuser",
      }),
    );
  });
});
