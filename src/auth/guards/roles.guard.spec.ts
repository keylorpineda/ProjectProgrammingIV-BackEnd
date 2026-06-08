import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import type { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RolesGuard } from "./roles.guard";
import { ROLES_KEY } from "../decorators/roles.decorator";

describe("RolesGuard", () => {
  let guard: RolesGuard;
  let reflector: jest.Mocked<Reflector>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesGuard,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);
    reflector = module.get(Reflector) as jest.Mocked<Reflector>;
  });

  it("should be defined", () => {
    expect(guard).toBeDefined();
  });

  it("should allow access when no roles are required", () => {
    const mockContext = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          user: { role: "USER" },
        }),
      }),
    } as unknown as ExecutionContext;

    reflector.getAllAndOverride.mockReturnValueOnce(undefined);

    const result = guard.canActivate(mockContext);

    expect(result).toBe(true);
  });

  it("should allow access when user has required role", () => {
    const mockContext = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          user: { role: "ADMIN" },
        }),
      }),
    } as unknown as ExecutionContext;

    reflector.getAllAndOverride.mockReturnValueOnce(["ADMIN"]);

    const result = guard.canActivate(mockContext);

    expect(result).toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, [
      mockContext.getHandler(),
      mockContext.getClass(),
    ]);
  });

  it("should deny access when user has different role", () => {
    const mockContext = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          user: { role: "USER" },
        }),
      }),
    } as unknown as ExecutionContext;

    reflector.getAllAndOverride.mockReturnValueOnce(["ADMIN", "MODERATOR"]);

    const result = guard.canActivate(mockContext);

    expect(result).toBe(false);
  });

  it("should deny access when user is not present", () => {
    const mockContext = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({}),
      }),
    } as unknown as ExecutionContext;

    reflector.getAllAndOverride.mockReturnValueOnce(["ADMIN"]);

    const result = guard.canActivate(mockContext);

    expect(result).toBe(false);
  });

  it("should allow access when required roles array is empty", () => {
    const mockContext = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          user: { role: "USER" },
        }),
      }),
    } as unknown as ExecutionContext;

    reflector.getAllAndOverride.mockReturnValueOnce([]);

    const result = guard.canActivate(mockContext);

    expect(result).toBe(true);
  });

  it("should handle multiple allowed roles", () => {
    const mockContext = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          user: { role: "MODERATOR" },
        }),
      }),
    } as unknown as ExecutionContext;

    reflector.getAllAndOverride.mockReturnValueOnce([
      "ADMIN",
      "MODERATOR",
      "USER",
    ]);

    const result = guard.canActivate(mockContext);

    expect(result).toBe(true);
  });
});
