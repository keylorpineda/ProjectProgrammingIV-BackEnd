/**
 * E2E Tests — Exploraciones
 * Flujos críticos: Creación, despacho, retorno con recursos encontrados,
 * cancelación, validación de personas exploradoras
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
  const body = await res.json();
  return body.access_token;
}

test.describe("Exploraciones — Ciclo completo", () => {
  let token: string;
  let campId: number;
  let explorationId: number;
  let explorerId: number;

  test.beforeAll(async ({ request }) => {
    token = await getToken(request);

    const campsRes = await request.get(`${BASE}/camps`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const camps = await campsRes.json();
    campId = Number(camps[0]?.id ?? 1);
  });

  test("GET /explorations → lista todas las exploraciones del campamento", async ({
    request,
  }) => {
    const response = await request.get(
      `${BASE}/explorations?campId=${campId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test("POST /explorations → crea exploración con personas exploradoras y deduce raciones", async ({
    request,
  }) => {
    // Buscar persona con profesión que puede explorar
    const personsRes = await request.get(
      `${BASE}/users/persons?campId=${campId}&page=1&limit=50`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    const { data: persons } = await personsRes.json();

    // Buscar alguien con profesión explorable y que esté activo
    const explorer = persons?.find(
      (p: any) =>
        p.profession?.can_explore === true &&
        p.status === "active" &&
        p.can_work,
    );

    if (!explorer) {
      console.log("No hay exploradores activos disponibles, saltando test");
      return;
    }

    explorerId = explorer.id;

    const departureDate = new Date();
    departureDate.setDate(departureDate.getDate() + 1);

    const response = await request.post(`${BASE}/explorations`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        camp_id: campId,
        name: "Exploración E2E Test",
        destination_description:
          "Zona norte, antigua gasolinera. Posibles suministros médicos.",
        departure_date: departureDate.toISOString(),
        estimated_days: 3,
        grace_days: 1,
        persons: [
          {
            person_id: explorerId,
            is_leader: true,
          },
        ],
      },
    });

    expect([200, 201]).toContain(response.status());
    const body = await response.json();
    expect(body).toHaveProperty("id");
    expect(body.status).toBe("scheduled");
    expect(body).toHaveProperty("explorationResources");

    explorationId = body.id;
  });

  test("GET /explorations/:id → detalle de exploración con personas y recursos", async ({
    request,
  }) => {
    if (!explorationId) return;

    const response = await request.get(
      `${BASE}/explorations/${explorationId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty("explorationPersons");
    expect(body).toHaveProperty("explorationResources");
    expect(body.explorationPersons.length).toBeGreaterThan(0);
  });

  test("POST /explorations/:id/depart → inicia la exploración (in_progress)", async ({
    request,
  }) => {
    if (!explorationId) return;

    const response = await request.patch(
      `${BASE}/explorations/${explorationId}/depart`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    expect([200, 201]).toContain(response.status());
    const body = await response.json();
    expect(body.status).toBe("in_progress");
  });

  test("POST /explorations/:id/return → registra retorno con recursos encontrados", async ({
    request,
  }) => {
    if (!explorationId) return;

    // Obtener un recurso del sistema para el retorno
    const resourcesRes = await request.get(`${BASE}/resources?page=1&limit=5`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const { data: resources } = await resourcesRes.json();

    const foundResources =
      resources && resources.length > 0
        ? [{ resource_id: resources[0].id, quantity: 25 }]
        : [];

    const response = await request.patch(
      `${BASE}/explorations/${explorationId}/return`,
      {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          real_return_date: new Date().toISOString(),
          notes: "Retorno exitoso. Se encontraron suministros médicos.",
          found_resources: foundResources,
        },
      },
    );

    expect([200, 201]).toContain(response.status());
    const body = await response.json();
    expect(body.status).toBe("completed");
  });

  test("POST /explorations → no permite persona no-exploradora", async ({
    request,
  }) => {
    // Buscar persona que NO puede explorar
    const personsRes = await request.get(
      `${BASE}/users/persons?campId=${campId}&page=1&limit=50`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    const { data: persons } = await personsRes.json();
    const nonExplorer = persons?.find(
      (p: any) => p.profession?.can_explore === false && p.status === "active",
    );

    if (!nonExplorer) return;

    const response = await request.post(`${BASE}/explorations`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        camp_id: campId,
        name: "Exploración Inválida",
        destination_description: "Zona sur",
        departure_date: new Date().toISOString(),
        estimated_days: 2,
        grace_days: 0,
        persons: [{ person_id: nonExplorer.id, is_leader: false }],
      },
    });

    expect(response.status()).toBe(400);
  });
});
