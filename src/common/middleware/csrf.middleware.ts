import type { NestMiddleware } from "@nestjs/common";
import { Injectable, ForbiddenException } from "@nestjs/common";
import type { Request, Response, NextFunction } from "express";

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  private readonly allowedOrigins: string[];

  constructor() {
    this.allowedOrigins = (process.env.CORS_ORIGIN ?? "http://localhost:3000")
      .split(",")
      .map((o) => o.trim());
    const port = process.env.PORT ?? 3000;
    this.allowedOrigins.push(`http://localhost:${port}`);
    this.allowedOrigins.push(`http://127.0.0.1:${port}`);
  }

  use(req: Request, _res: Response, next: NextFunction) {
    const mutatingMethods = ["POST", "PUT", "PATCH", "DELETE"];

    if (!mutatingMethods.includes(req.method)) {
      return next();
    }

    const origin = req.headers["origin"] as string | undefined;
    const referer = req.headers["referer"] as string | undefined;

    if (!origin && !referer) {
      return next();
    }

    let requestOrigin: string | null = null;

    if (origin) {
      requestOrigin = origin;
    } else if (referer) {
      try {
        requestOrigin = new URL(referer).origin;
      } catch {
        requestOrigin = null;
      }
    }

    if (requestOrigin && !this.allowedOrigins.includes(requestOrigin)) {
      throw new ForbiddenException("CSRF: solicitud desde origen no permitido");
    }

    next();
  }
}
