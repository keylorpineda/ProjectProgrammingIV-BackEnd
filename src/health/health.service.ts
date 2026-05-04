import { Injectable } from "@nestjs/common";

@Injectable()
export class HealthService {
  /**
   * Obtiene la hora actual del servidor
   * Esta hora debe usarse para todos los procesos cr�ticos del sistema
   */
  getServerTime(): Date {
    return new Date();
  }

  /**
   * Obtiene informaci�n del servidor
   */
  getServerInfo() {
    const now = new Date();
    return {
      status: "ok",
      timestamp: now.toISOString(),
      timestampUnix: Math.floor(now.getTime() / 1000),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      uptime: process.uptime(),
      nodeVersion: process.version,
      environment: (process.env.NODE_ENV || "development").trim(),
    };
  }
}
