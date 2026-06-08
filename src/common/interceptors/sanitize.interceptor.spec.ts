import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import type { ExecutionContext, CallHandler } from "@nestjs/common";
import { SanitizeInterceptor } from "./sanitize.interceptor";

describe("SanitizeInterceptor", () => {
  let interceptor: SanitizeInterceptor;
  let mockExecutionContext: ExecutionContext;
  let mockCallHandler: CallHandler;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SanitizeInterceptor],
    }).compile();

    interceptor = module.get<SanitizeInterceptor>(SanitizeInterceptor);
  });

  it("should be defined", () => {
    expect(interceptor).toBeDefined();
  });

  describe("intercept", () => {
    beforeEach(() => {
      mockCallHandler = {
        handle: jest.fn().mockReturnValue({ subscribe: jest.fn() }),
      };
    });

    it("should sanitize request body", () => {
      const maliciousBody = {
        name: '<img src=x onerror="alert(1)">',
        description: "<script>alert('xss')</script>",
      };

      const mockRequest = {
        body: maliciousBody,
        query: {},
      };

      mockExecutionContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(mockRequest),
        }),
      } as unknown as ExecutionContext;

      interceptor.intercept(mockExecutionContext, mockCallHandler);

      expect(mockRequest.body.name).not.toContain("onerror");
      expect(mockRequest.body.description).not.toContain("<script>");
    });

    it("should sanitize request query", () => {
      const maliciousQuery = {
        search: '<img src=x onerror="alert(1)">',
        sort: "<iframe></iframe>",
      };

      const mockRequest = {
        body: {},
        query: maliciousQuery,
      };

      mockExecutionContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(mockRequest),
        }),
      } as unknown as ExecutionContext;

      interceptor.intercept(mockExecutionContext, mockCallHandler);

      expect(mockRequest.query.search).not.toContain("onerror");
      expect(mockRequest.query.sort).not.toContain("<iframe>");
    });

    it("should handle string sanitization", () => {
      const mockRequest = {
        body: {
          text: "<script>alert('xss')</script>safe text",
        },
        query: {},
      };

      mockExecutionContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(mockRequest),
        }),
      } as unknown as ExecutionContext;

      interceptor.intercept(mockExecutionContext, mockCallHandler);

      expect(mockRequest.body.text).not.toContain("<script>");
      expect(mockRequest.body.text).toContain("safe text");
    });

    it("should handle array sanitization", () => {
      const mockRequest = {
        body: {
          tags: [
            '<img src=x onerror="alert(1)">',
            "clean-tag",
            "<script>bad</script>",
          ],
        },
        query: {},
      };

      mockExecutionContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(mockRequest),
        }),
      } as unknown as ExecutionContext;

      interceptor.intercept(mockExecutionContext, mockCallHandler);

      expect(Array.isArray(mockRequest.body.tags)).toBe(true);
      expect(mockRequest.body.tags.length).toBe(3);
      expect(mockRequest.body.tags[0]).not.toContain("onerror");
      expect(mockRequest.body.tags[1]).toBe("clean-tag");
      expect(mockRequest.body.tags[2]).not.toContain("<script>");
    });

    it("should handle nested object sanitization", () => {
      const mockRequest = {
        body: {
          user: {
            name: '<img src=x onerror="alert(1)">',
            email: "user@example.com",
            profile: {
              bio: "<script>alert('xss')</script>",
            },
          },
        },
        query: {},
      };

      mockExecutionContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(mockRequest),
        }),
      } as unknown as ExecutionContext;

      interceptor.intercept(mockExecutionContext, mockCallHandler);

      expect(mockRequest.body.user.name).not.toContain("onerror");
      expect(mockRequest.body.user.email).toBe("user@example.com");
      expect(mockRequest.body.user.profile.bio).not.toContain("<script>");
    });

    it("should preserve null values", () => {
      const mockRequest = {
        body: {
          field: null,
          text: "content",
        },
        query: {},
      };

      mockExecutionContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(mockRequest),
        }),
      } as unknown as ExecutionContext;

      interceptor.intercept(mockExecutionContext, mockCallHandler);

      expect(mockRequest.body.field).toBeNull();
      expect(mockRequest.body.text).toBe("content");
    });

    it("should preserve undefined values", () => {
      const mockRequest = {
        body: {
          field: undefined,
          text: "content",
        },
        query: {},
      };

      mockExecutionContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(mockRequest),
        }),
      } as unknown as ExecutionContext;

      interceptor.intercept(mockExecutionContext, mockCallHandler);

      expect(mockRequest.body.field).toBeUndefined();
      expect(mockRequest.body.text).toBe("content");
    });

    it("should handle numbers and booleans in objects", () => {
      const mockRequest = {
        body: {
          count: 123,
          active: true,
          ratio: 3.14,
        },
        query: {},
      };

      mockExecutionContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(mockRequest),
        }),
      } as unknown as ExecutionContext;

      interceptor.intercept(mockExecutionContext, mockCallHandler);

      expect(mockRequest.body.count).toBe(123);
      expect(mockRequest.body.active).toBe(true);
      expect(mockRequest.body.ratio).toBe(3.14);
    });

    it("should call next.handle()", () => {
      const mockRequest = {
        body: { text: "safe" },
        query: {},
      };

      mockExecutionContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(mockRequest),
        }),
      } as unknown as ExecutionContext;

      interceptor.intercept(mockExecutionContext, mockCallHandler);

      expect(mockCallHandler.handle).toHaveBeenCalled();
    });

    it("should handle request without body", () => {
      const mockRequest = {
        query: { search: "<script>bad</script>" },
      };

      mockExecutionContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(mockRequest),
        }),
      } as unknown as ExecutionContext;

      expect(() => {
        interceptor.intercept(mockExecutionContext, mockCallHandler);
      }).not.toThrow();
    });

    it("should handle request without query", () => {
      const mockRequest = {
        body: { text: "<script>bad</script>" },
      };

      mockExecutionContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(mockRequest),
        }),
      } as unknown as ExecutionContext;

      expect(() => {
        interceptor.intercept(mockExecutionContext, mockCallHandler);
      }).not.toThrow();
    });

    it("should sanitize complex payload with mixed types", () => {
      const mockRequest = {
        body: {
          title: '<img src=x onerror="alert(1)">',
          items: [
            { name: "<script>bad</script>", count: 5 },
            { name: "safe", count: 10 },
          ],
          metadata: {
            tags: ["<svg>alert</svg>", "safe-tag"],
          },
        },
        query: {},
      };

      mockExecutionContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(mockRequest),
        }),
      } as unknown as ExecutionContext;

      interceptor.intercept(mockExecutionContext, mockCallHandler);

      expect(mockRequest.body.title).not.toContain("onerror");
      expect(mockRequest.body.items[0].name).not.toContain("<script>");
      expect(mockRequest.body.items[0].count).toBe(5);
      expect(mockRequest.body.items[1].name).toBe("safe");
      expect(mockRequest.body.metadata.tags[0]).not.toContain("<svg>");
      expect(mockRequest.body.metadata.tags[1]).toBe("safe-tag");
    });

    it("should handle empty string sanitization", () => {
      const mockRequest = {
        body: {
          text: "",
        },
        query: {},
      };

      mockExecutionContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(mockRequest),
        }),
      } as unknown as ExecutionContext;

      interceptor.intercept(mockExecutionContext, mockCallHandler);

      expect(mockRequest.body.text).toBe("");
    });
  });
});
