import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import * as request from "supertest";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UserAccount } from "../../src/users/entities/user-account.entity";
import { Session } from "../../src/auth/entities/session.entity";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import { AiAdmission } from "../../src/ai/entities/ai-admission.entity";
import { Camp } from "../../src/camps/entities/camp.entity";
import { Role } from "../../src/users/entities/role.entity";
import { InventoryMovement } from "../../src/resources/entities/inventory-movement.entity";
import { CampsModule } from "../../src/camps/camps.module";
import { AuthModule } from "../../src/auth/auth.module";
import { UsersModule } from "../../src/users/users.module";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { JwtAuthGuard } from "../../src/auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../src/auth/guards/roles.guard";
import { SessionInactivityGuard } from "../../src/auth/guards/session-inactivity.guard";
import { SessionActivityInterceptor } from "../../src/auth/interceptors/session-activity.interceptor";
import { ThrottlerModule } from "@nestjs/throttler";

describe("Camps E2E Tests", () => {
  let app: INestApplication;
  let userRepository: any;
  let sessionRepository: any;
  let roleRepository: any;
  let adminRoleId: number;
  let gestorRoleId: number;
  let adminToken: string;
  let gestorToken: string;
  let campId: number;

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
            limit: 100,
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
          entities: [AiAdmission, Camp, InventoryMovement],
          synchronize: true,
          logging: false,
        }),
        AuthModule,
        UsersModule,
        CampsModule,
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

    userRepository = moduleFixture.get(getRepositoryToken(UserAccount));
    sessionRepository = moduleFixture.get(getRepositoryToken(Session));
    roleRepository = moduleFixture.get(getRepositoryToken(Role));

    const adminRole =
      (await roleRepository.findOne({ where: { name: "admin" } })) ||
      (await roleRepository.save({ name: "admin" }));
    const gestorRole =
      (await roleRepository.findOne({ where: { name: "gestor_recursos" } })) ||
      (await roleRepository.save({ name: "gestor_recursos" }));

    adminRoleId = Number(adminRole.id);
    gestorRoleId = Number(gestorRole.id);
  });

  afterAll(async () => {
    try {
      await sessionRepository.delete({});
    } catch (error) {
      // Ignorar errores en limpieza
    }
    await app.close();
  });

  describe("Setup: Create test users and get tokens", () => {
    it("should create admin user and get token", async () => {
      const pass = process.env.TEST_ADMIN_PASSWORD ?? "***removed***";
      const hashedPassword = await bcrypt.hash(pass, 10);
      await userRepository.save({
        username: "admin_camps_test",
        email: "admin_camps@example.com",
        password_hash: hashedPassword,
        role_id: adminRoleId,
        is_active: true,
      });

      const response = await request(app.getHttpServer())
        .post("/auth/login")
        .send({
          username: "admin_camps_test",
          password: pass,
        })
        .expect(200);

      expect(response.body).toHaveProperty("access_token");
      adminToken = response.body.access_token;
    });

    it("should create gestor_recursos user and get token", async () => {
      const pass = process.env.TEST_GESTOR_PASSWORD ?? "***removed***";
      const hashedPassword = await bcrypt.hash(pass, 10);
      await userRepository.save({
        username: "gestor_camps_test",
        email: "gestor_camps@example.com",
        password_hash: hashedPassword,
        role_id: gestorRoleId,
        is_active: true,
      });

      const response = await request(app.getHttpServer())
        .post("/auth/login")
        .send({
          username: "gestor_camps_test",
          password: pass,
        })
        .expect(200);

      expect(response.body).toHaveProperty("access_token");
      gestorToken = response.body.access_token;
    });
  });

  describe("POST /camps - Create Camp (admin only)", () => {
    it("should create camp with admin token", async () => {
      const response = await request(app.getHttpServer())
        .post("/camps")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Campamento Base Norte",
          location_description: "Zona boscosa al norte",
          latitude: 9.9281,
          longitude: -84.0907,
          max_capacity: 150,
        })
        .expect(201);

      expect(response.body).toHaveProperty("id");
      expect(response.body.name).toBe("Campamento Base Norte");
      expect(response.body.max_capacity).toBe(150);

      campId = response.body.id;
    });

    it("should reject camp creation with gestor token", async () => {
      await request(app.getHttpServer())
        .post("/camps")
        .set("Authorization", `Bearer ${gestorToken}`)
        .send({
          name: "Campamento Unauthorized",
          max_capacity: 100,
        })
        .expect(403);
    });

    it("should reject camp creation without token", async () => {
      await request(app.getHttpServer())
        .post("/camps")
        .send({
          name: "Campamento Sin Token",
          max_capacity: 100,
        })
        .expect(401);
    });

    it("should require name field", async () => {
      await request(app.getHttpServer())
        .post("/camps")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          max_capacity: 100,
        })
        .expect(400);
    });

    it("should validate name min length", async () => {
      await request(app.getHttpServer())
        .post("/camps")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "C",
          max_capacity: 100,
        })
        .expect(400);
    });

    it("should validate latitude range -90 to 90", async () => {
      await request(app.getHttpServer())
        .post("/camps")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Campamento GPS Invalido",
          latitude: 150,
          longitude: -84.0907,
        })
        .expect(400);
    });

    it("should validate longitude range -180 to 180", async () => {
      await request(app.getHttpServer())
        .post("/camps")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Campamento GPS Invalido",
          latitude: 9.9281,
          longitude: 200,
        })
        .expect(400);
    });

    it("should validate max_capacity is positive", async () => {
      await request(app.getHttpServer())
        .post("/camps")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Campamento Capacity Zero",
          max_capacity: 0,
        })
        .expect(400);
    });

    it("should accept optional fields", async () => {
      const response = await request(app.getHttpServer())
        .post("/camps")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Campamento Minimalista",
        })
        .expect(201);

      expect(response.body).toHaveProperty("id");
      expect(response.body.name).toBe("Campamento Minimalista");
    });
  });

  describe("GET /camps - List all camps", () => {
    it("should list all camps without token", async () => {
      const response = await request(app.getHttpServer())
        .get("/camps")
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it("should list camps with admin token", async () => {
      const response = await request(app.getHttpServer())
        .get("/camps")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it("should list camps with gestor token", async () => {
      const response = await request(app.getHttpServer())
        .get("/camps")
        .set("Authorization", `Bearer ${gestorToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it("should return empty array if no camps", async () => {
      const response = await request(app.getHttpServer())
        .get("/camps")
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe("GET /camps/:id - Get camp detail", () => {
    it("should get camp detail without token", async () => {
      const response = await request(app.getHttpServer())
        .get(`/camps/${campId}`)
        .expect(200);

      expect(response.body.id).toBe(campId);
      expect(response.body).toHaveProperty("name");
      expect(response.body).toHaveProperty("max_capacity");
    });

    it("should get camp detail with admin token", async () => {
      const response = await request(app.getHttpServer())
        .get(`/camps/${campId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.id).toBe(campId);
    });

    it("should return 404 for non-existent camp", async () => {
      await request(app.getHttpServer()).get("/camps/99999").expect(404);
    });

    it("should validate id is numeric", async () => {
      await request(app.getHttpServer()).get("/camps/invalid").expect(400);
    });

    it("should return camp with all properties", async () => {
      const response = await request(app.getHttpServer())
        .get(`/camps/${campId}`)
        .expect(200);

      expect(response.body).toHaveProperty("id");
      expect(response.body).toHaveProperty("name");
      expect(response.body).toHaveProperty("max_capacity");
      expect(response.body).toHaveProperty("active");
    });
  });

  describe("PATCH /camps/:id - Update camp (admin only)", () => {
    it("should update camp with admin token", async () => {
      const response = await request(app.getHttpServer())
        .patch(`/camps/${campId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Campamento Base Norte Actualizado",
          max_capacity: 200,
        })
        .expect(200);

      expect(response.body.name).toBe("Campamento Base Norte Actualizado");
      expect(response.body.max_capacity).toBe(200);
    });

    it("should reject update with gestor token", async () => {
      await request(app.getHttpServer())
        .patch(`/camps/${campId}`)
        .set("Authorization", `Bearer ${gestorToken}`)
        .send({
          name: "Campamento Unauthorized",
        })
        .expect(403);
    });

    it("should reject update without token", async () => {
      await request(app.getHttpServer())
        .patch(`/camps/${campId}`)
        .send({
          name: "Campamento Sin Token",
        })
        .expect(401);
    });

    it("should return 404 for non-existent camp", async () => {
      await request(app.getHttpServer())
        .patch("/camps/99999")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Campamento Inexistente",
        })
        .expect(404);
    });

    it("should update camp active status", async () => {
      const response = await request(app.getHttpServer())
        .patch(`/camps/${campId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          active: false,
        })
        .expect(200);

      expect(response.body.active).toBe(false);
    });

    it("should allow partial updates", async () => {
      const response = await request(app.getHttpServer())
        .patch(`/camps/${campId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          location_description: "Nueva descripciÃ³n de ubicaciÃ³n",
        })
        .expect(200);

      expect(response.body.location_description).toBe(
        "Nueva descripciÃ³n de ubicaciÃ³n",
      );
    });

    it("should validate latitude if provided", async () => {
      await request(app.getHttpServer())
        .patch(`/camps/${campId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          latitude: 150,
        })
        .expect(400);
    });
  });

  describe("DELETE /camps/:id - Soft delete camp (admin only)", () => {
    it("should soft delete camp with admin token", async () => {
      await request(app.getHttpServer())
        .delete(`/camps/${campId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      const response = await request(app.getHttpServer()).get(
        `/camps/${campId}`,
      );

      expect(response.body.active).toBe(false);
    });

    it("should reject delete with gestor token", async () => {
      await request(app.getHttpServer())
        .delete(`/camps/${campId}`)
        .set("Authorization", `Bearer ${gestorToken}`)
        .expect(403);
    });

    it("should reject delete without token", async () => {
      await request(app.getHttpServer()).delete(`/camps/${campId}`).expect(401);
    });

    it("should return 404 for non-existent camp", async () => {
      await request(app.getHttpServer())
        .delete("/camps/99999")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(404);
    });

    it("should validate id is numeric", async () => {
      await request(app.getHttpServer())
        .delete("/camps/invalid")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(400);
    });
  });

  describe("Auth validation for all camp endpoints", () => {
    it("should require bearer token format for protected routes", async () => {
      await request(app.getHttpServer())
        .post("/camps")
        .set("Authorization", "InvalidToken")
        .send({
          name: "Campamento Test",
        })
        .expect(401);
    });

    it("should reject expired tokens", async () => {
      const expiredToken = "invalid_expired_token_placeholder_test";

      await request(app.getHttpServer())
        .post("/camps")
        .set("Authorization", `Bearer ${expiredToken}`)
        .send({
          name: "Campamento Test",
        })
        .expect(401);
    });
  });
});
