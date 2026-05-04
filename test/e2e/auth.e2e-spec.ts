import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import * as request from "supertest";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UserAccount } from "../../src/users/entities/user-account.entity";
import { LoginAttempt } from "../../src/auth/entities/login-attempt.entity";
import { Session } from "../../src/auth/entities/session.entity";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import { AiAdmission } from "../../src/ai/entities/ai-admission.entity";
import { Camp } from "../../src/camps/entities/camp.entity";
import { Role } from "../../src/users/entities/role.entity";
import { AuthModule } from "../../src/auth/auth.module";
import { UsersModule } from "../../src/users/users.module";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { JwtAuthGuard } from "../../src/auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../src/auth/guards/roles.guard";
import { SessionInactivityGuard } from "../../src/auth/guards/session-inactivity.guard";
import { SessionActivityInterceptor } from "../../src/auth/interceptors/session-activity.interceptor";
import { ThrottlerModule } from "@nestjs/throttler";

describe("Auth E2E Tests", () => {
  let app: INestApplication;
  let userRepository: any;
  let loginAttemptRepository: any;
  let sessionRepository: any;
  let roleRepository: any;
  let workerRoleId: number;

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
    loginAttemptRepository = moduleFixture.get(
      getRepositoryToken(LoginAttempt),
    );
    sessionRepository = moduleFixture.get(getRepositoryToken(Session));
    roleRepository = moduleFixture.get(getRepositoryToken(Role));

    const workerRole =
      (await roleRepository.findOne({ where: { name: "trabajador" } })) ||
      (await roleRepository.save({ name: "trabajador" }));
    workerRoleId = Number(workerRole.id);
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(async () => {
    // Limpiar datos de prueba
    try {
      await loginAttemptRepository.delete({});
      await sessionRepository.delete({});
      await userRepository.delete({});
    } catch (error) {
      // Ignorar errores en limpieza
    }
  });

  describe("POST /auth/login - Happy Path", () => {
    beforeEach(async () => {
      // Crear usuario de prueba
      const hashedPassword = await bcrypt.hash("password123", 10);
      await userRepository.save({
        username: "testuser",
        email: "test@example.com",
        password_hash: hashedPassword,
        role_id: workerRoleId,
        is_active: true,
      });
    });

    it("should successfully login with valid credentials", async () => {
      const res = await request(app.getHttpServer()).post("/auth/login").send({
        username: "testuser",
        password: "password123",
      });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("access_token");
      expect(res.body).toHaveProperty("refresh_token");
      expect(res.body.access_token).toBeTruthy();
      expect(res.body.refresh_token).toBeTruthy();
    });

    it("should return user info in login response", async () => {
      const res = await request(app.getHttpServer()).post("/auth/login").send({
        username: "testuser",
        password: "password123",
      });

      expect(res.status).toBe(200);
      expect(res.body.user).toHaveProperty("id");
      expect(res.body.user).toHaveProperty("username", "testuser");
      expect(res.body.user).toHaveProperty("role", "trabajador");
    });

    it("should create a session record on login", async () => {
      const res = await request(app.getHttpServer()).post("/auth/login").send({
        username: "testuser",
        password: "password123",
      });

      expect(res.status).toBe(200);

      // Verificar que se creÃ³ sesiÃ³n en BD
      const sessions = await sessionRepository.find({
        where: { user_id: res.body.user.id },
      });
      expect(sessions.length).toBeGreaterThan(0);
    });

    it("should log login attempt on success", async () => {
      const res = await request(app.getHttpServer()).post("/auth/login").send({
        username: "testuser",
        password: "password123",
      });

      expect(res.status).toBe(200);

      // Verificar que se registrÃ³ el intento de login
      const attempts = await loginAttemptRepository.find({
        where: { username: "testuser" },
      });
      expect(attempts.length).toBeGreaterThan(0);
    });
  });

  describe("POST /auth/login - Error Cases", () => {
    beforeEach(async () => {
      const hashedPassword = await bcrypt.hash("password123", 10);
      await userRepository.save({
        username: "testuser",
        email: "test@example.com",
        password_hash: hashedPassword,
        role_id: workerRoleId,
        is_active: true,
      });
    });

    it("should fail login with invalid password", async () => {
      const res = await request(app.getHttpServer()).post("/auth/login").send({
        username: "testuser",
        password: "wrongpassword",
      });

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty("message");
    });

    it("should fail login with non-existent user", async () => {
      const res = await request(app.getHttpServer()).post("/auth/login").send({
        username: "nonexistent",
        password: "password123",
      });

      expect(res.status).toBe(401);
    });

    it("should fail login with inactive user", async () => {
      await userRepository.update(
        { username: "testuser" },
        { is_active: false },
      );

      const res = await request(app.getHttpServer()).post("/auth/login").send({
        username: "testuser",
        password: "password123",
      });

      expect(res.status).toBe(401);
    });

    it("should validate required fields", async () => {
      const res = await request(app.getHttpServer()).post("/auth/login").send({
        username: "testuser",
        // password missing
      });

      expect(res.status).toBe(400);
    });
  });

  describe("POST /auth/refresh - JWT Refresh Token", () => {
    let accessToken: string;
    let refreshToken: string;

    beforeEach(async () => {
      const hashedPassword = await bcrypt.hash("password123", 10);
      await userRepository.save({
        username: "testuser",
        email: "test@example.com",
        password_hash: hashedPassword,
        role_id: workerRoleId,
        is_active: true,
      });

      const loginRes = await request(app.getHttpServer())
        .post("/auth/login")
        .send({
          username: "testuser",
          password: "password123",
        });

      accessToken = loginRes.body.access_token;
      refreshToken = loginRes.body.refresh_token;
    });

    it("should refresh token with valid refresh token", async () => {
      const res = await request(app.getHttpServer())
        .post("/auth/refresh")
        .send({
          refresh_token: refreshToken,
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("access_token");
      expect(res.body.access_token).not.toBe(accessToken); // Nuevo token
    });

    it("should fail refresh with invalid refresh token", async () => {
      const res = await request(app.getHttpServer())
        .post("/auth/refresh")
        .send({
          refresh_token: "invalid.token.here",
        });

      expect(res.status).toBe(401);
    });

    it("should fail refresh without refresh token", async () => {
      const res = await request(app.getHttpServer())
        .post("/auth/refresh")
        .send({});

      expect(res.status).toBe(400);
    });
  });

  describe("POST /auth/logout - Logout", () => {
    let accessToken: string;

    beforeEach(async () => {
      const hashedPassword = await bcrypt.hash("password123", 10);
      await userRepository.save({
        username: "testuser",
        email: "test@example.com",
        password_hash: hashedPassword,
        role_id: workerRoleId,
        is_active: true,
      });

      const loginRes = await request(app.getHttpServer())
        .post("/auth/login")
        .send({
          username: "testuser",
          password: "password123",
        });

      accessToken = loginRes.body.access_token;
    });

    it("should successfully logout with valid token", async () => {
      const res = await request(app.getHttpServer())
        .post("/auth/logout")
        .set("Authorization", `Bearer ${accessToken}`);

      expect(res.status).toBe(204);
    });

    it("should fail logout without token", async () => {
      const res = await request(app.getHttpServer())
        .post("/auth/logout")
        .send({});

      expect(res.status).toBe(401);
    });

    it("should invalidate session after logout", async () => {
      await request(app.getHttpServer())
        .post("/auth/logout")
        .set("Authorization", `Bearer ${accessToken}`);

      // Intentar usar el token nuevamente deberÃ­a fallar
      const res = await request(app.getHttpServer())
        .get("/auth/session-status")
        .set("Authorization", `Bearer ${accessToken}`);

      expect(res.status).toBe(401);
    });
  });

  describe("GET /auth/session-status - Protected Route", () => {
    let accessToken: string;

    beforeEach(async () => {
      const hashedPassword = await bcrypt.hash("password123", 10);
      await userRepository.save({
        username: "testuser",
        email: "test@example.com",
        password_hash: hashedPassword,
        role_id: workerRoleId,
        is_active: true,
      });

      const loginRes = await request(app.getHttpServer())
        .post("/auth/login")
        .send({
          username: "testuser",
          password: "password123",
        });

      accessToken = loginRes.body.access_token;
    });

    it("should access protected route with valid token", async () => {
      const res = await request(app.getHttpServer())
        .get("/auth/session-status")
        .set("Authorization", `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("isActive");
      expect(res.body).toHaveProperty("lastActivity");
      expect(res.body).toHaveProperty("minutesUntilExpiration");
    });

    it("should fail to access protected route without token", async () => {
      const res = await request(app.getHttpServer()).get(
        "/auth/session-status",
      );

      expect(res.status).toBe(401);
    });

    it("should fail with invalid token format", async () => {
      const res = await request(app.getHttpServer())
        .get("/auth/session-status")
        .set("Authorization", "InvalidFormat");

      expect(res.status).toBe(401);
    });

    it("should check for session inactivity", async () => {
      const res = await request(app.getHttpServer())
        .get("/auth/session-status")
        .set("Authorization", `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("isActive");
      expect(res.body).toHaveProperty("minutesUntilExpiration");
    });
  });

  describe("JWT Guard - Protected Routes with @Public", () => {
    let accessToken: string;

    beforeEach(async () => {
      const hashedPassword = await bcrypt.hash("password123", 10);
      await userRepository.save({
        username: "testuser",
        email: "test@example.com",
        password_hash: hashedPassword,
        role_id: workerRoleId,
        is_active: true,
      });

      const loginRes = await request(app.getHttpServer())
        .post("/auth/login")
        .send({
          username: "testuser",
          password: "password123",
        });

      accessToken = loginRes.body.access_token;
    });

    it("should allow public endpoints without token", async () => {
      const res = await request(app.getHttpServer()).post("/auth/login").send({
        username: "testuser",
        password: "password123",
      });

      expect(res.status).toBe(200);
    });

    it("should work with JWT guard on protected endpoints", async () => {
      const res = await request(app.getHttpServer())
        .get("/auth/session-status")
        .set("Authorization", `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
    });
  });

  describe("Complete Auth Flow - Integration", () => {
    it("should complete full auth lifecycle", async () => {
      // 1. Crear usuario
      const hashedPassword = await bcrypt.hash("password123", 10);
      await userRepository.save({
        username: "testuser",
        email: "test@example.com",
        password_hash: hashedPassword,
        role_id: workerRoleId,
        is_active: true,
      });

      // 2. Login
      const loginRes = await request(app.getHttpServer())
        .post("/auth/login")
        .send({
          username: "testuser",
          password: "password123",
        });

      expect(loginRes.status).toBe(200);
      const { access_token, refresh_token } = loginRes.body;

      // 3. Usar token para acceder ruta protegida
      const statusRes = await request(app.getHttpServer())
        .get("/auth/session-status")
        .set("Authorization", `Bearer ${access_token}`);

      expect(statusRes.status).toBe(200);

      // 4. Refrescar token
      const refreshRes = await request(app.getHttpServer())
        .post("/auth/refresh")
        .send({
          refresh_token: refresh_token,
        });

      expect(refreshRes.status).toBe(200);
      const newAccessToken = refreshRes.body.access_token;

      // 5. Usar nuevo token
      const statusRes2 = await request(app.getHttpServer())
        .get("/auth/session-status")
        .set("Authorization", `Bearer ${newAccessToken}`);

      expect(statusRes2.status).toBe(200);

      // 6. Logout
      const logoutRes = await request(app.getHttpServer())
        .post("/auth/logout")
        .set("Authorization", `Bearer ${newAccessToken}`);

      expect(logoutRes.status).toBe(204);

      // 7. Token ya no funciona despuÃ©s de logout
      const finalRes = await request(app.getHttpServer())
        .get("/auth/session-status")
        .set("Authorization", `Bearer ${newAccessToken}`);

      expect(finalRes.status).toBe(401);
    });
  });

  describe("SessionActivityInterceptor - Tracks Activity", () => {
    let accessToken: string;
    let userId: number;

    beforeEach(async () => {
      const hashedPassword = await bcrypt.hash("password123", 10);
      const user = await userRepository.save({
        username: "testuser",
        email: "test@example.com",
        password_hash: hashedPassword,
        role_id: workerRoleId,
        is_active: true,
      });
      userId = user.id;

      const loginRes = await request(app.getHttpServer())
        .post("/auth/login")
        .send({
          username: "testuser",
          password: "password123",
        });

      accessToken = loginRes.body.access_token;
    });

    it("should update last_activity on authenticated request", async () => {
      const sessionBefore = await sessionRepository.findOne({
        where: { user_id: userId },
      });

      const timestampBefore = sessionBefore?.last_activity?.getTime() || 0;

      // Esperar un poco para que timestamp sea diferente
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Hacer request autenticado
      await request(app.getHttpServer())
        .get("/auth/session-status")
        .set("Authorization", `Bearer ${accessToken}`);

      const sessionAfter = await sessionRepository.findOne({
        where: { user_id: userId },
      });

      expect(sessionAfter?.last_activity?.getTime()).toBeGreaterThan(
        timestampBefore,
      );
    });
  });
});
