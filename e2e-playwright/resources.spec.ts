/**
 * E2E Tests — Gestion de Recursos e Inventario
 * Flujos criticos: Inventario por campamento, alertas minimo, movimientos,
 * proceso diario automatico, ajuste de produccion
 */
import { test, expect } from "@playwright/test";

const BASE = process.env.API_BASE_URL || "http://localhost:3000/api/v1";

async function getToken(request: any, role = "admin"): Promise<string> {
  const res = await request.post(`${BASE}/auth/login`, {
    data: {
      username:
        process.env[`TEST_${role.toUpperCase()}_USERNAME`] ||
        process.env.TEST_USERNAME ||
        "admin",
      password:
        process.env[`TEST_${role.toUpperCase()}_PASSWORD`] ||
        process.env.TEST_PASSWORD ||
        "Admin@1234!",
    },
  });
  const body = await res.json();
  return body.access_token;
}

test.describe("Recursos — Inventario y Gestion de Bodega", () => {
  let token: string;
  let campId: number;
  let resourceId: number;

  test.beforeAll(async ({ request }) => {
    token = await getToken(request);
    const campsRes = await request.get(`${BASE}/camps`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const camps = await campsRes.json();
    campId = Number(camps[0]?.id ?? 1);
  });

  test("GET /resources → lista de recursos con paginacion", async ({
    request,
  }) => {
    const response = await request.get(`${BASE}/resources?page=1&limit=20`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty("data");
    expect(body).toHaveProperty("total");
    expect(Array.isArray(body.data)).toBe(true);

    if (body.data.length > 0) {
      resourceId = Number(body.data[0].id);
    }
  });

  test("GET /resources/inventory/:campId → inventario del campamento con stock actual", async ({
    request,
  }) => {
    const response = await request.get(
      `${BASE}/resources/inventory/${campId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);

    if (body.length > 0) {
      expect(body[0]).toHaveProperty("current_quantity");
      expect(body[0]).toHaveProperty("minimum_stock_required");
      expect(body[0]).toHaveProperty("alert_active");
    }
  });

  test("GET /resources/inventory/:campId/alerts → alertas cuando recurso baja del minimo", async ({
    request,
  }) => {
    const response = await request.get(
      `${BASE}/resources/inventory/${campId}/alerts`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
    // Si hay alertas, cada una debe tener la info necesaria
    if (body.length > 0) {
      expect(body[0]).toHaveProperty("alert_active");
      expect(body[0].alert_active).toBe(true);
    }
  });

  test("POST /resources/inventory/:campId/movements → registro de movimiento de inventario", async ({
    request,
  }) => {
    if (!resourceId) return;

    const response = await request.post(
      `${BASE}/resources/movements`,
      {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          camp_id: campId,
          resource_id: resourceId,
          quantity: 50,
          type: "income",
          description: "Ingreso manual de prueba E2E",
        },
      },
    );

    expect([200, 201]).toContain(response.status());
    const body = await response.json();
    expect(body).toHaveProperty("movement");
    expect(body).toHaveProperty("inventory");
  });

  test("GET /resources/inventory/:campId/movements → historial de movimientos", async ({
    request,
  }) => {
    const response = await request.get(
      `${BASE}/resources/movements/${campId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test("POST /resources/camps/:campId/daily-process → ejecuta proceso diario manualmente", async ({
    request,
  }) => {
    const response = await request.post(
      `${BASE}/resources/daily-process/${campId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    expect([200, 201, 404]).toContain(response.status());
    if (response.status() !== 404) {
      const body = await response.json();
      expect(body).toHaveProperty("production");
      expect(body).toHaveProperty("consumption");
      expect(body).toHaveProperty("movementCount");
    }
  });

  test("PATCH /resources/inventory/:campId/resources/:resourceId → actualiza stock minimo y dispara alerta", async ({
    request,
  }) => {
    if (!resourceId) return;

    // Poner el minimo muy alto para forzar alerta
    const response = await request.patch(
      `${BASE}/resources/inventory/${campId}/${resourceId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          minimum_stock_required: 999999,
        },
      },
    );

    expect([200, 201]).toContain(response.status());

    // Verificar que la alerta se activa
    const alertsRes = await request.get(
      `${BASE}/resources/inventory/${campId}/alerts`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    const alerts = await alertsRes.json();
    const hasAlert = alerts.some(
      (a: any) => Number(a.resource_id) === resourceId,
    );
    expect(hasAlert).toBe(true);
  });
});
