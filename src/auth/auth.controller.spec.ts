import { Test, TestingModule } from "@nestjs/testing";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";

describe("AuthController", () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;

  const mockLoginResponse = {
    access_token: "access_token_value",
    refresh_token: "refresh_token_value",
    user: {
      id: 1,
      username: "testuser",
      email: "test@example.com",
      role: "USER",
      camp_id: 1,
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
    it("should login successfully with valid credentials", async () => {
      const loginDto = { username: "testuser", password: "password123" };
      const ipAddress = "192.168.1.1";
      const userAgent = "Mozilla/5.0";

      authService.login.mockResolvedValueOnce(mockLoginResponse);

      const result = await controller.login(loginDto, ipAddress, userAgent);

      expect(result).toEqual(mockLoginResponse);
      expect(authService.login).toHaveBeenCalledWith(
        loginDto,
        ipAddress,
        userAgent,
      );
    });

    it("should login without user agent", async () => {
      const loginDto = { username: "testuser", password: "password123" };
      const ipAddress = "192.168.1.1";

      authService.login.mockResolvedValueOnce(mockLoginResponse);

      const result = await controller.login(loginDto, ipAddress);

      expect(result).toEqual(mockLoginResponse);
      expect(authService.login).toHaveBeenCalledWith(
        loginDto,
        ipAddress,
        undefined,
      );
    });

    it("should reject login with invalid credentials", async () => {
      const loginDto = { username: "testuser", password: "wrongpassword" };
      const ipAddress = "192.168.1.1";

      const error = new Error("Invalid credentials");
      authService.login.mockRejectedValueOnce(error);

      await expect(controller.login(loginDto, ipAddress)).rejects.toThrow(
        "Invalid credentials",
      );
    });

    it("should reject login with empty username", async () => {
      const loginDto = { username: "", password: "password123" };
      const ipAddress = "192.168.1.1";

      const error = new Error("Invalid credentials");
      authService.login.mockRejectedValueOnce(error);

      await expect(controller.login(loginDto, ipAddress)).rejects.toThrow();
    });

    it("should handle too many login attempts", async () => {
      const loginDto = { username: "testuser", password: "password123" };
      const ipAddress = "192.168.1.1";

      const error = new Error("Too many login attempts");
      authService.login.mockRejectedValueOnce(error);

      await expect(controller.login(loginDto, ipAddress)).rejects.toThrow(
        "Too many login attempts",
      );
    });
  });

  describe("logout", () => {
    it("should logout successfully", async () => {
      const mockUser = { userId: 1 };
      const body = undefined;

      authService.logout.mockResolvedValueOnce(undefined);

      await controller.logout(mockUser, body);

      expect(authService.logout).toHaveBeenCalledWith(1, undefined);
    });

    it("should logout with specific refresh token", async () => {
      const mockUser = { userId: 1 };
      const body = { refresh_token: "refresh_token_value" };

      authService.logout.mockResolvedValueOnce(undefined);

      await controller.logout(mockUser, body);

      expect(authService.logout).toHaveBeenCalledWith(1, "refresh_token_value");
    });

    it("should handle logout for different user IDs", async () => {
      const mockUser = { userId: 5 };

      authService.logout.mockResolvedValueOnce(undefined);

      await controller.logout(mockUser);

      expect(authService.logout).toHaveBeenCalledWith(5, undefined);
    });
  });

  describe("refresh", () => {
    it("should refresh tokens successfully", async () => {
      const refreshDto = { refresh_token: "refresh_token_value" };

      authService.refresh.mockResolvedValueOnce(mockRefreshResponse);

      const result = await controller.refresh(refreshDto);

      expect(result).toEqual(mockRefreshResponse);
      expect(authService.refresh).toHaveBeenCalledWith("refresh_token_value");
    });

    it("should return new access and refresh tokens", async () => {
      const refreshDto = { refresh_token: "valid_token" };

      authService.refresh.mockResolvedValueOnce(mockRefreshResponse);

      const result = await controller.refresh(refreshDto);

      expect(result).toHaveProperty("access_token");
      expect(result).toHaveProperty("refresh_token");
    });

    it("should reject invalid refresh token", async () => {
      const refreshDto = { refresh_token: "invalid_token" };

      const error = new Error("Invalid refresh token");
      authService.refresh.mockRejectedValueOnce(error);

      await expect(controller.refresh(refreshDto)).rejects.toThrow(
        "Invalid refresh token",
      );
    });

    it("should reject expired refresh token", async () => {
      const refreshDto = { refresh_token: "expired_token" };

      const error = new Error("Token expired");
      authService.refresh.mockRejectedValueOnce(error);

      await expect(controller.refresh(refreshDto)).rejects.toThrow(
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
    it("should switch camp and return tokens + user", async () => {
      const mockUser = { userId: 1 } as any;
      const dto = { camp_id: 2 } as any;

      const mockResponse = {
        access_token: "access_token_value",
        refresh_token: "refresh_token_value",
        user: { id: 1, username: "testuser", camp_id: 2 },
      };

      authService.switchCamp.mockResolvedValueOnce(mockResponse as any);

      const result = await controller.switchCamp(mockUser, dto);

      expect(result).toEqual(mockResponse);
      expect(authService.switchCamp).toHaveBeenCalledWith(1, 2);
    });
  });
});
