/**
 * E2E Tests — Dashboard, Campamentos y Hora del Servidor
 * Flujos críticos: Métricas por rol, multi-campamento, hora centralizada,
 * restricción de acceso por rol
 */
import { test, expect } from "@playwright/test";

const BASE = process.env.API_BASE_URL || "http://localhost:3000/api/v1";

async function getToken(request: any): Promise<string> {
  const res = await request.post(`${BASE}/auth/login`, {
    data: {
      username: process.env.TEST_USERNAME || "admin",
      password: process.env.TEST_PASSWORD || "Admin@1234!",
    },
  });
  return (await res.json()).access_token;
}

test.describe("Campamentos y Sistema Multi-campamento", () => {
  let token: string;
  let campId: number;

  test.beforeAll(async ({ request }) => {
    token = await getToken(request);
  });

  test("GET /camps → lista campamentos activos del sistema", async ({
    request,
  }) => {
    const response = await request.get(`${BASE}/camps`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);

    campId = body[0].id;
  });

  test("GET /camps/:id → detalle de campamento con métricas de inventario", async ({
    request,
  }) => {
    if (!campId) return;

    const response = await request.get(`${BASE}/camps/${campId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty("camp");
    expect(body).toHaveProperty("metrics");
    expect(body.metrics).toHaveProperty("inventorySummary");
  });

  test("GET /camps → datos separados por campamento (multi-empresa)", async ({
    request,
  }) => {
    const response = await request.get(`${BASE}/camps`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const camps = await response.json();
    // Cada campamento tiene su propio ID único
    const ids = camps.map((c: any) => c.id);
    const uniqueIds = [...new Set(ids)];
    expect(ids.length).toBe(uniqueIds.length);
  });
});

test.describe("Dashboard — Métricas por Rol", () => {
  let token: string;
  let campId: number;

  test.beforeAll(async ({ request }) => {
    token = await getToken(request);
    const campsRes = await request.get(`${BASE}/camps`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const camps = await campsRes.json();
    campId = Number(camps[0]?.id ?? 1);
  });

  test("GET /dashboard/metrics/:campId → admin recibe métricas completas (personas + bodega + traslados)", async ({
    request,
  }) => {
    const response = await request.get(`${BASE}/dashboard/${campId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty("campId");
    expect(body).toHaveProperty("role");
    expect(body).toHaveProperty("generatedAt");
    expect(body).toHaveProperty("camp");
    expect(body).toHaveProperty("transfers");

    // Admin debe ver métricas de bodega
    expect(body).toHaveProperty("warehouse");
    expect(body.camp).toHaveProperty("totalPeople");
    expect(body.camp).toHaveProperty("activeWorkers");
    expect(body.camp).toHaveProperty("emptyProfessions");
  });

  test("GET /dashboard/metrics/:campId → métricas incluyen exploraciones activas", async ({
    request,
  }) => {
    const response = await request.get(`${BASE}/dashboard/${campId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const body = await response.json();
    expect(body.camp).toHaveProperty("activeExplorations");
    expect(typeof body.camp.activeExplorations).toBe("number");
  });

  test("GET /dashboard/metrics/:campId → warehouse tiene alertas de recursos críticos", async ({
    request,
  }) => {
    const response = await request.get(`${BASE}/dashboard/${campId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const body = await response.json();
    if (body.warehouse) {
      expect(body.warehouse).toHaveProperty("criticalResources");
      expect(Array.isArray(body.warehouse.criticalResources)).toBe(true);
    }
  });
});

test.describe("Hora Centralizada del Servidor (Req. G4)", () => {
  test("GET /health/server-time → retorna la hora del servidor en UTC", async ({
    request,
  }) => {
    const response = await request.get(`${BASE}/health/server-time`);

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty("serverTime");
    expect(body).toHaveProperty("timestampUnix");
    expect(body).toHaveProperty("timezone");

    // La hora debe ser una fecha ISO válida
    const parsedTime = new Date(body.serverTime);
    expect(parsedTime.getTime()).not.toBeNaN();

    // Debe ser hora reciente (dentro de los últimos 10 segundos)
    const diffMs = Date.now() - parsedTime.getTime();
    expect(Math.abs(diffMs)).toBeLessThan(10000);
  });

  test("GET /health → health check general de la API", async ({ request }) => {
    const response = await request.get(`${BASE}/health`);

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty("status");
  });
});

test.describe("Control de Acceso por Roles", () => {
  let token: string;

  test.beforeAll(async ({ request }) => {
    token = await getToken(request);
  });

  test("Rutas protegidas sin token retornan 401", async ({ request }) => {
    const protectedRoutes = [
      `${BASE}/camps`,
      `${BASE}/resources?page=1`,
      `${BASE}/explorations`,
      `${BASE}/transfers/requests/camp/1`,
      `${BASE}/dashboard/1`,
    ];

    for (const route of protectedRoutes) {
      const response = await request.get(route);
      expect(response.status()).toBe(401);
    }
  });

  test("Token válido permite acceso a rutas autorizadas", async ({
    request,
  }) => {
    const response = await request.get(`${BASE}/camps`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(response.status()).toBe(200);
  });
});
