import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import type { ExecutionContext, CallHandler } from "@nestjs/common";
import { getRepositoryToken } from "@nestjs/typeorm";
import { JwtService } from "@nestjs/jwt";
import { SessionActivityInterceptor } from "./session-activity.interceptor";
import { Session } from "../entities/session.entity";
import { firstValueFrom, of } from "rxjs";
import { REDIS_CLIENT } from "../../redis/redis.constants";

describe("SessionActivityInterceptor", () => {
  let interceptor: SessionActivityInterceptor;
  let sessionRepo: any;
  let jwtService: jest.Mocked<JwtService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionActivityInterceptor,
        {
          provide: getRepositoryToken(Session),
          useValue: {
            update: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            verify: jest.fn(),
          },
        },
        {
          provide: REDIS_CLIENT,
          useValue: {
            expire: jest.fn().mockResolvedValue(1),
            // get returns null → no recent DB update → DB write proceeds
            get: jest.fn().mockResolvedValue(null),
            set: jest.fn().mockResolvedValue("OK"),
            setex: jest.fn().mockResolvedValue("OK"),
            del: jest.fn().mockResolvedValue(1),
            exists: jest.fn().mockResolvedValue(1),
          },
        },
      ],
    }).compile();

    interceptor = module.get<SessionActivityInterceptor>(
      SessionActivityInterceptor,
    );
    sessionRepo = module.get(getRepositoryToken(Session));
    jwtService = module.get(JwtService) as jest.Mocked<JwtService>;
  });

  it("should be defined", () => {
    expect(interceptor).toBeDefined();
  });

  it("should update session activity when valid Bearer token is present", async () => {
    const mockCallHandler = {
      handle: jest.fn().mockReturnValue(of({ data: "response" })),
    } as unknown as CallHandler;

    const mockContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          headers: {
            authorization: "Bearer valid_token",
          },
        }),
      }),
    } as unknown as ExecutionContext;

    jwtService.verify.mockReturnValueOnce({ sub: 1, username: "testuser" });
    sessionRepo.update.mockResolvedValueOnce({});

    const stream = await interceptor.intercept(mockContext, mockCallHandler);
    await firstValueFrom(stream);

    expect(jwtService.verify).toHaveBeenCalledWith("valid_token");
    expect(sessionRepo.update).toHaveBeenCalledWith(
      { user_id: 1, is_active: true },
      expect.objectContaining({ last_activity: expect.any(Date) }),
    );
    expect(mockCallHandler.handle).toHaveBeenCalled();
  });

  it("should not update session when no authorization header", async () => {
    const mockCallHandler = {
      handle: jest.fn().mockReturnValue(of({ data: "response" })),
    } as unknown as CallHandler;

    const mockContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          headers: {},
        }),
      }),
    } as unknown as ExecutionContext;

    const stream = await interceptor.intercept(mockContext, mockCallHandler);
    await firstValueFrom(stream);

    expect(sessionRepo.update).not.toHaveBeenCalled();
    expect(mockCallHandler.handle).toHaveBeenCalled();
  });

  it("should not update session when authorization is not Bearer", async () => {
    const mockCallHandler = {
      handle: jest.fn().mockReturnValue(of({ data: "response" })),
    } as unknown as CallHandler;

    const mockContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          headers: {
            authorization: "Basic dXNlcjpwYXNz",
          },
        }),
      }),
    } as unknown as ExecutionContext;

    const stream = await interceptor.intercept(
      mockContext,
      mockCallHandler as any,
    );
    await firstValueFrom(stream);

    expect(sessionRepo.update).not.toHaveBeenCalled();
  });

  it("should handle invalid JWT token gracefully", async () => {
    const mockCallHandler = {
      handle: jest.fn().mockReturnValue(of({ data: "response" })),
    } as unknown as CallHandler;

    const mockContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          headers: {
            authorization: "Bearer invalid_token",
          },
        }),
      }),
    } as unknown as ExecutionContext;

    jwtService.verify.mockImplementationOnce(() => {
      throw new Error("Invalid token");
    });

    const stream = await interceptor.intercept(mockContext, mockCallHandler);
    await firstValueFrom(stream);

    // No debe throws, solo continua
    expect(mockCallHandler.handle).toHaveBeenCalled();
  });

  it("should continue execution even if update fails", async () => {
    const mockCallHandler = {
      handle: jest.fn().mockReturnValue(of({ data: "response" })),
    } as unknown as CallHandler;

    const mockContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          headers: {
            authorization: "Bearer valid_token",
          },
        }),
      }),
    } as unknown as ExecutionContext;

    jwtService.verify.mockReturnValueOnce({ sub: 1, username: "testuser" });
    sessionRepo.update.mockRejectedValueOnce(new Error("DB error"));

    // No debe throw, interceptor debe continuar
    try {
      const stream = await interceptor.intercept(mockContext, mockCallHandler);
      await firstValueFrom(stream);
    } catch (error) {
      // Si hay error, verifica que el handle aun fue llamado despues
    }

    expect(mockCallHandler.handle).toHaveBeenCalled();
  });

  it("should extract token correctly from Bearer header", async () => {
    const mockToken = "my_jwt_token_12345";
    const mockCallHandler = {
      handle: jest.fn().mockReturnValue(of({ data: "response" })),
    } as unknown as CallHandler;

    const mockContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          headers: {
            authorization: `Bearer ${mockToken}`,
          },
        }),
      }),
    } as unknown as ExecutionContext;

    jwtService.verify.mockReturnValueOnce({ sub: 5, username: "testuser" });
    sessionRepo.update.mockResolvedValueOnce({});

    const stream = await interceptor.intercept(mockContext, mockCallHandler);
    await firstValueFrom(stream);

    expect(jwtService.verify).toHaveBeenCalledWith(mockToken);
  });

  it("should update session for correct user_id from JWT payload", async () => {
    const mockCallHandler = {
      handle: jest.fn().mockReturnValue(of({ data: "response" })),
    } as unknown as CallHandler;

    const mockContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          headers: {
            authorization: "Bearer valid_token",
          },
        }),
      }),
    } as unknown as ExecutionContext;

    jwtService.verify.mockReturnValueOnce({ sub: 99, username: "testuser" });
    sessionRepo.update.mockResolvedValueOnce({});

    const stream = await interceptor.intercept(mockContext, mockCallHandler);
    await firstValueFrom(stream);

    expect(sessionRepo.update).toHaveBeenCalledWith(
      { user_id: 99, is_active: true },
      expect.objectContaining({ last_activity: expect.any(Date) }),
    );
  });
});
