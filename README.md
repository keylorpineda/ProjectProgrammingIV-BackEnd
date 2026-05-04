<div align="center">
  <img src="https://img.shields.io/badge/nestjs-E0234E?style=for-the-badge&logo=nestjs&logoColor=white" alt="NestJS" />
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Jest-C21325?style=for-the-badge&logo=jest&logoColor=white" alt="Jest" />
  <img src="https://img.shields.io/badge/Playwright-2EAD33?style=for-the-badge&logo=playwright&logoColor=white" alt="Playwright" />
  <img src="https://img.shields.io/badge/Deployed%20on-Render-46E3B7?style=for-the-badge&logo=render&logoColor=white" alt="Render" />
</div>

<h1 align="center">⚙️ Doomsday System API (Gestión del Fin)</h1>

<p align="center">
  <strong>The core backend engine powering the Doomsday System.</strong>
  <br />
  A robust, enterprise-grade RESTful API built with NestJS to manage critical resources, personnel, and communications between outposts.
</p>

<p align="center">
  🌐 <strong>Production API:</strong> <a href="https://doomsday-system-api.onrender.com/api/v1">https://doomsday-system-api.onrender.com/api/v1</a>
</p>

---

## 📖 Overview

The **Doomsday System API** is the foundational backend infrastructure for the *Gestión del fin* ecosystem. It handles all business logic, data persistence, and inter-camp communication strategies safely and reliably.

Built upon the powerful **NestJS** framework, this backend leverages decorators, dependency injection, and heavy TypeScript typing to ensure a scalable and strictly validated data flow.

## ✨ Key Features

