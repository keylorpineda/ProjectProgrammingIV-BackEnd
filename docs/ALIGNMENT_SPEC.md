# ALIGNMENT SPEC — "Gestión del Fin"

Purpose: align `doomsday-system-api` (NestJS) and `doomsday-system-ui` (React/Vite)
so the running code matches the **Master Documentation** (`MASTER_DOC.md`).
This file is the contract Claude Code must follow. The Master Doc describes the
**intended behavior**; this file defines the **canonical field/role/route contract**
and the **ordered execution plan**.

---

## 0. How to use this file

1. Put this file and the master documentation in the API repo as
   `docs/ALIGNMENT_SPEC.md` and `docs/MASTER_DOC.md` (and/or the UI repo).
2. Give Claude Code the **kickoff prompt** (bottom of this file).
3. Execute **one phase at a time**. After each phase: build, lint, run tests,
   report diffs, and STOP for human review before the next phase.

---

## 1. Global decisions (NON-NEGOTIABLE — apply everywhere)

### 1.1 Language
- All code identifiers, enum values, role strings, DB column names, comments,
  commit messages: **English**.
- **Spanish only** in user-facing UI strings (button labels, on-screen text).
- Do not leave mixed-language identifiers (no `gestor_recursos`, no `trabajador`
  as a code value).

### 1.2 Canonical role vocabulary (the ONLY allowed role strings)
| Role string (code/DB) | Meaning (enunciado) | UI label (Spanish) |
|---|---|---|
| `admin` | Administrador del sistema | "Administrador" |
| `worker` | Trabajador | "Trabajador" |
| `resource_manager` | Gestión de recursos | "Gestión de Recursos" |
| `travel_manager` | Encargado de viajes y comunicación | "Encargado de Viajes" |

- These four strings must be **identical** in: `role` seed data, every
  `@Roles(...)` decorator, the frontend route guards, and login routing.
- **Delete entirely**: `medic`, `superadmin`, `campleader`, `resident`,
  `gestor_recursos`, `encargado_viajes`, `trabajador`, `travel_comms`, `worker`-vs-other
  duplicates.
- Professions (recolector / aguatero / médico / etc.) live in the `profession`
  table. They are **NOT roles**. A `worker` has a profession; the role gates
  access, the profession drives daily production.

### 1.3 Contract authority & casing
- The **backend's serialized response is the source of truth** for field names.
  The DB and Master Doc are snake_case, so the API stays **snake_case**.
- The **frontend must mirror exactly what the backend emits** — same field names,
  same nesting, same arrays. No camelCase aliases on the frontend.
- Backend response field names may be changed **only** where the backend is
  internally inconsistent or wrong (see §1.4 and the bug list). Everything else
  on the frontend bends to the backend.

### 1.4 IDs and numeric types
- `bigint` primary keys / foreign keys serialize as **strings**. Type them as
  `string` on the frontend everywhere. Do not coerce IDs to `number`.
- `decimal(12,3)` columns (`current_quantity`, `minimum_stock_required`,
  `quantity`, `requested_quantity`, `daily_ration`, `base_production`,
  `latitude`, `longitude`) must return **`number`**. Add TypeORM column
  transformers on those columns so the API emits numbers, then type them as
  `number` on the frontend. (Localized backend change; fixes charts/sums/.toFixed.)

### 1.5 Guardrails
- Do NOT introduce a second axios client or a second type set. One client, one
  type module per repo.
- Do NOT delete or weaken existing Playwright E2E tests; update them to the new
  contract instead.
- Update Swagger decorators whenever a DTO changes.
- Update `seed.sql` whenever role/profession data changes.
- Keep the global `/api/v1` prefix. All clients hit `${VITE_API_URL}` which ends
  in `/api/v1`.

---

## 2. PHASE 0 — P0 fixes (system is non-functional without these)

### P0-1 — Unify role vocabulary
- `seed.sql`: insert exactly the four roles from §1.2 (English).
- Every controller `@Roles(...)`: use the four English strings.
- Frontend `WorkerGuard`, `Login` routing, any `RequireAdmin`: use the same four.
- Acceptance: searching the codebase for any deleted role string returns zero
  hits (except Spanish UI labels).

### P0-2 — `req.user` must carry the user id
- `jwt.strategy.ts` `validate()` must return `{ id, userId, username, role, camp_id }`
  (include `id` / `sub`).
- Audit every controller that reads `user.id` (`explorations`, `ai`, `users`
  temporary-assignment) — they must now receive a real id so audit columns
  (`user_create_id`, `reviewed_by_user_id`, approver) are populated, never null.
  This is required by the doc's `audit_log` ("quién movió recursos o personas").

