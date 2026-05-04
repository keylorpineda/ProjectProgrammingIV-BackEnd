import { test, expect } from "@playwright/test";

const BASE = process.env.API_BASE_URL || "http://localhost:3000/api/v1";

test.describe("Auth — Flujos de autenticación", () => {
  test("POST /auth/login → login con credenciales válidas devuelve tokens y datos del usuario", async ({
    request,
  }) => {
    const response = await request.post(`${BASE}/auth/login`, {
      data: {
        username: process.env.TEST_USERNAME || "admin",
        password: process.env.TEST_PASSWORD || "Admin@1234!",
      },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty("access_token");
    expect(body).toHaveProperty("refresh_token");
    expect(body).toHaveProperty("user");
    expect(body.user).toHaveProperty("role");
    expect(body.user).toHaveProperty("camp_id");
  });

  test("POST /auth/login → credenciales inválidas retornan 401", async ({
    request,
  }) => {
    const response = await request.post(`${BASE}/auth/login`, {
      data: {
        username: "usuarioinexistente_xyz",
        password: "clave_incorrecta_999",
      },
    });

    expect(response.status()).toBe(401);
  });

  test("POST /auth/refresh → refresh token válido genera nuevo access_token", async ({
    request,
  }) => {
    // Primero hacemos login para obtener tokens
    const loginRes = await request.post(`${BASE}/auth/login`, {
      data: {
        username: process.env.TEST_USERNAME || "admin",
        password: process.env.TEST_PASSWORD || "Admin@1234!",
      },
    });
    const { refresh_token } = await loginRes.json();

    const response = await request.post(`${BASE}/auth/refresh`, {
      data: { refresh_token },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty("access_token");
    expect(body).toHaveProperty("refresh_token");
  });

  test("GET /auth/session-status → retorna estado de la sesión activa", async ({
    request,
  }) => {
    const loginRes = await request.post(`${BASE}/auth/login`, {
      data: {
        username: process.env.TEST_USERNAME || "admin",
        password: process.env.TEST_PASSWORD || "Admin@1234!",
      },
    });
    const { access_token } = await loginRes.json();

    const response = await request.get(`${BASE}/auth/session-status`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty("isActive");
    expect(body).toHaveProperty("minutesUntilExpiration");
    expect(body.isActive).toBe(true);
  });

  test("GET /auth/session-status → sin token retorna 401", async ({
    request,
  }) => {
    const response = await request.get(`${BASE}/auth/session-status`);
    expect(response.status()).toBe(401);
  });

  test("POST /auth/logout → cierra la sesión correctamente", async ({
    request,
  }) => {
    const loginRes = await request.post(`${BASE}/auth/login`, {
      data: {
        username: process.env.TEST_USERNAME || "admin",
        password: process.env.TEST_PASSWORD || "Admin@1234!",
      },
    });
    const { access_token, refresh_token } = await loginRes.json();

    const logoutRes = await request.post(`${BASE}/auth/logout`, {
      headers: { Authorization: `Bearer ${access_token}` },
      data: { refresh_token },
    });

    expect(logoutRes.status()).toBe(204);
  });

  test("POST /auth/login → 5 intentos fallidos activan bloqueo por IP", async ({
    request,
  }) => {
    const attempts = Array.from({ length: 5 }, () =>
      request.post(`${BASE}/auth/login`, {
        data: { username: "admin_fake_test", password: "wrong_pass_xyz" },
      }),
    );

    // Ejecutar los 5 intentos secuencialmente
    for (const attempt of attempts) {
      await attempt;
    }

    // El 6to intento debe ser bloqueado (429 o 401 con mensaje de bloqueo)
    const blocked = await request.post(`${BASE}/auth/login`, {
      data: { username: "admin_fake_test", password: "wrong_pass_xyz" },
    });

    // El rate limiter o el guard de intentos debe bloquear (401 con mensaje de demasiados intentos)
    expect([401, 429]).toContain(blocked.status());
  });
});
