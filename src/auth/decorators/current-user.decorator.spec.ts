import type { ExecutionContext } from "@nestjs/common";
import { ROUTE_ARGS_METADATA } from "@nestjs/common/constants";
import { CurrentUser } from "./current-user.decorator";

describe("CurrentUser decorator", () => {
  type ParamFactoryEntry = {
    factory: (data: unknown, ctx: ExecutionContext) => unknown;
  };

  class TestController {
    handler(@CurrentUser() user: unknown) {
      return user;
    }
  }

  const getCustomParamFactory = () => {
    const metadata =
      Reflect.getMetadata(ROUTE_ARGS_METADATA, TestController, "handler") ?? {};
    const entry = Object.values(metadata).find(
      (value): value is ParamFactoryEntry =>
        typeof (value as { factory?: unknown }).factory === "function",
    );

    return entry?.factory;
  };

  it("should be defined", () => {
    expect(CurrentUser).toBeDefined();
  });

  it("should extract request.user from execution context", () => {
    const mockUser = { id: 1, username: "tester" };
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({ user: mockUser }),
      }),
    } as ExecutionContext;

    const factory = getCustomParamFactory();
    expect(factory).toBeDefined();
    expect(factory?.(undefined, mockContext)).toEqual(mockUser);
  });

  it("should return undefined when request has no user", () => {
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({}),
      }),
    } as ExecutionContext;

    const factory = getCustomParamFactory();
    expect(factory?.(undefined, mockContext)).toBeUndefined();
  });
});
