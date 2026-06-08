import { Controller, Get } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { Public } from "../auth/decorators/public.decorator";
import { HealthService } from "./health.service";

@ApiTags("Health")
@Controller("health")
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: "Health check endpoint - Verifica que la API esta activa",
  })
  @ApiResponse({ status: 200, description: "API funcionando correctamente" })
  check() {
    return this.healthService.getServerInfo();
  }

  @Public()
  @Get("server-time")
  @ApiOperation({
    summary: "Obtener hora del servidor",
    description:
      "Retorna la hora actual del servidor. Esta hora debe usarse para todos los procesos cr�ticos del sistema (producci�n diaria, exploraciones, transferencias, etc.)",
  })
  @ApiResponse({
    status: 200,
    description: "Hora del servidor",
    schema: {
      example: {
        serverTime: "2026-03-11T10:30:45.123Z",
        timestampUnix: 1773235845,
        timezone: "UTC",
      },
    },
  })
  getServerTime() {
    const now = this.healthService.getServerTime();
    return {
      serverTime: now.toISOString(),
      timestampUnix: Math.floor(now.getTime() / 1000),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  }

  @Public()
  @Get("shutdown")
  @ApiOperation({ summary: "Graceful shutdown for coverage generation" })
  shutdown() {
    if (process.env.NODE_ENV !== "production") {
      setTimeout(() => process.exit(0), 500);
      return { status: "shutting down" };
    }
    return { status: "ignored in production" };
  }
}
