import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import type { Request, Response, NextFunction } from "express";
import { ForbiddenException } from "@nestjs/common";
import { CsrfMiddleware } from "./csrf.middleware";

describe("CsrfMiddleware", () => {
  let middleware: CsrfMiddleware;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    process.env.CORS_ORIGIN = "http://localhost:3000,http://localhost:3001";
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CsrfMiddleware],
    }).compile();

    middleware = module.get<CsrfMiddleware>(CsrfMiddleware);
    mockNext = jest.fn();
  });

  afterEach(() => {
    delete process.env.CORS_ORIGIN;
  });

  it("should be defined", () => {
    expect(middleware).toBeDefined();
  });

  describe("use", () => {
    it("should allow GET request without origin or referer", () => {
      mockRequest = {
        method: "GET",
        headers: {},
      };
      mockResponse = {};

      middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it("should allow HEAD request without origin or referer", () => {
      mockRequest = {
        method: "HEAD",
        headers: {},
      };
      mockResponse = {};

      middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it("should allow OPTIONS request without origin or referer", () => {
      mockRequest = {
        method: "OPTIONS",
        headers: {},
      };
      mockResponse = {};

      middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it("should allow POST request without origin or referer", () => {
      mockRequest = {
        method: "POST",
        headers: {},
      };
      mockResponse = {};

      middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it("should allow POST request from allowed origin", () => {
      mockRequest = {
        method: "POST",
        headers: {
          origin: "http://localhost:3000",
        },
      };
      mockResponse = {};

      middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it("should allow PUT request from allowed origin", () => {
      mockRequest = {
        method: "PUT",
        headers: {
          origin: "http://localhost:3001",
        },
      };
      mockResponse = {};

      middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it("should allow PATCH request from allowed origin", () => {
      mockRequest = {
        method: "PATCH",
        headers: {
          origin: "http://localhost:3000",
        },
      };
      mockResponse = {};

      middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it("should allow DELETE request from allowed origin", () => {
      mockRequest = {
        method: "DELETE",
        headers: {
          origin: "http://localhost:3000",
        },
      };
      mockResponse = {};

      middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it("should reject POST request from disallowed origin", () => {
      mockRequest = {
        method: "POST",
        headers: {
          origin: "http://evil.com",
        },
      };
      mockResponse = {};

      expect(() => {
        middleware.use(
          mockRequest as Request,
          mockResponse as Response,
          mockNext,
        );
      }).toThrow(ForbiddenException);
    });

    it("should reject PUT request from disallowed origin", () => {
      mockRequest = {
        method: "PUT",
        headers: {
          origin: "http://attacker.com",
        },
      };
      mockResponse = {};

      expect(() => {
        middleware.use(
          mockRequest as Request,
          mockResponse as Response,
          mockNext,
        );
      }).toThrow(ForbiddenException);
    });

    it("should reject PATCH request from disallowed origin", () => {
      mockRequest = {
        method: "PATCH",
        headers: {
          origin: "http://malicious.org",
        },
      };
      mockResponse = {};

      expect(() => {
        middleware.use(
          mockRequest as Request,
          mockResponse as Response,
          mockNext,
        );
      }).toThrow(ForbiddenException);
    });

    it("should reject DELETE request from disallowed origin", () => {
      mockRequest = {
        method: "DELETE",
        headers: {
          origin: "http://hacker.net",
        },
      };
      mockResponse = {};

      expect(() => {
        middleware.use(
          mockRequest as Request,
          mockResponse as Response,
          mockNext,
        );
      }).toThrow(ForbiddenException);
    });

    it("should allow POST request from allowed referer", () => {
      mockRequest = {
        method: "POST",
        headers: {
          referer: "http://localhost:3000/page",
        },
      };
      mockResponse = {};

      middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it("should reject POST request from disallowed referer", () => {
      mockRequest = {
        method: "POST",
        headers: {
          referer: "http://evil.com/attack",
        },
      };
      mockResponse = {};

      expect(() => {
        middleware.use(
          mockRequest as Request,
          mockResponse as Response,
          mockNext,
        );
      }).toThrow(ForbiddenException);
    });

    it("should prefer origin over referer when both present", () => {
      mockRequest = {
        method: "POST",
        headers: {
          origin: "http://localhost:3000",
          referer: "http://evil.com/attack",
        },
      };
      mockResponse = {};

      middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it("should handle referer with invalid URL gracefully", () => {
      mockRequest = {
        method: "POST",
        headers: {
          referer: "not-a-valid-url",
        },
      };
      mockResponse = {};

      middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it("should use default CORS_ORIGIN when env var not set", () => {
      delete process.env.CORS_ORIGIN;

      const newMiddleware = new CsrfMiddleware();

      mockRequest = {
        method: "POST",
        headers: {
          origin: "http://localhost:3000",
        },
      };
      mockResponse = {};

      newMiddleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it("should reject default CORS_ORIGIN when invalid origin sent", () => {
      delete process.env.CORS_ORIGIN;

      const newMiddleware = new CsrfMiddleware();

      mockRequest = {
        method: "POST",
        headers: {
          origin: "http://evil.com",
        },
      };
      mockResponse = {};

      expect(() => {
        newMiddleware.use(
          mockRequest as Request,
          mockResponse as Response,
          mockNext,
        );
      }).toThrow(ForbiddenException);
    });

    it("should trim whitespace from CORS_ORIGIN config", () => {
      process.env.CORS_ORIGIN =
        "  http://localhost:3000  ,  http://localhost:3001  ";

      const newMiddleware = new CsrfMiddleware();

      mockRequest = {
        method: "POST",
        headers: {
          origin: "http://localhost:3000",
        },
      };
      mockResponse = {};

      newMiddleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it("should handle multiple origins in CORS_ORIGIN", () => {
      process.env.CORS_ORIGIN =
        "http://localhost:3000,http://example.com,http://app.org";

      const newMiddleware = new CsrfMiddleware();

      mockRequest = {
        method: "POST",
        headers: {
          origin: "http://example.com",
        },
      };
      mockResponse = {};

      newMiddleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it("should not call next when origin is forbidden", () => {
      mockRequest = {
        method: "POST",
        headers: {
          origin: "http://forbidden-origin.com",
        },
      };
      mockResponse = {};

      try {
        middleware.use(
          mockRequest as Request,
          mockResponse as Response,
          mockNext,
        );
      } catch {
        // Expected
      }

      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should properly extract origin from referer URL", () => {
      mockRequest = {
        method: "POST",
        headers: {
          referer: "http://localhost:3001/path/to/page?query=value",
        },
      };
      mockResponse = {};

      middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it("should reject referer from disallowed origin", () => {
      mockRequest = {
        method: "POST",
        headers: {
          referer: "http://unauthorized.com/path/to/page",
        },
      };
      mockResponse = {};

      expect(() => {
        middleware.use(
          mockRequest as Request,
          mockResponse as Response,
          mockNext,
        );
      }).toThrow(ForbiddenException);
    });
  });
});
