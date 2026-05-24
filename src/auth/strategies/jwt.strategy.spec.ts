import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { UnauthorizedException } from "@nestjs/common";
import { JwtStrategy } from "./jwt.strategy";
import { UsersService } from "../../users/users.service";

describe("JwtStrategy", () => {
  let strategy: JwtStrategy;
  let usersService: jest.Mocked<UsersService>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue("test_secret"),
          },
        },
        {
          provide: UsersService,
          useValue: {
            findUserById: jest.fn(),
          },
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
    usersService = module.get(UsersService) as jest.Mocked<UsersService>;
    configService = module.get(ConfigService) as jest.Mocked<ConfigService>;
  });

  it("should be defined", () => {
    expect(strategy).toBeDefined();
  });

  it("should validate and return user when payload is valid", async () => {
    const mockUser = {
      id: 1,
      username: "testuser",
      email: "test@example.com",
      role: { name: "USER" },
    };

    const payload = {
      sub: 1,
      username: "testuser",
      role: "USER",
      email: "test@example.com",
      camp_id: 7,
    };

    usersService.findUserById.mockResolvedValueOnce(mockUser as any);

    const result = await strategy.validate(payload);

    expect(result).toEqual({
      id: 1,
      userId: 1,
      username: "testuser",
      email: "test@example.com",
      role: "USER",
      camp_id: 7,
    });
    expect(usersService.findUserById).toHaveBeenCalledWith(1);
  });

  it("should throw UnauthorizedException when user not found", async () => {
    const payload = { sub: 999, username: "nonexistent", role: "USER" };

    usersService.findUserById.mockResolvedValueOnce(null);

    await expect(strategy.validate(payload)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it("should handle different user roles", async () => {
    const mockAdmin = {
      id: 2,
      username: "admin",
      email: "admin@example.com",
      role: { name: "ADMIN" },
    };

    const payload = { sub: 2, username: "admin", role: "ADMIN" };

    usersService.findUserById.mockResolvedValueOnce(mockAdmin as any);

    const result = await strategy.validate(payload);

    expect(result.role).toBe("ADMIN");
    expect(result.username).toBe("admin");
  });

  it("should extract user_id from payload.sub", async () => {
    const mockUser = {
      id: 5,
      username: "user5",
      email: "user5@example.com",
      role: { name: "USER" },
    };

    const payload = { sub: 5, username: "user5", role: "USER" };

    usersService.findUserById.mockResolvedValueOnce(mockUser as any);

    const result = await strategy.validate(payload);

    expect(result.userId).toBe(5);
  });

  it("should use ConfigService to get JWT secret", () => {
    expect(configService.get).toHaveBeenCalledWith("JWT_SECRET");
  });

  it("should handle user with null role", async () => {
    const mockUser = {
      id: 3,
      username: "user_no_role",
      email: "user@example.com",
      role: null,
    };

    const payload = { sub: 3, username: "user_no_role", role: "USER" };

    usersService.findUserById.mockResolvedValueOnce(mockUser as any);

    const result = await strategy.validate(payload);

    expect(result.userId).toBe(3);
  });

  it("should return complete user object with all required fields", async () => {
    const mockUser = {
      id: 10,
      username: "complete_user",
      email: "complete@example.com",
      role: { name: "MODERATOR" },
    };

    const payload = { sub: 10, username: "complete_user", role: "MODERATOR" };

    usersService.findUserById.mockResolvedValueOnce(mockUser as any);

    const result = await strategy.validate(payload);

    expect(result).toHaveProperty("userId");
    expect(result).toHaveProperty("username");
    expect(result).toHaveProperty("role");
    expect(result.userId).toBe(10);
    expect(result.username).toBe("complete_user");
  });
});
