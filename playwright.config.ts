import { defineConfig } from "@playwright/test";

/**
 * Playwright E2E Test Configuration
 * Proyecto: Gestión del Fin — Apocalipsis Zombie
 * Requerimiento no funcional: Pruebas E2E automáticas (enunciado)
 *
 * Para ejecutar: npm run test:playwright
 * Para ver reporte: npm run test:playwright:report
 */
export default defineConfig({
  testDir: "./e2e-playwright",
  fullyParallel: false, // Secuencial para evitar conflictos de BD en tests
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Un solo worker para garantizar orden de tests con estado compartido
  reporter: [["list"]],

  use: {
    baseURL: process.env.API_BASE_URL || "http://localhost:3000/api/v1",
    extraHTTPHeaders: {
      "Content-Type": "application/json",
    },
  },

  // No levantamos browser — solo API testing con request fixtures
  projects: [
    {
      name: "api-e2e",
      use: {},
    },
  ],
});
