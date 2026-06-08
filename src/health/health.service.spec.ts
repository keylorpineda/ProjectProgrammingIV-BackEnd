import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { HealthService } from "./health.service";

describe("HealthService", () => {
  let service: HealthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HealthService],
    }).compile();

    service = module.get<HealthService>(HealthService);
  });

  describe("getServerTime", () => {
    it("should return a Date instance", () => {
      const result = service.getServerTime();
      expect(result).toBeInstanceOf(Date);
    });

    it("should return current server time", () => {
      const beforeCall = new Date();
      const result = service.getServerTime();
      const afterCall = new Date();

      expect(result.getTime()).toBeGreaterThanOrEqual(beforeCall.getTime());
      expect(result.getTime()).toBeLessThanOrEqual(afterCall.getTime());
    });

    it("should return a valid timestamp", () => {
      const result = service.getServerTime();
      expect(result.getTime()).toBeGreaterThan(0);
      expect(isNaN(result.getTime())).toBe(false);
    });
  });

  describe("getServerInfo", () => {
    it("should return server info object with required properties", () => {
      const result = service.getServerInfo();

      expect(result).toHaveProperty("status");
      expect(result).toHaveProperty("timestamp");
      expect(result).toHaveProperty("timestampUnix");
      expect(result).toHaveProperty("timezone");
      expect(result).toHaveProperty("uptime");
      expect(result).toHaveProperty("nodeVersion");
      expect(result).toHaveProperty("environment");
    });

    it("should have status equal to ok", () => {
      const result = service.getServerInfo();
      expect(result.status).toBe("ok");
    });

    it("should return ISO timestamp format", () => {
      const result = service.getServerInfo();
      expect(typeof result.timestamp).toBe("string");
      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO format check
    });

    it("should return Unix timestamp as number", () => {
      const result = service.getServerInfo();
      expect(typeof result.timestampUnix).toBe("number");
      expect(result.timestampUnix).toBeGreaterThan(0);
    });

    it("should return timezone", () => {
      const result = service.getServerInfo();
      expect(typeof result.timezone).toBe("string");
      expect(result.timezone.length).toBeGreaterThan(0);
    });

    it("should return uptime as positive number", () => {
      const result = service.getServerInfo();
      expect(typeof result.uptime).toBe("number");
      expect(result.uptime).toBeGreaterThan(0);
    });

    it("should return Node.js version", () => {
      const result = service.getServerInfo();
      expect(typeof result.nodeVersion).toBe("string");
      expect(result.nodeVersion).toMatch(/^v\d+\.\d+\.\d+/); // v18.0.0 format
    });

    it("should return environment (development or production)", () => {
      const result = service.getServerInfo();
      expect(typeof result.environment).toBe("string");
      expect(
        ["development", "production", "test"].includes(result.environment),
      ).toBe(true);
    });

    it("should have consistent timestamp and timestampUnix", () => {
      const result = service.getServerInfo();
      const dateFromUnix = Math.floor(
        new Date(result.timestamp).getTime() / 1000,
      );
      expect(Math.abs(dateFromUnix - result.timestampUnix)).toBeLessThanOrEqual(
        1,
      ); // Allow 1 second difference
    });

    it("should return environment from NODE_ENV or default to development", () => {
      const originalNodeEnv = process.env.NODE_ENV;

      // Test when NODE_ENV is set
      process.env.NODE_ENV = "production";
      const resultWithEnv = service.getServerInfo();
      expect(resultWithEnv.environment).toBe("production");

      // Test when NODE_ENV is undefined (defaults to development)
      delete process.env.NODE_ENV;
      const resultWithoutEnv = service.getServerInfo();
      expect(resultWithoutEnv.environment).toBe("development");

      // Restore original NODE_ENV
      if (originalNodeEnv) {
        process.env.NODE_ENV = originalNodeEnv;
      } else {
        delete process.env.NODE_ENV;
      }
    });
  });
});
