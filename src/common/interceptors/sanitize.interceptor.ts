import type {
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Injectable } from "@nestjs/common";
import { filterXSS } from "xss";

@Injectable()
export class SanitizeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest();

    if (request.body) {
      request.body = this.sanitize(request.body);
    }

    if (request.query) {
      request.query = this.sanitize(request.query);
    }

    return next.handle();
  }

  private sanitize(value: unknown): unknown {
    if (typeof value === "string") {
      return filterXSS(value, { whiteList: {}, stripIgnoreTag: true });
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.sanitize(item));
    }

    if (value !== null && typeof value === "object") {
      const result: Record<string, unknown> = {};
      for (const key of Object.keys(value as object)) {
        result[key] = this.sanitize((value as Record<string, unknown>)[key]);
      }
      return result;
    }

    return value;
  }
}
