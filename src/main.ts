import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { json, urlencoded } from "express";
import type { Request, Response, NextFunction } from "express";
import helmet from "helmet";
import * as cookieParser from "cookie-parser";
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

  app.use(cookieParser());
  app.use(helmet());

  // Forzar UTF-8 en todas las respuestas JSON para que tildes y caracteres especiales lleguen correctamente
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    next();
  });

  app.useGlobalInterceptors(new SanitizeInterceptor());

  app.useWebSocketAdapter(new RedisIoAdapter(app));

  app.enableCors({
    origin: [
      "http://localhost:5173", // Para desarrollo local
      "https://doomsday-system-ui.vercel.app", // URL de producción en Vercel
    ],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
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
void bootstrap();
