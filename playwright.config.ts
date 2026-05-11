import { defineConfig } from "@playwright/test";

/**
 * Playwright E2E Test Configuration
 * Proyecto: Gestión del Fin — Apocalipsis Zombie
 * Requerimiento no funcional: Pruebas E2E automáticas (enunciado)
 *
 * Para ejecutar: npm run test:playwright
 * Para ver reporte: npm run test:playwright:report
 *
 * Modos de ejecución:
 *
 * 1. Contra servidor LOCAL (requiere Redis + BD corriendo):
 *      npm run test:playwright
 *    Playwright levanta el servidor NestJS automáticamente con `webServer`.
 *    Prerequisito: docker run -d -p 6379:6379 redis:alpine
 *
 * 2. Contra servidor REMOTO / Producción:
 *      API_BASE_URL=https://doomsday-system-api.onrender.com/api/v1 npm run test:playwright
 *    En este modo no se levanta ningún servidor local.
 */

const PROD_URL = "https://doomsday-system-api.onrender.com/api/v1";
const BASE_URL = process.env.API_BASE_URL ?? PROD_URL;

// Si ya se especificó una URL base externa, no levantar servidor local
const useExternalServer = !!process.env.API_BASE_URL;

export default defineConfig({
  testDir: "./e2e-playwright",
  fullyParallel: false, // Secuencial para evitar conflictos de BD en tests
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Un solo worker para garantizar orden de tests con estado compartido
  reporter: [["list"]],

  use: {
    baseURL: BASE_URL,
    extraHTTPHeaders: {
      "Content-Type": "application/json",
    },
  },

  /**
   * Levanta el servidor NestJS automáticamente antes de los tests E2E,
   * solo cuando se corre en modo local (sin API_BASE_URL definida).
   *
   * Si API_BASE_URL está definida (modo remoto/CI), este bloque se omite
   * y Playwright conecta directamente al servidor externo.
   *
   * Para levantar localmente necesitas Redis corriendo en localhost:6379:
   *   docker run -d -p 6379:6379 redis:alpine
   */
  webServer: useExternalServer
    ? undefined
    : {
        command: "npx ts-node -r tsconfig-paths/register src/main.ts",
        url: "http://localhost:3000/api/v1/health",
        reuseExistingServer: true,
        timeout: 90_000,
        stdout: "pipe",
        stderr: "pipe",
      },

  // No levantamos browser — solo API testing con request fixtures
  projects: [
    {
      name: "api-e2e",
      use: {},
    },
  ],
});
