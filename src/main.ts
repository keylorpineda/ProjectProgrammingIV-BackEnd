import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { NestExpressApplication } from "@nestjs/platform-express";
import { json, urlencoded } from "express";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { SanitizeInterceptor } from "./common/interceptors/sanitize.interceptor";
import { RedisIoAdapter } from "./notifications/redis-io.adapter";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });

  const maxSize = process.env.MAX_REQUEST_SIZE ?? "1mb";
  app.use(json({ limit: maxSize }));
  app.use(urlencoded({ extended: true, limit: maxSize }));

  app.set("trust proxy", 1);

  app.use(helmet());

  app.useGlobalInterceptors(new SanitizeInterceptor());

  app.useWebSocketAdapter(new RedisIoAdapter(app));

  const allowedOrigins = (process.env.CORS_ORIGIN ?? "http://localhost:3000")
    .split(",")
    .map((o) => o.trim());
  app.enableCors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: false,
  });

  // API versionada v1 — requerimiento no funcional del enunciado
  app.setGlobalPrefix("api/v1");

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle("Gestión del Fin API")
    .setDescription(
      "API del sistema de gestión de campamentos - Apocalipsis Zombie",
    )
    .setVersion("1.0")
    .addBearerAuth()
    .build();
  SwaggerModule.setup(
    "api/v1/docs",
    app,
    SwaggerModule.createDocument(app, config),
  );

  const port = process.env.PORT ?? 3000;
  await app.listen(port, "0.0.0.0");

  const baseUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${port}`;

  console.log(`API corriendo en: ${baseUrl}/api/v1`);
  console.log(`Swagger docs:     ${baseUrl}/api/v1/docs`);
}
bootstrap();