- **🔐 Enterprise Security:** Secure JWT-based authentication with properly managed environment configurations (no hardcoded credentials).
- **🏕️ Camp Resource Orchestration:** Endpoints dedicated to tracking, allocating, and updating physical and human resources across multiple camp instances.
- **📡 Inter-Camp Transfers:** Facilitates resource and personnel transfers between distinct geographical nodes with a dual-approval flow.
- **🗺️ Explorations:** Full lifecycle management of scouting missions — scheduling, dispatch, and return with found resources.
- **🤖 AI Admissions:** Automatic candidate evaluation via integrated AI microservice with human review override.
- **🚦 API Standardization:** All endpoints standardized under `/api/v1` with clean RESTful architecture.
- **🛡️ Strict Validation:** Complete Request/Response schema validation using DTOs and `class-validator`.
- **🧪 Comprehensive Testing:** 724 unit tests (Jest) + 44 E2E tests (Playwright) covering all critical flows.

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| Framework | [NestJS](https://nestjs.com/) (Node.js) |
| Language | [TypeScript](https://www.typescriptlang.org/) |
| Database | PostgreSQL (via TypeORM) |
| Unit Testing | [Jest](https://jestjs.io/) + ts-jest |
| E2E Testing | [Playwright](https://playwright.dev/) (API mode) |
| Validation | class-validator & class-transformer |
| Auth | JWT (Passport) |
| Deployment | [Render](https://render.com/) |

---

## 🚀 Getting Started

### Prerequisites

- Node.js v18+
- npm v9+
- PostgreSQL instance (or use the shared Supabase DB)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/your-username/doomsday-system-api.git
cd doomsday-system-api

# 2. Install dependencies
npm install
```

### Configure Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

```env
# ── App ──────────────────────────────────────────────────────────
PORT=3000
NODE_ENV=development

# ── Database (PostgreSQL) ─────────────────────────────────────────
DB_HOST=your_db_host
DB_PORT=5432
DB_USER=your_db_user
DB_PASS=your_db_password
DB_NAME=your_db_name

# ── JWT ───────────────────────────────────────────────────────────
JWT_SECRET=your_super_secret_key_min_32_chars
JWT_EXPIRES_IN=20m

# ── Rate Limiting ─────────────────────────────────────────────────
THROTTLE_TTL=1000
THROTTLE_LIMIT=1000

# ── CORS ──────────────────────────────────────────────────────────
CORS_ORIGIN=http://localhost:3000,http://localhost:5173

# ── Request Size ──────────────────────────────────────────────────
MAX_REQUEST_SIZE=1mb

# ── Cloudinary (image storage) ────────────────────────────────────
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# ── E2E Tests (Playwright) ────────────────────────────────────────
API_BASE_URL=http://localhost:3000/api/v1
TEST_USERNAME=admin
TEST_PASSWORD=YourAdminPassword
```

### Start Development Server

```bash
npm run start:dev
```

> Server starts at `http://localhost:3000/api/v1`

---

## 🧪 Testing

### 📋 Quick Reference

| Comando | Descripción |
|---|---|
| `npm run test` | Pruebas unitarias (Jest) — 724 tests |
| `npm run test:cov` | Pruebas unitarias con cobertura |
| `npm run test:playwright` | E2E contra servidor local (`localhost:3000`) |
| `npm run test:playwright:ui` | E2E con interfaz gráfica de Playwright |
| `npm run test:playwright:report` | Abre el último reporte HTML |

---

### 🔬 Pruebas Unitarias (Jest)

Ejecuta todos los módulos `.spec.ts` dentro de `src/`. No requiere servidor activo ni base de datos.

```bash
npm run test
```

**Con reporte de cobertura:**

```bash
npm run test:cov
```

**Resultado esperado:**
```
Test Suites: 63 passed, 63 total
Tests:       724 passed, 724 total
Time:        ~18s
```

---

### 🎭 Pruebas E2E (Playwright)

Los tests E2E validan los flujos HTTP completos contra la API. Están ubicados en `e2e-playwright/` y cubren:

| Archivo | Flujos |
|---|---|
| `auth.spec.ts` | Login, refresh token, session status, 401 sin token |
| `dashboard-camps.spec.ts` | CRUD campamentos, estadísticas del dashboard |
| `resources.spec.ts` | Inventario, movimientos (entradas/salidas), paginación |
| `transfers.spec.ts` | Solicitudes inter-campamento, doble aprobación, llegada |
| `explorations.spec.ts` | Creación, despacho, retorno con recursos encontrados |
| `users.spec.ts` | Admisión IA, revisión humana, cambio de estado, reasignaciones |

#### ▶️ Opción A — Contra el servidor de Render (Producción)

> ✅ **Recomendado.** No requiere servidor local ni base de datos.

**PowerShell:**
```powershell
$env:API_BASE_URL="https://doomsday-system-api.onrender.com/api/v1"; $env:TEST_USERNAME="admin"; $env:TEST_PASSWORD="Admin@1234!"; npm run test:playwright
```

**Bash / macOS / Linux:**
```bash
API_BASE_URL=https://doomsday-system-api.onrender.com/api/v1 TEST_USERNAME=admin TEST_PASSWORD="Admin@1234!" npm run test:playwright
```

**Resultado esperado:**
```
Running 44 tests using 1 worker
  44 passed (~58s)
```

#### ▶️ Opción B — Contra servidor local

> Requiere tener el servidor corriendo localmente con la base de datos configurada.

**Paso 1 — Asegúrate de que tu `.env` tiene esto:**
```env
API_BASE_URL=http://localhost:3000/api/v1
TEST_USERNAME=admin
TEST_PASSWORD=Admin@1234!
```

**Paso 2 — Levanta el servidor (en una terminal):**
```bash
npm run start:dev
```
> Espera hasta ver: `Nest application successfully started`

**Paso 3 — Ejecuta los tests (en otra terminal):**

*PowerShell:*
```powershell
$env:API_BASE_URL="http://localhost:3000/api/v1"; $env:TEST_USERNAME="admin"; $env:TEST_PASSWORD="Admin@1234!"; npm run test:playwright
```

*Bash / macOS / Linux:*
```bash
API_BASE_URL=http://localhost:3000/api/v1 TEST_USERNAME=admin TEST_PASSWORD="Admin@1234!" npm run test:playwright
```

*O simplemente (si ya configuraste el `.env`):*
```bash
npm run test:playwright
```

#### ▶️ Ejecutar un spec individual

```powershell
# PowerShell — contra Render, solo transfers
$env:API_BASE_URL="https://doomsday-system-api.onrender.com/api/v1"; $env:TEST_USERNAME="admin"; $env:TEST_PASSWORD="Admin@1234!"; npm run test:playwright -- e2e-playwright/transfers.spec.ts --reporter=list
```

```bash
# Bash — contra Render, solo auth
API_BASE_URL=https://doomsday-system-api.onrender.com/api/v1 TEST_USERNAME=admin TEST_PASSWORD="Admin@1234!" npm run test:playwright -- e2e-playwright/auth.spec.ts --reporter=list
```

#### ▶️ Modo UI interactivo

```bash
npm run test:playwright:ui
```

> Abre el explorador visual de Playwright para depurar tests paso a paso.

#### ▶️ Ver reporte HTML del último run

```bash
npm run test:playwright:report
```

---

### ⚙️ Variables de entorno para los tests E2E

| Variable | Descripción | Ejemplo local | Ejemplo Render |
|---|---|---|---|
| `API_BASE_URL` | Base URL de la API | `http://localhost:3000/api/v1` | `https://doomsday-system-api.onrender.com/api/v1` |
| `TEST_USERNAME` | Usuario admin para auth | `admin` | `admin` |
| `TEST_PASSWORD` | Contraseña del usuario admin | *(ver con el equipo)* | *(ver con el equipo)* |

> 💡 **Alternativa rápida:** Agrega estas líneas a tu `.env` para no pasar las variables en cada ejecución:
> ```env
> API_BASE_URL=https://doomsday-system-api.onrender.com/api/v1
> TEST_USERNAME=admin
> TEST_PASSWORD=Admin@1234!
> ```
> Y luego simplemente corre: `npm run test:playwright`

---

## 📂 Architecture Overview

```text
src/
 ├── auth/           # JWT authentication, guards, strategies
 ├── camps/          # Camp management and dashboard stats
 ├── explorations/   # Scouting mission lifecycle
 ├── health/         # Health check endpoint
 ├── resources/      # Inventory tracking and movements
 ├── transfers/      # Inter-camp transfer requests and approvals
 ├── users/          # Personnel management and AI admissions
 ├── common/         # Global filters, interceptors, decorators
 ├── main.ts         # Bootstrap and global config
 └── app.module.ts   # Root module

e2e-playwright/
 ├── auth.spec.ts
 ├── dashboard-camps.spec.ts
 ├── explorations.spec.ts
 ├── resources.spec.ts
 ├── transfers.spec.ts
 └── users.spec.ts
```

---

## 📄 License

This project is licensed under the MIT License.
