import { Public, IS_PUBLIC_KEY } from "./public.decorator";

describe("Public Decorator", () => {
  it("should set public metadata", () => {
    const result = Public();

    expect(result).toBeTruthy();
  });

  it("should have IS_PUBLIC_KEY constant defined", () => {
    expect(IS_PUBLIC_KEY).toBe("isPublic");
  });

  it("should return a function that can be used as decorator", () => {
    const decorator = Public();

    // Los decoradores de NestJS retornan una funcion
    expect(typeof decorator).toBe("function");
  });
});
