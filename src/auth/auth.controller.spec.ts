import { Test, TestingModule } from "@nestjs/testing";
import { UnauthorizedException } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";

describe("AuthController", () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;

  const mockLoginResponse = {
    access_token: "access_token_value",
    refresh_token: "refresh_token_value",
    user: {
      id: "1",
      username: "testuser",
      email: "test@example.com",
      role: "USER",
      camp_id: "1",
    },
  };

  const mockRefreshResponse = {
    access_token: "new_access_token",
    refresh_token: "new_refresh_token",
  };

  const mockSessionStatus = {
    isActive: true,
    lastActivity: new Date(),
    minutesUntilExpiration: 15,
    willExpireSoon: false,
  };

  const makeMockRes = () => ({
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  });

  const makeMockReq = (refreshToken?: string) => ({
    cookies: refreshToken ? { refresh_token: refreshToken } : {},
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            login: jest.fn(),
            logout: jest.fn(),
            refresh: jest.fn(),
            checkSessionStatus: jest.fn(),
            switchCamp: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService) as jest.Mocked<AuthService>;
  });

  describe("login", () => {
    it("should login successfully and set cookie + return access_token/user", async () => {
      const loginDto = { username: "testuser", password: "password123" };
      const ipAddress = "192.168.1.1";
      const userAgent = "Mozilla/5.0";
      const mockRes = makeMockRes();

      authService.login.mockResolvedValueOnce(mockLoginResponse);

      const result = await controller.login(loginDto, ipAddress, userAgent, mockRes as any);

      expect(result).toEqual({ access_token: mockLoginResponse.access_token, user: mockLoginResponse.user });
      expect(mockRes.cookie).toHaveBeenCalledWith(
        "refresh_token",
        "refresh_token_value",
        expect.objectContaining({ httpOnly: true, path: "/api/v1/auth" }),
      );
      expect(authService.login).toHaveBeenCalledWith(loginDto, ipAddress, userAgent);
    });

    it("should login without user agent", async () => {
      const loginDto = { username: "testuser", password: "password123" };
      const ipAddress = "192.168.1.1";
      const mockRes = makeMockRes();

      authService.login.mockResolvedValueOnce(mockLoginResponse);

      const result = await controller.login(loginDto, ipAddress, undefined, mockRes as any);

      expect(result).toHaveProperty("access_token");
      expect(result).not.toHaveProperty("refresh_token");
      expect(authService.login).toHaveBeenCalledWith(loginDto, ipAddress, undefined);
    });

    it("should reject login with invalid credentials", async () => {
      const loginDto = { username: "testuser", password: "wrongpassword" };
      const ipAddress = "192.168.1.1";

      authService.login.mockRejectedValueOnce(new Error("Invalid credentials"));

      await expect(controller.login(loginDto, ipAddress)).rejects.toThrow(
        "Invalid credentials",
      );
    });

    it("should handle too many login attempts", async () => {
      const loginDto = { username: "testuser", password: "password123" };
      const ipAddress = "192.168.1.1";

      authService.login.mockRejectedValueOnce(new Error("Too many login attempts"));

      await expect(controller.login(loginDto, ipAddress)).rejects.toThrow(
        "Too many login attempts",
      );
    });
  });

  describe("logout", () => {
    it("should logout successfully and clear cookie", async () => {
      const mockUser = { userId: 1 };
      const mockReq = makeMockReq("refresh_token_value");
      const mockRes = makeMockRes();

      authService.logout.mockResolvedValueOnce(undefined);

      await controller.logout(mockUser, mockReq as any, mockRes as any);

      expect(authService.logout).toHaveBeenCalledWith(1, "refresh_token_value");
      expect(mockRes.clearCookie).toHaveBeenCalledWith("refresh_token", { path: "/api/v1/auth" });
    });

    it("should logout even when no refresh_token cookie present", async () => {
      const mockUser = { userId: 1 };
      const mockReq = makeMockReq();
      const mockRes = makeMockRes();

      authService.logout.mockResolvedValueOnce(undefined);

      await controller.logout(mockUser, mockReq as any, mockRes as any);

      expect(authService.logout).toHaveBeenCalledWith(1, undefined);
      expect(mockRes.clearCookie).toHaveBeenCalled();
    });

    it("should handle logout for different user IDs", async () => {
      const mockUser = { userId: 5 };
      const mockReq = makeMockReq();
      const mockRes = makeMockRes();

      authService.logout.mockResolvedValueOnce(undefined);

      await controller.logout(mockUser, mockReq as any, mockRes as any);

      expect(authService.logout).toHaveBeenCalledWith(5, undefined);
    });
  });

  describe("refresh", () => {
    it("should refresh tokens from cookie and set new cookie", async () => {
      const mockReq = makeMockReq("refresh_token_value");
      const mockRes = makeMockRes();

      authService.refresh.mockResolvedValueOnce(mockRefreshResponse);

      const result = await controller.refresh(mockReq as any, mockRes as any);

      expect(result).toEqual({ access_token: "new_access_token" });
      expect(authService.refresh).toHaveBeenCalledWith("refresh_token_value");
      expect(mockRes.cookie).toHaveBeenCalledWith(
        "refresh_token",
        "new_refresh_token",
        expect.objectContaining({ httpOnly: true }),
      );
    });

    it("should throw UnauthorizedException when no refresh_token cookie", async () => {
      const mockReq = makeMockReq();
      const mockRes = makeMockRes();

      await expect(controller.refresh(mockReq as any, mockRes as any)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should reject invalid refresh token", async () => {
      const mockReq = makeMockReq("invalid_token");
      const mockRes = makeMockRes();

      authService.refresh.mockRejectedValueOnce(new Error("Invalid refresh token"));

      await expect(controller.refresh(mockReq as any, mockRes as any)).rejects.toThrow(
        "Invalid refresh token",
      );
    });

    it("should reject expired refresh token", async () => {
      const mockReq = makeMockReq("expired_token");
      const mockRes = makeMockRes();

      authService.refresh.mockRejectedValueOnce(new Error("Token expired"));

      await expect(controller.refresh(mockReq as any, mockRes as any)).rejects.toThrow(
        "Token expired",
      );
    });
  });

  describe("checkSessionStatus", () => {
    it("should return active session status", async () => {
      const mockUser = { userId: 1 };

      authService.checkSessionStatus.mockResolvedValueOnce(mockSessionStatus);

      const result = await controller.checkSessionStatus(mockUser);

      expect(result).toEqual(mockSessionStatus);
      expect(authService.checkSessionStatus).toHaveBeenCalledWith(1);
    });

    it("should return session expiration info", async () => {
      const mockUser = { userId: 1 };
      const soonToExpireStatus = {
        isActive: true,
        lastActivity: new Date(),
        minutesUntilExpiration: 2,
        willExpireSoon: true,
      };

      authService.checkSessionStatus.mockResolvedValueOnce(soonToExpireStatus);

      const result = await controller.checkSessionStatus(mockUser);

      expect(result.willExpireSoon).toBe(true);
    });

    it("should return inactive session status", async () => {
      const mockUser = { userId: 1 };
      const inactiveStatus = {
        isActive: false,
        lastActivity: new Date(),
        minutesUntilExpiration: 0,
        willExpireSoon: false,
      };

      authService.checkSessionStatus.mockResolvedValueOnce(inactiveStatus);

      const result = await controller.checkSessionStatus(mockUser);

      expect(result.isActive).toBe(false);
    });
  });

  describe("switchCamp", () => {
    it("should switch camp, set cookie, and return access_token + user", async () => {
      const mockUser = { userId: 1 } as any;
      const dto = { camp_id: 2 } as any;
      const mockRes = makeMockRes();

      const mockResponse = {
        access_token: "access_token_value",
        refresh_token: "refresh_token_value",
        user: { id: "1", username: "testuser", camp_id: "2" },
      };

      authService.switchCamp.mockResolvedValueOnce(mockResponse as any);

      const result = await controller.switchCamp(mockUser, dto, mockRes as any);

      expect(result).toEqual({ access_token: "access_token_value", user: mockResponse.user });
      expect(result).not.toHaveProperty("refresh_token");
      expect(mockRes.cookie).toHaveBeenCalledWith(
        "refresh_token",
        "refresh_token_value",
        expect.objectContaining({ httpOnly: true }),
      );
      expect(authService.switchCamp).toHaveBeenCalledWith(1, 2);
    });
  });
});
