import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import * as request from "supertest";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { HealthModule } from "../../src/health/health.module";
import { AuthModule } from "../../src/auth/auth.module";
import { UsersModule } from "../../src/users/users.module";
import { AiAdmission } from "../../src/ai/entities/ai-admission.entity";
import { Camp } from "../../src/camps/entities/camp.entity";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { JwtAuthGuard } from "../../src/auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../src/auth/guards/roles.guard";
import { SessionInactivityGuard } from "../../src/auth/guards/session-inactivity.guard";
import { SessionActivityInterceptor } from "../../src/auth/interceptors/session-activity.interceptor";
import { ThrottlerModule } from "@nestjs/throttler";

describe("Health E2E Tests", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: ".env.test",
        }),
        ThrottlerModule.forRoot([
          {
            ttl: 60000,
            limit: 10,
          },
        ]),
        TypeOrmModule.forRoot({
          type: "postgres",
          host: process.env.DB_HOST || "localhost",
          port: parseInt(process.env.DB_PORT || "5432"),
          username: process.env.DB_USER || "postgres",
          password: process.env.DB_PASS || "postgres",
          database: process.env.DB_NAME_TEST || "gestion_test",
          autoLoadEntities: true,
          entities: [AiAdmission, Camp],
          synchronize: true,
          logging: false,
        }),
        AuthModule,
        UsersModule,
        HealthModule,
      ],
      providers: [
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: SessionInactivityGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        { provide: APP_INTERCEPTOR, useClass: SessionActivityInterceptor },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("GET /health - Basic Health Check", () => {
    it("should return 200 with server info", async () => {
      const res = await request(app.getHttpServer()).get("/health");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("status", "ok");
    });

    it("should return server info object with all required fields", async () => {
      const res = await request(app.getHttpServer()).get("/health");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("status");
      expect(res.body).toHaveProperty("timestamp");
      expect(res.body).toHaveProperty("timestampUnix");
      expect(res.body).toHaveProperty("timezone");
      expect(res.body).toHaveProperty("uptime");
      expect(res.body).toHaveProperty("nodeVersion");
      expect(res.body).toHaveProperty("environment");
    });

    it("should return valid ISO timestamp", async () => {
      const res = await request(app.getHttpServer()).get("/health");

      expect(res.status).toBe(200);
      const timestamp = new Date(res.body.timestamp);
      expect(timestamp.getTime()).toBeGreaterThan(0);
      expect(res.body.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
      );
    });

    it("should return valid Unix timestamp", async () => {
      const res = await request(app.getHttpServer()).get("/health");

      expect(res.status).toBe(200);
      expect(typeof res.body.timestampUnix).toBe("number");
      expect(res.body.timestampUnix).toBeGreaterThan(1700000000); // After 2023
      expect(res.body.timestampUnix).toBeLessThan(2000000000); // Before 2033
    });

    it("should return valid timezone", async () => {
      const res = await request(app.getHttpServer()).get("/health");

      expect(res.status).toBe(200);
      expect(typeof res.body.timezone).toBe("string");
      expect(res.body.timezone.length).toBeGreaterThan(0);
    });

    it("should return positive uptime", async () => {
      const res = await request(app.getHttpServer()).get("/health");

      expect(res.status).toBe(200);
      expect(typeof res.body.uptime).toBe("number");
      expect(res.body.uptime).toBeGreaterThan(0);
    });

    it("should return valid Node.js version", async () => {
      const res = await request(app.getHttpServer()).get("/health");

      expect(res.status).toBe(200);
      expect(res.body.nodeVersion).toMatch(/^v\d+\.\d+\.\d+/);
    });

    it("should return current environment", async () => {
      const res = await request(app.getHttpServer()).get("/health");

      expect(res.status).toBe(200);
      expect(["development", "production", "test"]).toContain(
        res.body.environment,
      );
    });

    it("should be public endpoint - accessible without token", async () => {
      const res = await request(app.getHttpServer())
        .get("/health")
        .set("Authorization", ""); // No auth

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ok");
    });

    it("should handle multiple requests consistently", async () => {
      const res1 = await request(app.getHttpServer()).get("/health");
      const res2 = await request(app.getHttpServer()).get("/health");

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);

      expect(res1.body.status).toBe("ok");
      expect(res2.body.status).toBe("ok");

      // Timestamps should be different but close together
      const time1 = new Date(res1.body.timestamp).getTime();
      const time2 = new Date(res2.body.timestamp).getTime();
      const diff = Math.abs(time2 - time1);

      expect(diff).toBeGreaterThanOrEqual(0);
      expect(diff).toBeLessThan(5000); // Within 5 seconds
    });

    it("should return consistent status value across calls", async () => {
      const responses = await Promise.all([
        request(app.getHttpServer()).get("/health"),
        request(app.getHttpServer()).get("/health"),
        request(app.getHttpServer()).get("/health"),
      ]);

      responses.forEach((res) => {
        expect(res.status).toBe(200);
        expect(res.body.status).toBe("ok");
      });
    });
  });

  describe("GET /health/server-time - Server Time Endpoint", () => {
    it("should return 200 with server time", async () => {
      const res = await request(app.getHttpServer()).get("/health/server-time");

      expect(res.status).toBe(200);
    });

    it("should return server time object with all required fields", async () => {
      const res = await request(app.getHttpServer()).get("/health/server-time");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("serverTime");
      expect(res.body).toHaveProperty("timestampUnix");
      expect(res.body).toHaveProperty("timezone");
    });

    it("should return valid ISO server time format", async () => {
      const res = await request(app.getHttpServer()).get("/health/server-time");

      expect(res.status).toBe(200);
      const serverTime = new Date(res.body.serverTime);
      expect(serverTime.getTime()).toBeGreaterThan(0);
      expect(res.body.serverTime).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
      );
    });

    it("should return valid Unix timestamp", async () => {
      const res = await request(app.getHttpServer()).get("/health/server-time");

      expect(res.status).toBe(200);
      expect(typeof res.body.timestampUnix).toBe("number");
      expect(res.body.timestampUnix).toBeGreaterThan(1700000000); // After 2023
      expect(res.body.timestampUnix).toBeLessThan(2000000000); // Before 2033
    });

    it("should return valid timezone", async () => {
      const res = await request(app.getHttpServer()).get("/health/server-time");

      expect(res.status).toBe(200);
      expect(typeof res.body.timezone).toBe("string");
      expect(res.body.timezone.length).toBeGreaterThan(0);
    });

    it("serverTime and timestampUnix should be consistent", async () => {
      const res = await request(app.getHttpServer()).get("/health/server-time");

      expect(res.status).toBe(200);
      const serverDate = new Date(res.body.serverTime);
      const unixDate = new Date(res.body.timestampUnix * 1000);

      const diff = Math.abs(serverDate.getTime() - unixDate.getTime());
      expect(diff).toBeLessThan(1000); // Within 1 second
    });

    it("should be public endpoint - accessible without token", async () => {
      const res = await request(app.getHttpServer())
        .get("/health/server-time")
        .set("Authorization", ""); // No auth

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("serverTime");
    });

    it("should return current server time (not past time)", async () => {
      const res = await request(app.getHttpServer()).get("/health/server-time");

      expect(res.status).toBe(200);
      const serverTime = new Date(res.body.serverTime).getTime();
      const localTime = new Date().getTime();

      const diff = Math.abs(localTime - serverTime);
      expect(diff).toBeLessThan(5000); // Within 5 seconds
    });

    it("should provide different times for sequential requests", async () => {
      const res1 = await request(app.getHttpServer()).get(
        "/health/server-time",
      );

      // Wait 100ms
      await new Promise((resolve) => setTimeout(resolve, 100));

      const res2 = await request(app.getHttpServer()).get(
        "/health/server-time",
      );

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);

      const time1 = res1.body.timestampUnix;
      const time2 = res2.body.timestampUnix;

      expect(time2).toBeGreaterThanOrEqual(time1);
    });

    it("should handle concurrent requests", async () => {
      const responses = await Promise.all([
        request(app.getHttpServer()).get("/health/server-time"),
        request(app.getHttpServer()).get("/health/server-time"),
        request(app.getHttpServer()).get("/health/server-time"),
      ]);

      responses.forEach((res) => {
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("serverTime");
        expect(res.body).toHaveProperty("timestampUnix");
        expect(res.body).toHaveProperty("timezone");
      });
    });
  });

  describe("Health Check - Data Consistency", () => {
    it("should return consistent timezone across endpoints", async () => {
      const res1 = await request(app.getHttpServer()).get("/health");
      const res2 = await request(app.getHttpServer()).get(
        "/health/server-time",
      );

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);

      expect(res1.body.timezone).toBe(res2.body.timezone);
    });

    it("should return timestamps within acceptable range of each other", async () => {
      const res1 = await request(app.getHttpServer()).get("/health");
      const res2 = await request(app.getHttpServer()).get(
        "/health/server-time",
      );

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);

      const time1 = new Date(res1.body.timestamp).getTime();
      const time2 = new Date(res2.body.serverTime).getTime();

      const diff = Math.abs(time1 - time2);
      expect(diff).toBeLessThan(1000); // Within 1 second
    });

    it("should have health status ok and valid server time in health check", async () => {
      const res = await request(app.getHttpServer()).get("/health");

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ok");
      expect(res.body.timestamp).toBeDefined();
      expect(res.body.timestampUnix).toBeDefined();
    });
  });

  describe("Health Check - Edge Cases", () => {
    it("should handle unknown route gracefully", async () => {
      const res = await request(app.getHttpServer()).get("/health/unknown");

      expect(res.status).toBe(404);
    });

    it("should handle POST request to health endpoint", async () => {
      const res = await request(app.getHttpServer()).post("/health").send({});

      expect(res.status).toBe(405); // Method Not Allowed
    });

    it("should handle DELETE request to health endpoint", async () => {
      const res = await request(app.getHttpServer()).delete("/health").send({});

      expect(res.status).toBe(405); // Method Not Allowed
    });

    it("should handle PUT request to health endpoint", async () => {
      const res = await request(app.getHttpServer()).put("/health").send({});

      expect(res.status).toBe(405); // Method Not Allowed
    });

    it("should return correct response headers", async () => {
      const res = await request(app.getHttpServer()).get("/health");

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("application/json");
    });
  });
});
