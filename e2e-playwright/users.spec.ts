/**
 * E2E Tests — Gestion de Personas y Admision con IA
 * Flujos criticos: Evaluacion IA, revision humana, asignacion de profesion,
 * cambio de estado, asignaciones temporales
 */
import { test, expect } from "@playwright/test";

const BASE = process.env.API_BASE_URL || "http://localhost:3000/api/v1";

async function getAdminToken(request: any): Promise<string> {
  const res = await request.post(`${BASE}/auth/login`, {
    data: {
      username: process.env.TEST_USERNAME || "admin",
      password: process.env.TEST_PASSWORD || "Admin@1234!",
    },
  });
  const body = await res.json();
  return body.access_token;
}

test.describe("Personas — Admision IA y Gestion Humana", () => {
  let token: string;
  let admissionId: number;
  let trackingCode: string;
  let explorerId: number;

  test.beforeAll(async ({ request }) => {
    token = await getAdminToken(request);
  });

  test("POST /ai/admissions/submit → envia candidato y recibe evaluacion IA con justificacion", async ({
    request,
  }) => {
    const campRes = await request.get(`${BASE}/camps`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const camps = await campRes.json();
    const campId = Number(camps[0]?.id ?? 1);

    const response = await request.post(`${BASE}/ai/admissions/submit`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        camp_id: campId,
        first_name: "Carlos",
        last_name: "Ramirez",
        last_name2: "Vega",
        age: 32,
        skills: ["medicine", "first aid", "surgery"],
        health_status: 85,
        physical_condition: 80,
        years_experience: 5,
        psychological_evaluation: 90,
        criminal_record: false,
        medical_conditions: [],
        personal_history: "Era medico en el hospital central antes del colapso.",
      },
    });

    if (response.status() !== 201) {
      console.log("Error status:", response.status());
      console.log("Error body:", await response.text());
    }
    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body).toHaveProperty("tracking_code");
    expect(body).toHaveProperty("score");
    expect(body).toHaveProperty("justification");
    expect(body).toHaveProperty("suggested_decision");
    expect(body.status).toBe("PENDING_REVIEW");

    admissionId = body.id;
    trackingCode = body.tracking_code;
  });

  test("GET /ai/admissions/:id → detalle con score y factores trazables", async ({
    request,
  }) => {
    if (!admissionId) return;

    const response = await request.get(`${BASE}/ai/admissions/${admissionId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty("justification");
    expect(body).toHaveProperty("raw_ai_response");
    expect(body.justification.length).toBeGreaterThan(20);
  });

  test("GET /ai/admissions/track/:code → seguimiento publico de admision", async ({
    request,
  }) => {
    if (!trackingCode) return;

    const response = await request.get(
      `${BASE}/ai/admissions/track/${trackingCode}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty("status");
    expect(body).toHaveProperty("tracking_code");
  });

  test("POST /ai/admissions/:id/review → humano puede aprobar o rechazar decision de IA", async ({
    request,
  }) => {
    if (!admissionId) return;

    const response = await request.post(
      `${BASE}/ai/admissions/${admissionId}/review`,
      {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          decision: "ACCEPTED",
          admin_notes:
            "Medico con buenas credenciales, necesario para el campamento",
        },
      },
    );

    console.log(await response.text()); expect([200, 201]).toContain(response.status());
  });

  test("GET /users/persons → lista de personas con paginacion", async ({
    request,
  }) => {
    const response = await request.get(
      `${BASE}/users/persons?page=1&limit=10`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty("data");
    expect(body).toHaveProperty("total");
    expect(body).toHaveProperty("page");
    expect(Array.isArray(body.data)).toBe(true);
    if (body.data.length > 0) explorerId = body.data[0].id;
  });

  test("PUT /users/persons/:id/status → cambia estado a SICK (enfermo)", async ({
    request,
  }) => {
    // Obtener primera persona disponible
    const personsRes = await request.get(
      `${BASE}/users/persons?page=1&limit=1`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    const { data } = await personsRes.json();
    if (!data || data.length === 0) return;

    const personId = data[0].id;
    const response = await request.put(
      `${BASE}/users/persons/${personId}/status`,
      {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          status: "sick",
          notes: "Fiebre alta diagnosticada por medico del campamento",
        },
      },
    );

    console.log(await response.text()); expect([200, 201]).toContain(response.status());
    const body = await response.json();
    expect(body.status).toBe("sick");
  });

  test("GET /users/professions/alerts/needing-workers → detecta profesiones con falta de trabajadores", async ({
    request,
  }) => {
    const response = await request.get(
      `${BASE}/users/professions/alerts/needing-workers`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test("POST /users/temporary-assignments → reasignacion temporal de profesion", async ({
    request,
  }) => {
    // Buscar una profesion para asignar
    const professionsRes = await request.get(`${BASE}/users/professions`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const professions = await professionsRes.json();
    const profId = professions[0]?.id ?? 1;

    // Buscar persona en estado active (no usar explorerId que puede estar 'sick')
    const personsRes = await request.get(
      `${BASE}/users/persons?page=1&limit=50`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const personsBody = await personsRes.json();
    const activePerson = personsBody.data?.find(
      (p: any) => p.status === "active" && p.userAccount !== null,
    );
    if (!activePerson) {
      console.log("No active persons found, skipping test");
      return;
    }

    const response = await request.post(`${BASE}/users/temporary-assignments`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        person_id: Number(activePerson.id),
        profession_temporary_id: Number(profId),
        reason: "Apoyo temporal por baja de personal",
        duration_days: 7,
      },
    });

    if (![200, 201].includes(response.status())) {
      console.log("Status:", response.status(), "Body:", await response.text());
    }
    expect([200, 201]).toContain(response.status());
  });
});
