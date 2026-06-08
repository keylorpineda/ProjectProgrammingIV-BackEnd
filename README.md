<div align="center">
  <img src="https://img.shields.io/badge/nestjs-E0234E?style=for-the-badge&logo=nestjs&logoColor=white" alt="NestJS" />
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Jest-C21325?style=for-the-badge&logo=jest&logoColor=white" alt="Jest" />
  <img src="https://img.shields.io/badge/Playwright-2EAD33?style=for-the-badge&logo=playwright&logoColor=white" alt="Playwright" />
  <img src="https://img.shields.io/badge/Deployed%20on-Render-46E3B7?style=for-the-badge&logo=render&logoColor=white" alt="Render" />
</div>

<br />

<div align="center">
  <a href="https://git.io/typing-svg"><img src="https://readme-typing-svg.herokuapp.com?font=Fira+Code&weight=600&size=40&pause=1000&color=E0234E&background=00000000&center=true&vCenter=true&width=800&height=80&lines=⚙️+Doomsday+System+API;Enterprise-grade+NestJS+Backend;Robust,+Scalable,+and+Secure" alt="Typing SVG" /></a>
</div>

<p align="center">
  <strong>The core backend engine powering the entire Doomsday System ecosystem.</strong>
  <br />
  A robust, enterprise-grade RESTful API built meticulously with NestJS to manage critical resources, coordinate survivor personnel, and strictly govern communications between outposts in a simulated post-apocalyptic world.
</p>

<div align="center">
  <img src="https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcWc2aHp1ZnpyaWVzMGpveXhzNndjYWc1bnN6dnkxaDB2ZmNwaTlzZyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/26tn33aiTi1jIGsD6/giphy.gif" alt="Server Matrix Animation" width="200" style="border-radius: 10px; box-shadow: 0 0 20px rgba(224, 35, 78, 0.4);" />
</div>

<p align="center">
  🌐 <strong>Production API Instance:</strong> <a href="https://doomsday-system-api.onrender.com/api/v1">https://doomsday-system-api.onrender.com/api/v1</a>
</p>

---

## 📖 Table of Contents

