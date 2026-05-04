import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import * as request from "supertest";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UserAccount } from "../../src/users/entities/user-account.entity";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import { AiAdmission } from "../../src/ai/entities/ai-admission.entity";
import { Camp } from "../../src/camps/entities/camp.entity";
import { Role } from "../../src/users/entities/role.entity";
import { UploadModule } from "../../src/upload/upload.module";
import { AuthModule } from "../../src/auth/auth.module";
import { UsersModule } from "../../src/users/users.module";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { JwtAuthGuard } from "../../src/auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../src/auth/guards/roles.guard";
import { SessionInactivityGuard } from "../../src/auth/guards/session-inactivity.guard";
import { SessionActivityInterceptor } from "../../src/auth/interceptors/session-activity.interceptor";
import { ThrottlerModule } from "@nestjs/throttler";

describe("Upload E2E Tests", () => {
  let app: INestApplication;
  let userRepository: any;
  let roleRepository: any;
  let workerRoleId: number;
  let authToken: string;

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
          entities: [AiAdmission, Camp],
          synchronize: true,
          logging: false,
        }),
        AuthModule,
        UsersModule,
        UploadModule,
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
    roleRepository = moduleFixture.get(getRepositoryToken(Role));

    const workerRole =
      (await roleRepository.findOne({ where: { name: "trabajador" } })) ||
      (await roleRepository.save({ name: "trabajador" }));
    workerRoleId = Number(workerRole.id);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Crear usuario de prueba
    const hashedPassword = await bcrypt.hash("testpass123", 10);
    await userRepository.save({
      username: "uploadtestuser",
      email: "uploadtest@example.com",
      password_hash: hashedPassword,
      role_id: workerRoleId,
      is_active: true,
    });

    // Obtener token de autenticación
    const loginRes = await request(app.getHttpServer())
      .post("/auth/login")
      .send({
        username: "uploadtestuser",
        password: "testpass123",
      });

    authToken = loginRes.body.access_token;
  });

  afterEach(async () => {
    // Limpiar datos de prueba
    try {
      await userRepository.delete({ username: "uploadtestuser" });
    } catch (error) {
      // Ignorar errores en limpieza
    }
  });

  describe("POST /upload/person - Upload de foto de persona", () => {
    it("should successfully upload a person image with valid auth", async () => {
      // Crear imagen de prueba simulada (1x1 pixel PNG)
      const pngBuffer = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00,
        0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0x99, 0x63, 0xf8, 0x0f, 0x00, 0x00,
        0x01, 0x01, 0x01, 0x00, 0x18, 0xdd, 0x8d, 0xb4, 0x00, 0x00, 0x00, 0x00,
        0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
      ]);

      const response = await request(app.getHttpServer())
        .post("/upload/person")
        .set("Authorization", `Bearer ${authToken}`)
        .attach("file", pngBuffer, "test-image.png");

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty("url");
      expect(response.body).toHaveProperty("publicId");
      expect(response.body).toHaveProperty("thumbnailUrl");
    });

    it("should reject upload without authentication", async () => {
      const pngBuffer = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00,
        0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0x99, 0x63, 0xf8, 0x0f, 0x00, 0x00,
        0x01, 0x01, 0x01, 0x00, 0x18, 0xdd, 0x8d, 0xb4, 0x00, 0x00, 0x00, 0x00,
        0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
      ]);

      const response = await request(app.getHttpServer())
        .post("/upload/person")
        .attach("file", pngBuffer, "test-image.png");

      expect(response.status).toBe(401);
    });

    it("should reject upload without file", async () => {
      const response = await request(app.getHttpServer())
        .post("/upload/person")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("archivo");
    });
  });

  describe("POST /upload/resource - Upload de imagen de recurso", () => {
    it("should successfully upload a resource image", async () => {
      const pngBuffer = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00,
        0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0x99, 0x63, 0xf8, 0x0f, 0x00, 0x00,
        0x01, 0x01, 0x01, 0x00, 0x18, 0xdd, 0x8d, 0xb4, 0x00, 0x00, 0x00, 0x00,
        0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
      ]);

      const response = await request(app.getHttpServer())
        .post("/upload/resource")
        .set("Authorization", `Bearer ${authToken}`)
        .attach("file", pngBuffer, "resource.png");

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty("url");
      expect(response.body).toHaveProperty("publicId");
      expect(response.body).toHaveProperty("thumbnailUrl");
    });
  });

  describe("POST /upload/camp - Upload de imagen de campamento", () => {
    it("should successfully upload a camp image", async () => {
      const pngBuffer = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00,
        0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0x99, 0x63, 0xf8, 0x0f, 0x00, 0x00,
        0x01, 0x01, 0x01, 0x00, 0x18, 0xdd, 0x8d, 0xb4, 0x00, 0x00, 0x00, 0x00,
        0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
      ]);

      const response = await request(app.getHttpServer())
        .post("/upload/camp")
        .set("Authorization", `Bearer ${authToken}`)
        .attach("file", pngBuffer, "camp.png");

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty("url");
      expect(response.body).toHaveProperty("publicId");
      expect(response.body).toHaveProperty("thumbnailUrl");
    });
  });

  describe("POST /upload/avatar - Upload de avatar", () => {
    it("should successfully upload an avatar", async () => {
      const pngBuffer = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00,
        0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0x99, 0x63, 0xf8, 0x0f, 0x00, 0x00,
        0x01, 0x01, 0x01, 0x00, 0x18, 0xdd, 0x8d, 0xb4, 0x00, 0x00, 0x00, 0x00,
        0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
      ]);

      const response = await request(app.getHttpServer())
        .post("/upload/avatar")
        .set("Authorization", `Bearer ${authToken}`)
        .attach("file", pngBuffer, "avatar.png");

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty("url");
      expect(response.body).toHaveProperty("publicId");
      expect(response.body).toHaveProperty("thumbnailUrl");
    });
  });

  describe("POST /upload/badge - Upload de badge/medalla", () => {
    it("should successfully upload a badge", async () => {
      const pngBuffer = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00,
        0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0x99, 0x63, 0xf8, 0x0f, 0x00, 0x00,
        0x01, 0x01, 0x01, 0x00, 0x18, 0xdd, 0x8d, 0xb4, 0x00, 0x00, 0x00, 0x00,
        0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
      ]);

      const response = await request(app.getHttpServer())
        .post("/upload/badge")
        .set("Authorization", `Bearer ${authToken}`)
        .attach("file", pngBuffer, "badge.png");

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty("url");
      expect(response.body).toHaveProperty("publicId");
      expect(response.body).toHaveProperty("thumbnailUrl");
    });
  });

  describe("POST /upload/multiple - Upload múltiple de imágenes", () => {
    it("should successfully upload multiple images", async () => {
      const pngBuffer = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00,
        0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0x99, 0x63, 0xf8, 0x0f, 0x00, 0x00,
        0x01, 0x01, 0x01, 0x00, 0x18, 0xdd, 0x8d, 0xb4, 0x00, 0x00, 0x00, 0x00,
        0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
      ]);

      const response = await request(app.getHttpServer())
        .post("/upload/multiple")
        .set("Authorization", `Bearer ${authToken}`)
        .field("folder", "person")
        .attach("files", pngBuffer, "image1.png")
        .attach("files", pngBuffer, "image2.png");

      expect(response.status).toBe(201);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty("url");
      expect(response.body[0]).toHaveProperty("publicId");
    });

    it("should reject multiple upload without folder parameter", async () => {
      const pngBuffer = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00,
        0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0x99, 0x63, 0xf8, 0x0f, 0x00, 0x00,
        0x01, 0x01, 0x01, 0x00, 0x18, 0xdd, 0x8d, 0xb4, 0x00, 0x00, 0x00, 0x00,
        0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
      ]);

      const response = await request(app.getHttpServer())
        .post("/upload/multiple")
        .set("Authorization", `Bearer ${authToken}`)
        .attach("files", pngBuffer, "image1.png")
        .attach("files", pngBuffer, "image2.png");

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("carpeta");
    });

    it("should reject multiple upload without files", async () => {
      const response = await request(app.getHttpServer())
        .post("/upload/multiple")
        .set("Authorization", `Bearer ${authToken}`)
        .field("folder", "person");

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("archivos");
    });
  });

  describe("DELETE /upload/delete - Eliminar imagen", () => {
    it("should successfully delete an image", async () => {
      // Primero subir una imagen
      const pngBuffer = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00,
        0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0x99, 0x63, 0xf8, 0x0f, 0x00, 0x00,
        0x01, 0x01, 0x01, 0x00, 0x18, 0xdd, 0x8d, 0xb4, 0x00, 0x00, 0x00, 0x00,
        0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
      ]);

      const uploadRes = await request(app.getHttpServer())
        .post("/upload/person")
        .set("Authorization", `Bearer ${authToken}`)
        .attach("file", pngBuffer, "test-delete.png");

      expect(uploadRes.status).toBe(201);
      const publicId = uploadRes.body.publicId;

      // Ahora eliminar la imagen
      const deleteRes = await request(app.getHttpServer())
        .delete("/upload/delete")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ publicId });

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body).toHaveProperty("message");
    });

    it("should reject delete without publicId", async () => {
      const response = await request(app.getHttpServer())
        .delete("/upload/delete")
        .set("Authorization", `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("publicId");
    });

    it("should reject delete without authentication", async () => {
      const response = await request(app.getHttpServer())
        .delete("/upload/delete")
        .send({ publicId: "test-public-id" });

      expect(response.status).toBe(401);
    });
  });
});
