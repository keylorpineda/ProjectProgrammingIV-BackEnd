import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { Reflector } from "@nestjs/core";
import { JwtAuthGuard } from "./jwt-auth.guard";
import type { ExecutionContext } from "@nestjs/common";

describe("JwtAuthGuard", () => {
  let guard: JwtAuthGuard;
  let reflector: Reflector;
  let mockExecutionContext: ExecutionContext;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtAuthGuard,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<JwtAuthGuard>(JwtAuthGuard);
    reflector = module.get<Reflector>(Reflector);

    // Mock ExecutionContext
    mockExecutionContext = {
      getHandler: jest.fn().mockReturnValue(() => {}),
      getClass: jest.fn().mockReturnValue(class TestClass {}),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({ user: { id: 1 } }),
        getResponse: jest.fn(),
        getNext: jest.fn(),
      }),
      getArgs: jest.fn().mockReturnValue([]),
      getArgByIndex: jest.fn(),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
    } as any;
  });

  describe("Guard Definition", () => {
    it("should be defined", () => {
      expect(guard).toBeDefined();
    });

    it("should be an instance of JwtAuthGuard", () => {
      expect(guard).toBeInstanceOf(JwtAuthGuard);
    });

    it("should have canActivate method", () => {
      expect(typeof guard.canActivate).toBe("function");
    });

    it("should have private reflector property", () => {
      const reflectorProperty = guard["reflector"];
      expect(reflectorProperty).toBeDefined();
      expect(reflectorProperty).toEqual(reflector);
    });
  });

  describe("canActivate - Public Routes", () => {
    it("should return true when route is marked as public", () => {
      (reflector.getAllAndOverride as jest.Mock).mockReturnValue(true);

      const result = guard.canActivate(mockExecutionContext);

      expect(result).toBe(true);
      expect(reflector.getAllAndOverride).toHaveBeenCalledWith("isPublic", [
        mockExecutionContext.getHandler(),
        mockExecutionContext.getClass(),
      ]);
    });

    it("should return true immediately for public routes without calling parent guard", () => {
      (reflector.getAllAndOverride as jest.Mock).mockReturnValue(true);
      const parentCanActivateSpy = jest.spyOn(
        Object.getPrototypeOf(Object.getPrototypeOf(guard)),
        "canActivate",
      );

      const result = guard.canActivate(mockExecutionContext);

      expect(result).toBe(true);
      expect(parentCanActivateSpy).not.toHaveBeenCalled();
      parentCanActivateSpy.mockRestore();
    });
  });

  describe("canActivate - Protected Routes", () => {
    beforeEach(() => {
      // Mock the parent AuthGuard's canActivate method to prevent JWT validation
      jest
        .spyOn(
          Object.getPrototypeOf(Object.getPrototypeOf(guard)),
          "canActivate",
        )
        .mockResolvedValue(true);
    });

    it("should call parent canActivate when route is not public", async () => {
      (reflector.getAllAndOverride as jest.Mock).mockReturnValue(false);

      await guard.canActivate(mockExecutionContext);

      expect(reflector.getAllAndOverride).toHaveBeenCalledWith("isPublic", [
        mockExecutionContext.getHandler(),
        mockExecutionContext.getClass(),
      ]);
    });

    it("should call parent canActivate when public metadata is undefined", async () => {
      (reflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);

      await guard.canActivate(mockExecutionContext);

      expect(reflector.getAllAndOverride).toHaveBeenCalled();
    });

    it("should call parent canActivate when public metadata is null", async () => {
      (reflector.getAllAndOverride as jest.Mock).mockReturnValue(null);

      await guard.canActivate(mockExecutionContext);

      expect(reflector.getAllAndOverride).toHaveBeenCalled();
    });
  });

  describe("canActivate - Metadata Checking", () => {
    it("should always check both handler and class for public metadata", () => {
      (reflector.getAllAndOverride as jest.Mock).mockReturnValue(true);

      guard.canActivate(mockExecutionContext);

      expect(reflector.getAllAndOverride).toHaveBeenCalledWith("isPublic", [
        mockExecutionContext.getHandler(),
        mockExecutionContext.getClass(),
      ]);
    });

    it("should use correct IS_PUBLIC_KEY metadata key", () => {
      (reflector.getAllAndOverride as jest.Mock).mockReturnValue(true);

      guard.canActivate(mockExecutionContext);

      const calls = (reflector.getAllAndOverride as jest.Mock).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      expect(calls[0][0]).toBe("isPublic");
    });

    it("should check metadata in correct order (handler then class)", () => {
      (reflector.getAllAndOverride as jest.Mock).mockReturnValue(true);

      guard.canActivate(mockExecutionContext);

      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
        "isPublic",
        expect.arrayContaining([
          mockExecutionContext.getHandler(),
          mockExecutionContext.getClass(),
        ]),
      );
    });
  });

  describe("canActivate - Falsy Values", () => {
    beforeEach(() => {
      jest
        .spyOn(
          Object.getPrototypeOf(Object.getPrototypeOf(guard)),
          "canActivate",
        )
        .mockResolvedValue(true);
    });

    it("should treat false as non-public (routes to parent guard)", async () => {
      (reflector.getAllAndOverride as jest.Mock).mockReturnValue(false);

      await guard.canActivate(mockExecutionContext);

      expect(reflector.getAllAndOverride).toHaveBeenCalledWith("isPublic", [
        mockExecutionContext.getHandler(),
        mockExecutionContext.getClass(),
      ]);
    });

    it("should treat 0 as non-public", async () => {
      (reflector.getAllAndOverride as jest.Mock).mockReturnValue(0);

      await guard.canActivate(mockExecutionContext);

      expect(reflector.getAllAndOverride).toHaveBeenCalled();
    });

    it("should treat empty string as non-public", async () => {
      (reflector.getAllAndOverride as jest.Mock).mockReturnValue("");

      await guard.canActivate(mockExecutionContext);

      expect(reflector.getAllAndOverride).toHaveBeenCalled();
    });
  });

  describe("canActivate - Multiple Calls", () => {
    it("should not cache reflector results across multiple calls", () => {
      (reflector.getAllAndOverride as jest.Mock).mockClear();

      guard.canActivate(mockExecutionContext);
      guard.canActivate(mockExecutionContext);
      guard.canActivate(mockExecutionContext);

      expect((reflector.getAllAndOverride as jest.Mock).mock.calls.length).toBe(
        3,
      );
    });

    it("should handle different metadata values on consecutive calls", () => {
      (reflector.getAllAndOverride as jest.Mock).mockClear();
      (reflector.getAllAndOverride as jest.Mock)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true);

      const result1 = guard.canActivate(mockExecutionContext);
      guard.canActivate(mockExecutionContext);
      const result3 = guard.canActivate(mockExecutionContext);

      expect(result1).toBe(true);
      expect(result3).toBe(true);
      expect((reflector.getAllAndOverride as jest.Mock).mock.calls.length).toBe(
        3,
      );
    });
  });
});