- [In-Depth Overview](#-in-depth-overview)
- [System Architecture & Data Design](#-system-architecture--data-design)
- [Comprehensive Features](#-comprehensive-features)
- [Core Technology Stack](#-core-technology-stack)
- [Getting Started & Local Setup](#-getting-started--local-setup)
- [Extensive Testing Methodology](#-extensive-testing-methodology)
- [Project Modularity (Folder Structure)](#-project-modularity-folder-structure)
- [Important Links](#-important-links)

---

## 📖 In-Depth Overview

The **Doomsday System API** acts as the central brain for the _Gestion del fin_ (Doomsday Management) project. In a survival scenario, data integrity is critical. This backend is responsible for enforcing strict business rules: ensuring that an outpost cannot transfer resources it does not possess, verifying that personnel have the correct permissions, and logging all inter-camp explorations.

We chose **NestJS** as our foundational framework. Unlike traditional Express.js applications which can quickly become disorganized as the codebase grows, NestJS provides an **opinionated, Angular-inspired architecture**. By leveraging Dependency Injection, custom Decorators, and modular encapsulation, this backend is highly scalable, incredibly easy to test, and self-documenting.

The entire system is strictly typed with **TypeScript**, meaning that from the database models up to the HTTP response payloads, the data shapes are guaranteed at compile-time. This eliminates countless runtime bugs and gives absolute confidence when scaling the application.

## 🏗️ System Architecture & Data Design

To ensure absolute technical transparency and aid developers in understanding the system, we rely on clear architectural diagrams.

### 🧩 System Architecture

The ecosystem relies on an interaction between the React Frontend, the NestJS Backend, our PostgreSQL database, and an external AI Service for candidate evaluations. The NestJS API acts as the secure gateway, validating all incoming JSON payloads before ever touching the database layer.

> _This diagram explains how the frontend talks to the NestJS API, which then securely handles the database queries via TypeORM and delegates complex evaluation logic to the AI service. The NestJS server acts as the absolute source of truth._

![System Architecture](docs/archdiagram.png)

### 📊 Relational Data Design (ERD)

Because we are managing complex relationships (e.g., Users belong to Camps, Explorations are launched from Camps and return Resources, Transfers move Resources between distinct Camps), a well-normalized relational database is mandatory. Our PostgreSQL database handles these foreign-key constraints gracefully, guaranteeing data integrity.

- 🔗 **Interactive Live Diagram:** [dbdiagram.io - Doomsday System Database](https://dbdiagram.io/d/6893dfbedd90d17865cbf822)

![Database Diagram](docs/bddiagram.png)
_(Click the link above to view live, zoomable, detailed entity relationships)_

---

## ✨ Comprehensive Features

This API handles much more than simple CRUD (Create, Read, Update, Delete). It features complex workflows specifically tailored for a multi-camp survival scenario:

- **🔐 Enterprise-Grade Security & JWT:**
  The system uses Passport-JWT strategies. Upon login, a token is issued. All protected endpoints utilize custom NestJS Guards to verify the token's signature, ensuring no hardcoded credentials exist. Additionally, to simulate tight security requirements of a military-grade outpost, sessions automatically logout after 20 minutes of inactivity.

- **🏕️ Camp Resource Orchestration:**
  Outposts are the core entities of the system. The API features dedicated, transaction-safe endpoints for tracking physical resources (food, water, medicine, weapons) and human personnel across multiple isolated camp instances. TypeORM transactions are used to prevent race conditions when updating critical inventory simultaneously.

- **📡 Inter-Camp Transfer Protocols:**
  Camp A cannot simply send resources to Camp B instantly. The API implements a **strict dual-approval workflow**. A transfer request is created at the origin, and it requires explicit approval from the destination camp administrator before the database transaction finally deducts the items from the origin and adds them to the destination.

- **🗺️ Exploration Lifecycle Management:**
  Camps can dispatch scouting missions to find resources. The API manages the entire lifecycle: scheduling the departure, tracking the mission status as 'IN PROGRESS', and upon return, automatically calculating and injecting the newly found scavenged resources directly into the camp's inventory logs.

- **🤖 AI Admissions & Human Review:**
  When new survivors seek entry to a camp, the API sends their profile to an integrated external AI microservice. The AI evaluates their survival skills and provides a transparent justification. However, the system requires a final Human Review by a high-ranking user to override or confirm the admission, keeping humans safely in control of automated decisions.

- **🛡️ Strict Payload Validation & Global Error Handling:**
  We use `class-validator` combined with Data Transfer Objects (DTOs). If a client sends a request missing required fields, or the data types are wrong (e.g., a string instead of a number for a resource quantity), the framework automatically intercepts the request. It throws a clean 400 Bad Request error with an explicit array of what failed, without ever executing the controller business logic.

## 🛠️ Core Technology Stack

| Layer            | Technology                                    | Purpose & Justification                                                                                                                      |
| ---------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Framework**    | [NestJS](https://nestjs.com/)                 | Provides a robust, structured architectural pattern via dependency injection, highly suitable for large teams and enterprise apps.           |
| **Language**     | [TypeScript](https://www.typescriptlang.org/) | Offers static typing, interfaces, and decorators which are fundamental to how NestJS operates and ensures type safety.                       |
| **Database ORM** | TypeORM                                       | Bridges the gap between our object-oriented TypeScript code and our relational PostgreSQL database tables.                                   |
| **Unit Testing** | [Jest](https://jestjs.io/)                    | Incredibly fast unit testing framework. We heavily mock our database repositories to test isolated business logic instantly.                 |
| **E2E Testing**  | [Playwright](https://playwright.dev/)         | Validates the complete flow from HTTP Request down to the Database state and back out to the HTTP Response, ensuring real-world reliability. |
| **Validation**   | class-validator                               | Uses decorators (e.g., `@IsString()`, `@Min(1)`) on our DTOs to automatically validate incoming JSON bodies globally.                        |

---

## 🚀 Getting Started & Local Setup

Follow these detailed instructions to get the backend running locally.

### Prerequisites

- **Node.js (v18+):** Required for engine compatibility.
- **PostgreSQL:** You need a running Postgres instance locally, or you can use a cloud-hosted URL (like the provided Supabase DB URL).

### Installation

```bash
# 1. Clone the repository to your local machine
git clone https://github.com/keylorpineda/ProjectProgrammingIV-BackEnd.git
cd ProjectProgrammingIV-BackEnd

# 2. Install all heavy dependencies
npm install
```

### Configure Environment Variables

The system relies heavily on environment variables for database connections and security secrets. We never commit these to Git to maintain security.

Copy the example template to create your active configuration file:

```bash
cp .env.example .env
```

_Inside `.env`, make sure to provide valid `DATABASE_URL` credentials, a secure string for `JWT_SECRET`, and any AI API keys if applicable._

### Start the Server

```bash
# Start the server in watch mode (auto-reloads on file changes)
npm run start:dev
```

---

## 🧪 Extensive Testing Methodology

We believe that a Doomsday System must be completely bulletproof. Therefore, the API is heavily tested at both the unit and end-to-end levels. Quality assurance is built into the core.

### 📋 Quick Reference Commands

| Command                      | Action                                                            |
| ---------------------------- | ----------------------------------------------------------------- |
| `npm run test`               | Executes Jest unit tests — **724 tests total**                    |
| `npm run test:cov`           | Executes unit tests and generates a detailed HTML coverage report |
| `npm run test:playwright`    | Runs full HTTP E2E tests against the defined `API_BASE_URL`       |
| `npm run test:playwright:ui` | Opens Playwright's UI Mode for visual test debugging              |

### 🔬 Unit Testing (Jest)

Unit tests focus purely on the business logic inside our Services (`.service.ts`). We use Jest to mock out the database repositories, ensuring these tests run in milliseconds without requiring an active database connection. This proves that our math, permission checks, and logic branches work flawlessly.

```bash
npm run test
```

**Expected Result Output:**

```
Test Suites: 63 passed, 63 total
Tests:       724 passed, 724 total
Time:        ~18s
```

### 🎭 End-to-End (E2E) Testing (Playwright)

Unlike unit tests, our E2E tests make real HTTP requests to the active server. These scripts (located in `e2e-playwright/`) test the actual integration of controllers, guards, and the database. They test complex scenarios like "Log in -> Create Camp -> Transfer Resource -> Verify Database State".

#### ▶️ Option A — Run Against Production Environment (Recommended)

This requires zero local setup. It points the tests directly at the live Render server to verify production health.

**PowerShell (Windows):**

```powershell
$env:API_BASE_URL="https://doomsday-system-api.onrender.com/api/v1"; $env:TEST_USERNAME="admin"; $env:TEST_PASSWORD="Admin@1234!"; npm run test:playwright
```

**Bash (macOS / Linux / WSL):**

```bash
API_BASE_URL=https://doomsday-system-api.onrender.com/api/v1 TEST_USERNAME=admin TEST_PASSWORD="Admin@1234!" npm run test:playwright
```

#### ▶️ Option B — Run Against Local Development Server

If you want to test changes you've made locally before deploying:

1. Edit your `.env` to ensure `API_BASE_URL=http://localhost:3000/api/v1`
2. Start the Nest server: `npm run start:dev`
3. In a new terminal tab, run: `npm run test:playwright`

---

## 📂 Project Modularity (Folder Structure)

NestJS strictly enforces modularity. Every major feature has its own folder containing a Module, Controller, Service, and DTOs. This means you can drop an entire feature folder into another project, and it mostly works out-of-the-box. It prevents "spaghetti code".

```text
src/
 ├── ai/             # Evaluates candidate survivors via external API integration.
 ├── auth/           # Handles user login, JWT generation, and defines authorization Guards.
 ├── camps/          # Outpost management, storing location and capacity data.
 ├── explorations/   # Manages the scheduling and outcomes of scouting missions.
 ├── health/         # Simple endpoints used by Render to ensure the server is alive.
 ├── resources/      # Inventory definitions and CRUD for food, water, medicine, etc.
 ├── transfers/      # The complex workflow for requesting and approving inter-camp shipments.
 ├── users/          # Survivor profiles, roles (Admin vs. User), and professions.
 ├── common/         # Globally shared infrastructure: exception filters, interceptors, and custom decorators.
 ├── main.ts         # The bootstrap file that initializes the Express app and binds global validation pipes.
 └── app.module.ts   # The root module that imports all feature modules.
```

---

## 🔗 Important Links

- 🖥️ **Frontend React Application:** [Doomsday System UI](https://github.com/keylorpineda/ProjectProgrammingIVProject-FrontEnd)
- 📖 **NestJS Official Documentation:** [NestJS Docs](https://docs.nestjs.com/)
- 📘 **TypeORM Documentation:** [TypeORM Docs](https://typeorm.io/)
- 📚 **Swagger Interactive API:** [Production Swagger Docs](https://doomsday-system-api.onrender.com/api/docs) _(Check the live API endpoints!)_

## 📄 License

This robust system is open-sourced and licensed under the MIT License.