### P0-3 — Login payload & JWT consistency (`camp_id`, snake_case)
- Login response body and JWT claims must BOTH use **`camp_id`** (snake_case).
  Remove the `campId` camelCase claim.
- `AuthUser` frontend type and every consumer (`Dashboard`, `Resources`,
  `Explorations`, `Transfers`, `People`) read `camp_id`. IDs typed as `string`.
- Role in token = the user's real role string from §1.2. Remove the `"unknown"`
  fallback or make routing handle it explicitly.

### P0-4 — Admission flow contract (the system's flagship requirement)
Make all four sub-contracts agree. Backend shape is canonical.

**Submit** `POST /ai/admissions/submit` — request body:
```
{ first_name, last_name, age, health_status, physical_condition,
  skills: string[], criminal_record: boolean, camp_id,
  photo_url?, id_card_url?, contact_email?, personal_history? }
```
- Frontend admission form must collect these. Map the old free-text
  "about_yourself" → `personal_history` (this is the text the Python NLP reads),
  "medical_info" → fold into `health_status` / `personal_history`.

**Admission record** (GET responses) — response shape:
```
{ id, camp_id, candidate_data: { first_name, last_name, age, health_status,
  physical_condition, skills, criminal_record, personal_history, contact_email,
  photo_url, id_card_url },
  score, status, suggested_decision, suggested_profession_id,
  justification, raw_ai_response, admin_notes, submission_date,
  final_human_decision }
```
- Frontend reads candidate fields from `candidate_data.*` (NOT top-level).
- The "Glass Box" panel renders `justification` / `raw_ai_response` (the
  per-rubric scoring JSON described in the doc), not a `glass_box_report` object.

**Review** `POST /ai/admissions/:id/review` — request body:
```
{ decision: 'accepted' | 'rejected', override_profession_id?: number, notes?: string }
```
- Standardize the decision enum to **lowercase** `'accepted' | 'rejected'` across
  backend DTO, entity status handling, and frontend. Drop the frontend's
  `override_reason`; use `override_profession_id` + optional `notes`.

**Create account from admission** `POST .../create-account-from-admission`:
```
{ username, email, password, role_id }
```
- `camp_id` is taken server-side from the admission/person, not sent by the client.
- Default role for a newly admitted survivor = `worker` (look up its `role_id`).
  Never send the literal string `"resident"`.

### P0-5 — One API client, correct base URL
- Delete the worker-specific axios client / `VITE_API_BASE_URL` / the hardcoded
  Cloud Run fallback. All worker calls use the same client and the `/api/v1`
  prefix as the rest of the app.

**End of Phase 0 → STOP, build, lint, run tests, report.**

---

## 3. PHASE 1 — P1 entity-field alignment (frontend mirrors backend)

Apply the §1.3 rule mechanically. Frontend types + reads change to match the
backend's actual serialized names:

- **Camp**: `active` (not `is_active`), `location_description` (not `location`).
  Remove `created_at/updated_at` reads unless the API actually sends them.
- **Person**: `first_name` + `last_name` (+ `last_name2`). Build display name in
  the UI from these. `camp_id` lives on the user account, not on `person`.
- **Exploration**: read `explorationPersons` (mirror the relation name the API
  emits) — not `persons`.
- **IntercampRequest / Transfer**: read `approvals` (array) — not `approval`.
  Timestamp field is `request_date` (mirror what the API sends).
- **Inventory**: read `alert_active` (not `is_below_minimum`) and the nested
  `resource` relation as the backend loads it. Pick ONE inventory shape — reconcile
  the admin and worker type files into a single shape that matches the backend.
- **Create-exploration**: resources items must send `{ resource_id, flow, quantity }`
  (the composite PK needs `flow`).
- **Dashboard**: `metrics.warehouse` can be `null` — add a null guard before
  `.criticalResources.map(...)` so new camps with no inventory don't crash.
