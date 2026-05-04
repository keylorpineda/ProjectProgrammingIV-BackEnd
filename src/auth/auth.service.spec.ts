import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { UnauthorizedException } from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { AuthService } from "./auth.service";
import { LoginAttempt } from "./entities/login-attempt.entity";
import { Session } from "./entities/session.entity";
import { UserAccount } from "../users/entities/user-account.entity";
import { Camp } from "../camps/entities/camp.entity";

jest.mock("bcrypt");

describe("AuthService", () => {
  let service: AuthService;
  let jwtService: jest.Mocked<JwtService>;
  let loginAttemptRepo: any;
  let sessionRepo: any;
  let userRepo: any;

  const mockUser = {
    id: 1,
    username: "testuser",
    email: "test@example.com",
    password_hash: "$2b$12$hashedpassword",
    last_access: new Date(),
    camp_id: 1,
    role: { name: "USER" },
    camp: { id: 1, name: "Camp 1" },
    person: { id: 1, name: "Test Person" },
  };

  const mockSession = {
    id: 1,
    user_id: 1,
    token_hash: "$2b$12$hashedtoken",
    last_activity: new Date(),
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    is_active: true,
    auto_logout: false,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
            verify: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(LoginAttempt),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            count: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Session),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(UserAccount),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Camp),
          useValue: {
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jwtService = module.get(JwtService) as jest.Mocked<JwtService>;
    loginAttemptRepo = module.get(getRepositoryToken(LoginAttempt));
    sessionRepo = module.get(getRepositoryToken(Session));
    userRepo = module.get(getRepositoryToken(UserAccount));

    (bcrypt.hash as jest.Mock).mockResolvedValue("$2b$12$hashedvalue");
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
  });

  describe("login", () => {
    it("should successfully login and return tokens", async () => {
      const loginDto = { username: "testuser", password: "password123" };
      const ipAddress = "192.168.1.1";
      const userAgent = "Mozilla/5.0";

      userRepo.findOne.mockResolvedValueOnce(mockUser);
      jwtService.sign.mockReturnValueOnce("access_token");
      jwtService.sign.mockReturnValueOnce("refresh_token");
      loginAttemptRepo.create.mockReturnValue({});
      sessionRepo.create.mockReturnValue(mockSession);

      const result = await service.login(loginDto, ipAddress, userAgent);

      expect(result).toHaveProperty("access_token");
      expect(result).toHaveProperty("refresh_token");
      expect(result).toHaveProperty("user");
      expect(result.user.username).toBe("testuser");
      expect(userRepo.findOne).toHaveBeenCalledWith({
        where: { username: "testuser" },
        relations: ["role", "camp", "person"],
      });
    });

    it("should throw error when user not found", async () => {
      const loginDto = { username: "nonexistent", password: "password123" };
      const ipAddress = "192.168.1.1";

      userRepo.findOne.mockResolvedValueOnce(null);
      loginAttemptRepo.count.mockResolvedValueOnce(0);

      await expect(service.login(loginDto, ipAddress)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should throw error when password is invalid", async () => {
      const loginDto = { username: "testuser", password: "wrongpassword" };
      const ipAddress = "192.168.1.1";

      userRepo.findOne.mockResolvedValueOnce(mockUser);
      loginAttemptRepo.count.mockResolvedValueOnce(0);
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false);

      await expect(service.login(loginDto, ipAddress)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should throw error when too many login attempts", async () => {
      const loginDto = { username: "testuser", password: "password123" };
      const ipAddress = "192.168.1.1";

      loginAttemptRepo.count.mockResolvedValueOnce(1000); // MAX_LOGIN_ATTEMPTS = 1000

      await expect(service.login(loginDto, ipAddress)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should log successful login attempt", async () => {
      const loginDto = { username: "testuser", password: "password123" };
      const ipAddress = "192.168.1.1";

      userRepo.findOne.mockResolvedValueOnce(mockUser);
      jwtService.sign.mockReturnValueOnce("access_token");
      jwtService.sign.mockReturnValueOnce("refresh_token");
      loginAttemptRepo.create.mockReturnValue({});
      sessionRepo.create.mockReturnValue(mockSession);

      await service.login(loginDto, ipAddress);

      expect(loginAttemptRepo.save).toHaveBeenCalled();
    });

    it("should set role as unknown when user has no role", async () => {
      const loginDto = { username: "testuser", password: "password123" };
      const ipAddress = "192.168.1.1";
      const userWithoutRole = {
        ...mockUser,
        role: null,
      };

      userRepo.findOne.mockResolvedValueOnce(userWithoutRole);
      jwtService.sign.mockReturnValueOnce("access_token");
      jwtService.sign.mockReturnValueOnce("refresh_token");
      loginAttemptRepo.create.mockReturnValue({});
      sessionRepo.create.mockReturnValue(mockSession);

      const result = await service.login(loginDto, ipAddress);

      expect(result.user.role).toBe("unknown");
    });
  });

  describe("logout", () => {
    it("should logout user and invalidate session", async () => {
      const userId = 1;

      sessionRepo.update.mockResolvedValueOnce({});

      await service.logout(userId);

      expect(sessionRepo.update).toHaveBeenCalledWith(
        { user_id: userId, is_active: true },
        { is_active: false, auto_logout: false },
      );
    });

    it("should logout with specific refresh token", async () => {
      const userId = 1;
      const refreshToken = "refresh_token";

      sessionRepo.find.mockResolvedValueOnce([mockSession]);

      await service.logout(userId, refreshToken);

      expect(sessionRepo.find).toHaveBeenCalled();
    });

    it("should handle logout when session not found", async () => {
      const userId = 1;
      const refreshToken = "refresh_token";

      sessionRepo.find.mockResolvedValueOnce([]);
      sessionRepo.update.mockResolvedValueOnce({});

      await service.logout(userId, refreshToken);

      expect(sessionRepo.update).toHaveBeenCalled();
    });
  });

  describe("refresh", () => {
    it("should refresh token successfully", async () => {
      const refreshToken = "refresh_token";
      const payload = { sub: 1, username: "testuser" };

      jwtService.verify.mockReturnValueOnce(payload);
      sessionRepo.find.mockResolvedValueOnce([mockSession]);
      userRepo.findOne.mockResolvedValueOnce(mockUser);
      jwtService.sign.mockReturnValueOnce("new_access_token");
      jwtService.sign.mockReturnValueOnce("new_refresh_token");

      const result = await service.refresh(refreshToken);

      expect(result).toHaveProperty("access_token");
      expect(result).toHaveProperty("refresh_token");
    });

    it("should throw error when refresh token is invalid", async () => {
      const refreshToken = "invalid_token";

      jwtService.verify.mockImplementationOnce(() => {
        throw new Error("Invalid token");
      });

      await expect(service.refresh(refreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should throw error when session is invalid", async () => {
      const refreshToken = "refresh_token";
      const payload = { sub: 1, username: "testuser" };

      jwtService.verify.mockReturnValueOnce(payload);
      sessionRepo.find.mockResolvedValueOnce([]);

      await expect(service.refresh(refreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should throw error when session is expired", async () => {
      const refreshToken = "refresh_token";
      const payload = { sub: 1, username: "testuser" };
      const expiredSession = {
        ...mockSession,
        expires_at: new Date(Date.now() - 1000), // Past date
      };

      jwtService.verify.mockReturnValueOnce(payload);
      sessionRepo.find.mockResolvedValueOnce([expiredSession]);

      await expect(service.refresh(refreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should handle refresh when user has no role", async () => {
      const refreshToken = "refresh_token";
      const payload = { sub: 1, username: "testuser" };
      const userWithoutRole = {
        ...mockUser,
        role: null,
      };

      jwtService.verify.mockReturnValueOnce(payload);
      sessionRepo.find.mockResolvedValueOnce([mockSession]);
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);
      userRepo.findOne.mockResolvedValueOnce(userWithoutRole);
      jwtService.sign.mockReturnValueOnce("new_access_token");
      jwtService.sign.mockReturnValueOnce("new_refresh_token");
      sessionRepo.save.mockResolvedValueOnce({});

      const result = await service.refresh(refreshToken);

      expect(result).toHaveProperty("access_token");
      expect(result).toHaveProperty("refresh_token");
      expect(userRepo.findOne).toHaveBeenCalledWith({
        where: { id: payload.sub },
        relations: ["role"],
      });
    });

    it("should throw error when user not found during refresh", async () => {
      const refreshToken = "refresh_token";
      const payload = { sub: 1, username: "testuser" };

      jwtService.verify.mockReturnValueOnce(payload);
      sessionRepo.find.mockResolvedValueOnce([mockSession]);
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);
      userRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.refresh(refreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(userRepo.findOne).toHaveBeenCalledWith({
        where: { id: payload.sub },
        relations: ["role"],
      });
    });
  });

  describe("validateUser", () => {
    it("should validate and return user", async () => {
      userRepo.findOne.mockResolvedValueOnce(mockUser);

      const result = await service.validateUser(1);

      expect(result).toEqual(mockUser);
      expect(userRepo.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: ["role", "camp", "person"],
      });
    });

    it("should return null when user not found", async () => {
      userRepo.findOne.mockResolvedValueOnce(null);

      const result = await service.validateUser(999);

      expect(result).toBeNull();
    });
  });

  describe("logLoginAttempt", () => {
    it("should log successful login attempt", async () => {
      const attemptData = {
        username: "testuser",
        ip_address: "192.168.1.1",
        success: true,
        user_id: 1,
      };

      loginAttemptRepo.create.mockReturnValueOnce(attemptData);

      await service.logLoginAttempt(attemptData);

      expect(loginAttemptRepo.create).toHaveBeenCalledWith(attemptData);
      expect(loginAttemptRepo.save).toHaveBeenCalled();
    });

    it("should log failed login attempt", async () => {
      const attemptData = {
        username: "testuser",
        ip_address: "192.168.1.1",
        success: false,
        failure_reason: "Invalid password",
      };

      loginAttemptRepo.create.mockReturnValueOnce(attemptData);

      await service.logLoginAttempt(attemptData);

      expect(loginAttemptRepo.save).toHaveBeenCalled();
    });
  });

  describe("countRecentFailures", () => {
    it("should count recent failures", async () => {
      const ipAddress = "192.168.1.1";

      loginAttemptRepo.count.mockResolvedValueOnce(3);

      const result = await service.countRecentFailures(ipAddress);

      expect(result).toBe(3);
      expect(loginAttemptRepo.count).toHaveBeenCalled();
    });

    it("should return 0 when no recent failures", async () => {
      const ipAddress = "192.168.1.1";

      loginAttemptRepo.count.mockResolvedValueOnce(0);

      const result = await service.countRecentFailures(ipAddress);

      expect(result).toBe(0);
    });
  });

  describe("hashPassword", () => {
    it("should hash password", async () => {
      const password = "password123";

      const result = await service.hashPassword(password);

      expect(bcrypt.hash).toHaveBeenCalledWith(password, 12);
      expect(result).toBe("$2b$12$hashedvalue");
    });
  });

  describe("verifyPassword", () => {
    it("should verify password successfully", async () => {
      const plainPassword = "password123";
      const hashedPassword = "$2b$12$hashedpassword";

      const result = await service.verifyPassword(
        plainPassword,
        hashedPassword,
      );

      expect(bcrypt.compare).toHaveBeenCalledWith(
        plainPassword,
        hashedPassword,
      );
      expect(result).toBe(true);
    });

    it("should return false when password does not match", async () => {
      const plainPassword = "password123";
      const hashedPassword = "$2b$12$hashedpassword";

      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false);

      const result = await service.verifyPassword(
        plainPassword,
        hashedPassword,
      );

      expect(result).toBe(false);
    });
  });

  describe("checkSessionStatus", () => {
    it("should return active session status", async () => {
      const userId = 1;

      sessionRepo.findOne.mockResolvedValueOnce(mockSession);

      const result = await service.checkSessionStatus(userId);

      expect(result).toHaveProperty("isActive");
      expect(result).toHaveProperty("lastActivity");
      expect(result).toHaveProperty("minutesUntilExpiration");
      expect(result).toHaveProperty("willExpireSoon");
      expect(result.isActive).toBe(true);
    });

    it("should return inactive session when no active session", async () => {
      const userId = 999;

      sessionRepo.findOne.mockResolvedValueOnce(null);

      const result = await service.checkSessionStatus(userId);

      expect(result.isActive).toBe(false);
      expect(result.minutesUntilExpiration).toBe(0);
    });

    it("should indicate when session will expire soon", async () => {
      const userId = 1;
      const recentSession = {
        ...mockSession,
        last_activity: new Date(Date.now() - 18 * 60 * 1000), // 18 minutos  atrás
      };

      sessionRepo.findOne.mockResolvedValueOnce(recentSession);

      const result = await service.checkSessionStatus(userId);

      expect(result.willExpireSoon).toBe(true);
    });
  });
});
