# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: users.spec.ts >> Personas — Admisión IA y Gestión Humana >> POST /users/temporary-assignments → reasignación temporal de profesión
- Location: e2e-playwright\users.spec.ts:193:7

# Error details

```
Error: expect(received).toContain(expected) // indexOf

Expected value: 400
Received array: [200, 201]
```

# Test source

```ts
  113 | 
  114 |     const response = await request.post(
  115 |       `${BASE}/ai/admissions/${admissionId}/review`,
  116 |       {
  117 |         headers: { Authorization: `Bearer ${token}` },
  118 |         data: {
  119 |           decision: "ACCEPTED",
  120 |           admin_notes:
  121 |             "Medico con buenas credenciales, necesario para el campamento",
  122 |         },
  123 |       },
  124 |     );
  125 | 
  126 |     console.log(await response.text()); expect([200, 201]).toContain(response.status());
  127 |   });
  128 | 
  129 |   test("GET /users/persons → lista de personas con paginación", async ({
  130 |     request,
  131 |   }) => {
  132 |     const response = await request.get(
  133 |       `${BASE}/users/persons?page=1&limit=10`,
  134 |       {
  135 |         headers: { Authorization: `Bearer ${token}` },
  136 |       },
  137 |     );
  138 | 
  139 |     expect(response.status()).toBe(200);
  140 |     const body = await response.json();
  141 |     expect(body).toHaveProperty("data");
  142 |     expect(body).toHaveProperty("total");
  143 |     expect(body).toHaveProperty("page");
  144 |     expect(Array.isArray(body.data)).toBe(true);
  145 |     if (body.data.length > 0) explorerId = body.data[0].id;
  146 |   });
  147 | 
  148 |   test("PUT /users/persons/:id/status → cambia estado a SICK (enfermo)", async ({
  149 |     request,
  150 |   }) => {
  151 |     // Obtener primera persona disponible
  152 |     const personsRes = await request.get(
  153 |       `${BASE}/users/persons?page=1&limit=1`,
  154 |       {
  155 |         headers: { Authorization: `Bearer ${token}` },
  156 |       },
  157 |     );
  158 |     const { data } = await personsRes.json();
  159 |     if (!data || data.length === 0) return;
  160 | 
  161 |     const personId = data[0].id;
  162 |     const response = await request.put(
  163 |       `${BASE}/users/persons/${personId}/status`,
  164 |       {
  165 |         headers: { Authorization: `Bearer ${token}` },
  166 |         data: {
  167 |           status: "sick",
  168 |           notes: "Fiebre alta diagnosticada por medico del campamento",
  169 |         },
  170 |       },
  171 |     );
  172 | 
  173 |     console.log(await response.text()); expect([200, 201]).toContain(response.status());
  174 |     const body = await response.json();
  175 |     expect(body.status).toBe("sick");
  176 |   });
  177 | 
  178 |   test("GET /users/professions/alerts/needing-workers → detecta profesiones con falta de trabajadores", async ({
  179 |     request,
  180 |   }) => {
  181 |     const response = await request.get(
  182 |       `${BASE}/users/professions/alerts/needing-workers`,
  183 |       {
  184 |         headers: { Authorization: `Bearer ${token}` },
  185 |       },
  186 |     );
  187 | 
  188 |     expect(response.status()).toBe(200);
  189 |     const body = await response.json();
  190 |     expect(Array.isArray(body)).toBe(true);
  191 |   });
  192 | 
  193 |   test("POST /users/temporary-assignments → reasignación temporal de profesión", async ({
  194 |     request,
  195 |   }) => {
  196 |     // Buscar una profesión para asignar
  197 |     const professionsRes = await request.get(`${BASE}/users/professions`, {
  198 |       headers: { Authorization: `Bearer ${token}` },
  199 |     });
  200 |     const professions = await professionsRes.json();
  201 |     const profId = professions[0]?.id ?? 1;
  202 | 
  203 |     const response = await request.post(`${BASE}/users/temporary-assignments`, {
  204 |       headers: { Authorization: `Bearer ${token}` },
  205 |       data: {
  206 |         person_id: explorerId || 1,
  207 |         profession_temporary_id: profId,
  208 |         reason: "Apoyo temporal por baja de personal",
  209 |         duration_days: 7,
  210 |       },
  211 |     });
  212 | 
> 213 |     console.log(await response.text()); expect([200, 201]).toContain(response.status());
      |                                                            ^ Error: expect(received).toContain(expected) // indexOf
  214 |   });
  215 | });
  216 | 
```