- **Camp switch**: on changing camp, call `PATCH /auth/switch-camp`, then fully
  reload context and return to the start screen (enunciado Generales #2 / doc §5).

**End of Phase 1 → STOP, build, lint, run tests, report.**

---

## 4. PHASE 2 — Security & integrity (graded under "Seguridad")

- **P2-1** Exclude `password_hash` and `token_hash` from ALL responses. Use
  `select: false` on the columns OR `@Exclude()` + wire `ClassSerializerInterceptor`
  globally. Verify they no longer appear in any relation-loaded response
  (`/transfers/requests/:id`, `/resources/movements/:campId`, `/explorations/:id`).
- **P2-2** `MAX_LOGIN_ATTEMPTS` → a sane value (e.g. `5`). The doc's `login_attempt`
  table promises brute-force protection; 1000 disables it.
- **P2-3** Re-enable `RequireAdmin` on `/admin/*`. Remove any dev token bypass
  (`dev-admin-token`).
- **P2-4** Remove the fake `CampLeader` module/store (`@ts-nocheck`, localStorage
  `DOOMSDAY_SYS_*`). There is no `campleader` role in the doc; delete the route
  and its mock data so nothing disagrees with the real backend.
- **P2-5** CORS/CSRF for production: set `CORS_ORIGIN` to the deployed Vercel
  origin so the `CsrfMiddleware` doesn't 403 every mutation. Confirm auth travels
  as the `Authorization` header.
- **P2-6** Service methods must reload relations before returning
  (`createMovement` → reload user/camp/resource; `getInventoryByCamp` → load camp).
  Null-guard `AiService.trackAdmission` (`admission.camp?.name`) and
  `TransfersService.cancelRequest` (`user?.camp_id`) so they can't 500.

**End of Phase 2 → STOP, build, lint, run tests, report.**

---

## 5. PHASE 3 — Polish & requirement coverage (do last)

- Remove dead/speculative service functions that have no call sites, OR wire and
  correct them to this contract if a screen needs them.
- Replace `@IsString()` with `@IsEnum`/`@IsIn` on `ApprovalDto.status`,
  `CreateIntercampRequestDto.type`, exploration `flow`, inventory movement `type`.
- HTTP status hygiene: idempotent POSTs (`inventory/initialize`, `daily-process`)
  return 200; align DELETE responses with frontend `void` types.
- Frontend: verify the WebSocket client exists and consumes
  `NotificationsGateway` events (the backend emits on transfer creation; the doc
  promises real-time inter-camp notifications). If absent, add `socket.io-client`.
- Turn OFF demo/placeholder fallbacks (`VITE_DEMO_ADMISSIONS`, worker
  `placeholderData`) in any build used for the defense, so real backend regressions
  are visible, not masked.

---

## 6. Requirement coverage to VERIFY (not contract bugs — confirm these exist)

These are graded by the rubric and were claimed in the Master Doc. Confirm each is
real and runnable; report any that are missing:

- Playwright E2E suite runs and covers: login, admission end-to-end, transfer with
  double approval, expired-token rejection. (Doc claims 44 tests.)
- `/health/server-time` endpoint exists and the frontend uses server time for
  critical flows. (Centralized time — enunciado Generales #4.)
- Frontend deployed on **Vercel** specifically, repo public. (Enunciado requires
  Vercel for the frontend; doc mentions Render+Supabase for the API.)
- 20-minute Redis inactivity lock works end-to-end.
- Gamification (XP, levels, achievements) is wired to real actions, not cosmetic.

---

## 7. Acceptance checklist (run after all phases)

- [ ] Grep returns zero hits for: `campId`, `superadmin`, `campleader`, `resident`,
      `medic`, `gestor_recursos`, `encargado_viajes`, `travel_comms`,
      `VITE_API_BASE_URL`, `is_below_minimum`, `is_active`, `dev-admin-token`
      (outside Spanish UI labels).
- [ ] Login → every camp-scoped page resolves the active camp from `camp_id`.
- [ ] A non-admin user can perform their role's actions without a 403.
- [ ] Public admission submit → 2xx; admissions panel renders real candidate
      names/scores; Glass Box shows the justification; human can override.
- [ ] No response anywhere contains `password_hash` / `token_hash`.
- [ ] `npm run lint` and the TypeScript build pass on both repos with no new errors.
- [ ] Existing Playwright tests pass (after being updated to the new contract).

---

## 8. KICKOFF PROMPT (paste into Claude Code)

> You have both repos in this workspace. Read `docs/MASTER_DOC.md` (the intended
> behavior — source of truth) and `docs/ALIGNMENT_SPEC.md` (the canonical contract
> and ordered plan). The codebase is English; keep all identifiers, enum values,
> and role strings in English per §1.1–1.2.
>
> Execute **Phase 0 only** right now. Make the smallest changes that satisfy each
> P0 item. Do NOT rename backend response fields except where the spec explicitly
> says so (§1.3). When done: run the build, lint, and existing tests on both repos,
> give me a concise list of every file changed and why, flag anything that broke,
> and STOP. Do not start Phase 1 until I say go.
