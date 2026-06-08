import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { HealthController } from "./health.controller";
import { HealthService } from "./health.service";

describe("HealthController", () => {
  let controller: HealthController;
  let service: HealthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [HealthService],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    service = module.get<HealthService>(HealthService);
  });

  describe("check", () => {
    it("should return server info", () => {
      const result = controller.check();

      expect(result).toHaveProperty("status");
      expect(result).toHaveProperty("timestamp");
      expect(result).toHaveProperty("timestampUnix");
      expect(result.status).toBe("ok");
    });

    it("should call HealthService.getServerInfo", () => {
      const spy = jest.spyOn(service, "getServerInfo");
      controller.check();
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it("should return object with all required health properties", () => {
      const result = controller.check();

      expect(result.status).toBe("ok");
      expect(typeof result.timestamp).toBe("string");
      expect(typeof result.timestampUnix).toBe("number");
      expect(typeof result.timezone).toBe("string");
      expect(typeof result.uptime).toBe("number");
      expect(typeof result.nodeVersion).toBe("string");
      expect(typeof result.environment).toBe("string");
    });
  });

  describe("getServerTime", () => {
    it("should return server time with ISO format", () => {
      const result = controller.getServerTime();

      expect(result).toHaveProperty("serverTime");
      expect(result).toHaveProperty("timestampUnix");
      expect(result).toHaveProperty("timezone");
    });

    it("should return serverTime in ISO format", () => {
      const result = controller.getServerTime();

      expect(typeof result.serverTime).toBe("string");
      expect(result.serverTime).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it("should return Unix timestamp as number", () => {
      const result = controller.getServerTime();

      expect(typeof result.timestampUnix).toBe("number");
      expect(result.timestampUnix).toBeGreaterThan(0);
    });

    it("should return timezone as string", () => {
      const result = controller.getServerTime();

      expect(typeof result.timezone).toBe("string");
      expect(result.timezone.length).toBeGreaterThan(0);
    });

    it("should call HealthService.getServerTime", () => {
      const spy = jest.spyOn(service, "getServerTime");
      controller.getServerTime();
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it("should have consistent ISO and Unix timestamps", () => {
      const result = controller.getServerTime();
      const dateFromIso = new Date(result.serverTime);
      const unixFromIso = Math.floor(dateFromIso.getTime() / 1000);

      expect(Math.abs(unixFromIso - result.timestampUnix)).toBeLessThanOrEqual(
        1,
      );
    });

    it("should return current time (within 1 second tolerance)", () => {
      const beforeCall = Math.floor(Date.now() / 1000);
      const result = controller.getServerTime();
      const afterCall = Math.floor(Date.now() / 1000);

      expect(result.timestampUnix).toBeGreaterThanOrEqual(beforeCall);
      expect(result.timestampUnix).toBeLessThanOrEqual(afterCall + 1);
    });
  });
});
