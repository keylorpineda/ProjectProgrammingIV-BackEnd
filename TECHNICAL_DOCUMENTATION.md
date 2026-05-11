# 🧟 Gestión del Fin — Documentación Técnica

> **Proyecto Final · Programación IV**  
> API Backend de gestión de campamentos post-apocalípticos  
> 🌐 Producción: `https://doomsday-system-api.onrender.com/api/v1`  
> 📖 Swagger: `https://doomsday-system-api.onrender.com/api/v1/docs`

---

## Tabla de Contenidos

1. [Descripción del Proyecto](#1-descripción-del-proyecto)
2. [Stack Tecnológico y Por Qué Cada Herramienta](#2-stack-tecnológico-y-por-qué-cada-herramienta)
3. [Arquitectura General](#3-arquitectura-general)
4. [Base de Datos — Tablas y Relaciones](#4-base-de-datos--tablas-y-relaciones)
5. [Vistas SQL](#5-vistas-sql)
6. [Módulos y Endpoints](#6-módulos-y-endpoints)
7. [Capas de Seguridad](#7-capas-de-seguridad)
8. [Flujos de Información Importantes](#8-flujos-de-información-importantes)
9. [Inteligencia Artificial](#9-inteligencia-artificial)
10. [Gamificación](#10-gamificación)
11. [Cumplimiento de Requerimientos](#11-cumplimiento-de-requerimientos)
12. [Preguntas de Defensa y Respuestas](#12-preguntas-de-defensa-y-respuestas)

---

## 1. Descripción del Proyecto

**Gestión del Fin** es una API REST backend para administrar campamentos de supervivencia humana en un apocalipsis zombie. El sistema es **multi-campamento**: varios campamentos comparten la misma plataforma pero cada uno maneja sus propios datos de inventario, personas y operaciones.

**Funcionalidades principales:**
- Admisión de nuevas personas evaluada por Inteligencia Artificial con revisión humana
- Gestión de inventario con producción/consumo automático diario
- Exploraciones fuera del campamento con gestión de raciones
- Traslados de recursos y personas entre campamentos con doble aprobación
- Dashboard con métricas en tiempo real
- Notificaciones WebSocket cuando llega una solicitud de traslado

---

## 2. Stack Tecnológico y Por Qué Cada Herramienta

| Herramienta | Rol | Por qué se eligió |
|------------|-----|-------------------|
| **NestJS** | Framework backend principal | Arquitectura modular con inyección de dependencias. Escala bien para 14 módulos y 70+ endpoints sin volverse caótico como Express puro. Integración nativa con TypeORM, Passport, Swagger y WebSocket. |
| **TypeScript** | Lenguaje | Tipado estático detecta errores en compilación, no en producción. Los DTOs con `class-validator` definen el contrato de entrada con decoradores. |
| **PostgreSQL (Supabase)** | Base de datos | ACID para transacciones críticas (exploraciones, traslados). JOINs complejos entre 22 tablas. Soporte nativo de arrays (`achievements[]`) y JSONB. Supabase provee hosting gestionado con SSL. |
| **TypeORM** | ORM | Integración oficial con NestJS. Entidades como clases TypeScript con decoradores. QueryBuilder para consultas complejas. Soporte de `ViewEntity` para vistas SQL. |
| **Redis (ioredis)** | Cache, sesiones, cola, pub/sub | TTL nativo para timeout de inactividad (20 min). Caché del dashboard (5 min). BullMQ requiere Redis para la cola de jobs. Socket.IO necesita Redis para escalar a múltiples instancias. |
| **BullMQ** | Cola de trabajos | El proceso diario de recursos debe correr exactamente una vez aunque haya múltiples instancias del servidor. `@Cron` ejecuta en cada instancia (duplica el proceso). BullMQ garantiza ejecución única con Redis. |
| **Socket.IO + Redis Adapter** | WebSocket | Notificaciones en tiempo real cuando un campamento recibe una solicitud de traslado. El adaptador Redis permite escalar horizontalmente: una instancia puede notificar a clientes de otra instancia. |
| **JWT + Passport** | Autenticación | Tokens stateless que cualquier instancia puede validar sin consultar BD. Dual token: access (20 min) + refresh (7 días) con rotación de seguridad. |
| **bcrypt** | Hash de contraseñas | Hash con salt aleatoria y costo configurable. SHA-256 es rápido (malo para passwords). bcrypt es lento a propósito, haciendo ataques de diccionario impracticables. 12 rounds = ~250ms. |
| **Cloudinary** | Imágenes | CDN global, transformaciones on-the-fly (thumbnails, avatares circulares). El servidor Render puede reiniciarse perdiendo archivos locales; Cloudinary persiste. |
| **Helmet** | Headers HTTP de seguridad | Inyecta automáticamente `X-XSS-Protection`, `X-Frame-Options`, `Strict-Transport-Security`, `Content-Security-Policy`. Una línea de código, múltiples protecciones. |
| **xss** | Sanitización de inputs | Elimina/escapa HTML malicioso de todos los inputs antes de procesarlos. Previene ataques XSS que podrían inyectar scripts en datos persistidos. |
| **class-validator** | Validación de DTOs | Validación declarativa con decoradores (`@IsEmail`, `@Min`, `@IsEnum`). Con `whitelist: true` elimina campos no definidos en el DTO (previene mass assignment). |
| **Swagger** | Documentación | Generada automáticamente desde los decoradores del código: siempre actualizada. UI interactiva en `/api/v1/docs` para probar endpoints. |
| **Jest + ts-jest** | Tests unitarios | 728 tests, 63 suites. Integración nativa con NestJS (`TestingModule`). `ts-jest` transpila TypeScript sin compilación previa. |
| **Playwright** | Tests E2E | 44 tests contra la API real de producción (sin browser). Verifica que todos los módulos integran correctamente. |
| **Render** | Hosting | CI/CD automático desde GitHub, HTTPS gestionado, variables de entorno seguras. Capa gratuita suficiente para el proyecto. |

---

## 3. Arquitectura General

### Diagrama de capas

```
 CLIENTE (React / Postman)
         │ HTTPS
         ▼
 ┌─────────────────────────────────────┐
 │  main.ts — Bootstrap                │
 │  Helmet · CORS · body-parser        │
 │  trust proxy · WebSocket Adapter    │
 └────────────────┬────────────────────┘
                  │
 ┌────────────────▼────────────────────┐
 │  Pipeline de cada request:          │
 │  1. CsrfMiddleware                  │
 │  2. ThrottlerGuard (rate limit)     │
 │  3. JwtAuthGuard (Bearer token)     │
 │  4. SessionInactivityGuard (Redis)  │
 │  5. RolesGuard (RBAC)               │
 │  6. SessionActivityInterceptor      │
 │  7. SanitizeInterceptor (XSS)       │
 │  8. ValidationPipe (DTOs)           │
 │  9. Controller → Service → TypeORM  │
 └────────────────┬────────────────────┘
                  │
    ┌─────────────┴─────────────┐
    ▼                           ▼
 PostgreSQL                  Redis
 (Supabase)               (ioredis)
 22 tablas                Sesiones (TTL 20min)
 8 vistas SQL             Caché dashboard (5min)
                          BullMQ queue
                          Socket.IO pub/sub
                                │
                                ▼
                     Python / FastAPI
                     (Microservicio IA)
                     spaCy + reglas NLP
```

### Patrón de módulos NestJS

Cada módulo agrupa: `Controller` (recibe HTTP) → `Service` (lógica de negocio) → `Repository` (TypeORM, acceso a BD). Los módulos exportan sus servicios para que otros los importen. El módulo raíz `AppModule` registra los guards e interceptores globales.

```
AppModule
├── RedisModule (@Global)    ← REDIS_CLIENT disponible en toda la app
├── AuthModule               → exporta JwtModule, SessionActivityInterceptor
├── UsersModule              → exporta UsersService, ProfessionsService
├── CampsModule              → exporta CampsService
├── ResourcesModule          → exporta ResourcesService + BullMQ queue
├── ExplorationsModule       → importa ResourcesModule
├── TransfersModule          → importa NotificationsModule
├── AiModule                 → importa UsersModule
├── DashboardModule          → importa DatabaseModule + CacheManager Redis
├── DatabaseModule           → exporta 8 ViewEntities
├── NotificationsModule      → WebSocket Gateway + Redis adapter
├── UploadModule             → Cloudinary
└── HealthModule             → endpoints públicos
```

---

## 4. Base de Datos — Tablas y Relaciones

### Diagrama de relaciones principales

```
camp ──< user_account >── role
          │
          └── person >── profession
                │
                └── temporary_assignment
                │
                └── ai_admission

camp ──< inventory >── resource
camp ──< inventory_movement >── resource
camp ──< exploration >── exploration_person >── person
                     └── exploration_resource >── resource

camp ──< intercamp_request (origin/destination)
              └── approval
              └── request_resource_detail >── resource
              └── request_person_detail >── person

user_account ──< user_asset >── asset
audit_log → (user_account, camp) referencias
```

---

### Tabla `camp` — Campamentos

Entidad raíz del sistema multi-campamento. Todo dato de inventario, personas y operaciones lleva `camp_id`.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | bigint PK | Auto-incremental |
| `name` | text | Nombre del campamento |
| `location_description` | text | Descripción de ubicación |
| `latitude / longitude` | decimal | Coordenadas GPS |
| `max_capacity` | int | Máximo de personas (nullable) |
| `active` | bool | Soft delete |
| `foundation_date` | date | Fecha de fundación |
| `logo_url / logo_public_id` | text | Imagen en Cloudinary |

---

### Tabla `role` — Roles del sistema

Implementa RBAC. Centralizar roles en BD permite modificarlos sin redeployar.

| Nombre | Descripción |
|--------|-------------|
| `admin` | Acceso total, gestiona ingresos de personas |
| `trabajador` | Cambios de inventario autorizados |
| `gestor_recursos` | Traslados y recursos |
| `encargado_viajes` | Expediciones y negociaciones |
| `lider_campamento` | Variante de admin por campamento |
| `supervisor` | Supervisión general |

---

### Tabla `profession` — Profesiones

Define las capacidades productivas. La profesión determina cuánto produce un trabajador al día.

| Profesión | Food/día | Water/día | Puede Explorar | Mín. Req. |
|-----------|----------|-----------|---------------|-----------|
| Recolector | 10 | 0 | ✅ | 2 |
| Aguatero | 0 | 15 | ❌ | 2 |
| Explorador | 5 | 0 | ✅ | 1 |
| Guardia | 0 | 0 | ❌ | 2 |
| Médico | 0 | 0 | ❌ | 1 |
| Ingeniero | 0 | 5 | ❌ | 1 |
| Cocinero | 3 | 0 | ❌ | 1 |
| Almacenista | 0 | 0 | ❌ | 1 |
| Agricultor | 8 | 0 | ❌ | 1 |
| Constructor | 0 | 0 | ❌ | 1 |

Consumo base: **2 food/persona/día + 3 water/persona/día**.

---

### Tabla `person` — Personas del campamento

Entidad central del dominio. Representa a cada superviviente con su historia y estado.

| Columna | Descripción |
|---------|-------------|
| `identification_code` | Código `SURVIVOR-xxx` generado al aceptar la admisión |
| `status` | Estado actual (ver tabla abajo) |
| `can_work` | Si puede trabajar (se usa en el proceso diario) |
| `experience_level / experience_points` | Gamificación — progresión del superviviente |
| `expeditionsSurvived` | Contador de expediciones completadas |
| `achievements[]` | Array de logros (PostgreSQL nativo) |
| `ai_admission_result` | JSON con el resultado del proceso de admisión |

**Estados de una persona:**

| Status | Qué significa |
|--------|---------------|
| `active` | En el campamento, trabajando |
| `sick` | Enferma, no trabaja |
| `injured` | Herida, no trabaja |
| `deceased` | Fallecida, excluida de todas las cuentas |
| `exploring` | En expedición activa |
| `traveling` | En tránsito en traslado intercampamento |
| `resting / idle / out_of_camp` | Variantes de no disponible |

---

### Tabla `user_account` — Cuentas de usuario

**¿Por qué separar `person` de `user_account`?** Una persona puede existir en el sistema sin acceso al software (niños, ancianos). Una cuenta puede existir sin persona asociada (admin del sistema). Separa identidad de negocio de credenciales de acceso.

| Columna | Descripción |
|---------|-------------|
| `camp_id` | Campamento activo del usuario |
| `person_id` | OneToOne con persona (nullable) |
| `role_id` | Rol del usuario |
| `password_hash` | Hash bcrypt de la contraseña |
| `last_access` | Última vez que inició sesión |

---

### Tabla `session` — Sesiones activas

**¿Por qué existe si ya tienen Redis para sesiones?** Redis controla la inactividad en tiempo real (TTL). La tabla `session` es el historial persistente: permite saber cuántas sesiones tuvo un usuario, cuándo se cerraron y si fue por inactividad (`auto_logout=true`) o voluntario.

| Columna | Descripción |
|---------|-------------|
| `token_hash` | Hash bcrypt del refresh token (no en claro por seguridad) |
| `last_activity` | Última actividad registrada |
| `expires_at` | Expiración del refresh token (7 días) |
| `auto_logout` | `true` si cerró por inactividad |
| `is_active` | Si la sesión está activa |

---

### Tabla `login_attempt` — Intentos de login

Registra cada intento con IP, user-agent y razón de falla. Permite detectar ataques de fuerza bruta. Límite: 1000 fallos por IP en ventana de 15 minutos → 401 automático.

---

### Tabla `audit_log` — Auditoría

Registro inmutable de todas las acciones críticas. Guarda `old_value` y `new_value` en JSON para saber exactamente qué cambió, quién lo hizo y cuándo.

Acciones auditadas: movimientos de inventario, creación/cancelación de traslados, aprobaciones, exploraciones, admisiones IA.

---

### Tabla `resource` — Tipos de recursos

Catálogo centralizado: Food, Water, Hygiene, Defense, Medicine. Permite agregar nuevos tipos sin modificar código.

---

### Tabla `inventory` — Stock actual

Clave primaria compuesta `(camp_id, resource_id)` — garantiza que no puede haber dos registros del mismo recurso para el mismo campamento. La restricción está en la BD, no solo en código.

| Columna | Descripción |
|---------|-------------|
| `current_quantity` | Stock actual |
| `minimum_stock_required` | Umbral para disparar alerta |
| `alert_active` | `true` si `current < minimum` |

---

### Tabla `inventory_movement` — Historial de movimientos

Nunca se borra. Es el historial inmutable de todas las operaciones de inventario. Tipos de movimiento:

| Tipo | Cuándo se genera |
|------|-----------------|
| `income / outcome` | Movimiento manual |
| `daily_production` | Proceso diario (por trabajador) |
| `daily_consumption` | Proceso diario (por persona en el camp) |
| `transfer_in / transfer_out` | Traslado intercampamento |
| `exploration_in / exploration_out` | Al crear/completar una expedición |

---

### Tabla `daily_production` y `daily_consumption`

Permiten sobreescribir los valores por defecto de producción y consumo. Si no existe registro, se usa el valor de `PROFESSIONS_CONFIG` (código TypeScript). Esto es el patrón "override por configuración": valores inteligentes por defecto con posibilidad de personalización por campamento.

---

### Tabla `exploration` — Expediciones

Ciclo de vida: `scheduled` → `in_progress` → `completed` / `cancelled`.

| Columna | Descripción |
|---------|-------------|
| `estimated_days` | Días estimados de duración |
| `grace_days` | Días de gracia antes de declarar pérdida |
| `real_return_date` | Cuándo regresaron realmente |

Tablas relacionadas:
- `exploration_person`: personas de la expedición con `is_leader`
- `exploration_resource`: recursos con `flow` (in = encontrados, out = llevados)

---

### Tabla `intercamp_request` — Solicitudes de traslado

Estados del traslado: `pending` → `approved` → `in_transit` → `completed` (o `rejected` / `cancelled`).

Tablas relacionadas:
- `approval`: quién aprobó y cuándo (doble aprobación)
- `request_resource_detail`: qué recursos con cantidades solicitadas/aprobadas/recibidas
- `request_person_detail`: qué personas con `transfer_status`

---

### Tabla `ai_admission` — Evaluaciones IA

Registra todo el proceso de admisión con transparencia total.

| Columna | Descripción |
|---------|-------------|
| `tracking_code` | `ADM-2026-XXXXXX` para seguimiento público sin auth |
| `candidate_data` | JSON con los datos tal como los envió el candidato |
| `raw_ai_response` | JSON con evaluación NestJS + Python NLP + score combinado |
| `suggested_decision` | Lo que la IA recomienda |
| `final_human_decision` | Lo que el admin decidió (siempre prevalece) |

---

### Tabla `temporary_assignment` — Asignaciones temporales

Cuando una profesión queda sin el mínimo de trabajadores, se puede asignar temporalmente a personas de otra profesión. Guarda profesión origen, profesión temporal, fechas y razón.

---

### Tabla `asset` / `user_asset` — Gamificación

`asset` es el catálogo de badges disponibles. `user_asset` registra qué usuario tiene qué badge con `is_displayed` (el usuario elige cuáles mostrar en su perfil).

---

## 5. Vistas SQL

**¿Por qué vistas y no queries en el código?** Las vistas encapsulan consultas SQL complejas con múltiples JOINs y agregaciones. Son reutilizables por múltiples servicios, optimizables por PostgreSQL, y TypeORM las trata como entidades de solo lectura (`ViewEntity`) con el mismo API de repositorio que las tablas normales.

| Vista | Propósito | Usada por |
|-------|-----------|-----------|
| `vw_camp_population_summary` | Población, trabajadores activos, tasa de ocupación | Dashboard, IA |
| `vw_person_status_stats` | Conteo por estado (active, sick, etc.) | Dashboard, stats |
| `vw_person_profession_stats` | Conteo por profesión con activos/inactivos | Dashboard, alertas |
| `vw_inventory_status` | Inventario completo con nombre del recurso | Dashboard |
| `vw_inventory_alert` | Solo recursos con `alert_active = true` | Dashboard, alertas |
| `vw_transfer_camp_summary` | Resumen de traslados por campamento | Dashboard |
| `vw_exploration_summary` | Exploraciones con personas y recursos | Dashboard |
| `vw_active_temporary_assignment` | Asignaciones temporales activas | UsersService |

---

## 6. Módulos y Endpoints

### AuthModule — Autenticación

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/auth/login` | ❌ | Login con username/password |
| POST | `/auth/logout` | ✅ | Cerrar sesión |
| POST | `/auth/refresh` | ❌ | Renovar access token |
| GET | `/auth/session-status` | ✅ | Ver TTL restante de sesión |
| PATCH | `/auth/switch-camp` | ✅ | Cambiar campamento activo |

---

### CampsModule — Campamentos

| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| POST | `/camps` | admin | Crear campamento + inicializar inventario |
| GET | `/camps` | todos | Listar campamentos activos |
| GET | `/camps/:id` | todos | Detalle + métricas de inventario |
| PATCH | `/camps/:id` | admin | Actualizar |
| DELETE | `/camps/:id` | admin | Soft delete |

---

### UsersModule — Personas y Profesiones

| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| GET | `/users/persons` | admin, gestor, viajes | Listar con paginación |
| POST | `/users/persons` | admin | Crear persona |
| PUT | `/users/persons/:id/status` | admin, gestor | Cambiar estado (sick, injured…) |
| DELETE | `/users/persons/:id` | admin | Eliminar |
| GET | `/users/professions/alerts/needing-workers` | admin, gestor | Profesiones bajo mínimo |
| POST | `/users/temporary-assignments` | admin, gestor | Asignar temporalmente a otra profesión |
| GET | `/users/camp/:campId/balance` | admin, gestor, trabajador | Balance producción-consumo |
| GET | `/users/me/badges` | todos | Mis badges de gamificación |

---

### ResourcesModule — Inventario

| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| GET | `/resources/inventory/:campId` | admin, gestor, trabajador, viajes | Ver inventario |
| GET | `/resources/inventory/:campId/alerts` | admin, gestor | Recursos bajo mínimo |
| PATCH | `/resources/inventory/:campId/:resourceId` | admin, gestor | Actualizar mínimos/stock |
| POST | `/resources/movements` | admin, gestor, trabajador | Registrar movimiento manual |
| GET | `/resources/movements/:campId` | admin, gestor, trabajador | Historial |
| POST | `/resources/daily-process/:campId` | admin, gestor | Ejecutar proceso diario manualmente |

---

### ExplorationsModule — Expediciones

| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| POST | `/explorations` | admin, viajes | Crear expedición |
| GET | `/explorations` | admin, viajes, gestor | Listar |
| PATCH | `/explorations/:id/depart` | admin, viajes | Marcar como en curso |
| PATCH | `/explorations/:id/return` | admin, viajes | Registrar retorno + recursos encontrados |
| DELETE | `/explorations/:id` | admin, viajes | Cancelar (solo si está scheduled) |

---

### TransfersModule — Traslados Intercampamento

| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| POST | `/transfers/requests` | admin, gestor, viajes | Crear solicitud |
| GET | `/transfers/requests/camp/:campId` | admin, gestor, viajes | Solicitudes del campamento |
| PATCH | `/transfers/requests/:id/approval` | admin, gestor, viajes | Aprobar / rechazar |
| PATCH | `/transfers/requests/:id/arrive` | admin, gestor, viajes, trabajador | Registrar llegada |
| GET | `/transfers/statistics/:campId` | admin, gestor | Estadísticas |

---

### AiModule — Admisión con IA

| Método | Ruta | Auth | Roles | Descripción |
|--------|------|------|-------|-------------|
| POST | `/ai/admissions/submit` | ❌ | — | Enviar solicitud |
| GET | `/ai/admissions/track/:code` | ❌ | — | Seguimiento público |
| GET | `/ai/admissions/pending` | ✅ | admin, gestor | Ver pendientes |
| POST | `/ai/admissions/:id/review` | ✅ | admin | Revisar (aceptar/rechazar) |
| POST | `/ai/admissions/:id/create-account` | ✅ | admin | Crear cuenta de usuario |

---

### DashboardModule — Métricas

| Método | Ruta | Roles | Descripción |
|--------|------|-------|-------------|
| GET | `/dashboard/:campId` | admin, gestor | Métricas del campamento (caché 5min) |
| GET | `/dashboard/leaderboard` | admin, gestor | Top 10 por SurvivalScore |

---

### HealthModule — Heartbeat (públicos)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/health` | Estado de la API |
| GET | `/health/server-time` | Hora centralizada del servidor |

---

## 7. Capas de Seguridad

Cada request pasa por las siguientes capas **en este orden exacto**:

```
1. body-parser      → parsea JSON/urlencoded hasta 1MB
2. Helmet           → headers HTTP de seguridad automáticos
3. CsrfMiddleware   → valida Origin/Referer en POST/PUT/PATCH/DELETE
4. ThrottlerGuard   → rate limiting por IP (10 req/60s por defecto)
5. JwtAuthGuard     → valida firma + expiración del Bearer token
                      bypass si la ruta tiene @Public()
6. SessionInactivityGuard → redis.exists(session:userId)
                            si 0 → 401 (sesión expirada por inactividad)
7. RolesGuard       → user.role debe estar en @Roles([...]) del endpoint
8. SessionActivityInterceptor → redis.expire(session:userId, 1200)
                                 sessionRepo.update(last_activity)
9. SanitizeInterceptor → xss() en todo el body y query params
10. ValidationPipe  → class-validator sobre el DTO
11. Handler del controller
```

**¿Por qué este orden?** ThrottlerGuard va primero para bloquear IPs abusivas antes de hacer trabajo costoso (validar JWT requiere criptografía). JwtAuthGuard va antes que SessionInactivity porque necesitamos el `userId` del token para consultar Redis.

### Sistema de tokens JWT

- **Access token**: 20 minutos. Se envía en cada request (`Authorization: Bearer ...`).
- **Refresh token**: 7 días. Se usa solo para renovar el access token. Su hash bcrypt se guarda en la tabla `session`.
- **Rotación**: cada vez que se renueva, se genera un nuevo refresh token y el anterior queda inválido. Si alguien roba el refresh token, solo puede usarlo una vez antes de que el sistema lo invalide.

### Inactividad de sesión (20 minutos)

Al hacer login: `redis.setex("session:userId", 1200, "active")`. En cada request autenticado: `redis.expire("session:userId", 1200)` — reinicia el contador. Si el usuario no hace nada por 20 minutos, la key expira sola. El `SessionInactivityGuard` detecta que no existe y devuelve 401.

---

## 8. Flujos de Información Importantes

### Flujo de Login

```
POST /auth/login {username, password}
        │
        ├─ countRecentFailures(ip) → si ≥ 1000 en 15min → 401
        ├─ userRepo.findOne(username) → si no existe → 401
        ├─ bcrypt.compare(password, hash) → si no coincide → 401
        │
        ├─ Genera access_token (JWT 20min) + refresh_token (JWT 7d)
        ├─ Guarda session en BD: {user_id, bcrypt(refresh_token), expires_at}
        ├─ redis.setex("session:userId", 1200, "active")
        ├─ Registra login_attempt exitoso en BD
        └─ Responde: {access_token, refresh_token, user}
```

### Flujo del Proceso Diario de Recursos

```
Medianoche UTC → BullMQ ejecuta job "daily-resources"
        │
        ▼
Para cada campamento activo:
        │
        ├─ PRODUCCIÓN: por cada persona con (can_work=true, status=active)
        │   └─ Busca DailyProduction custom (camp, profesión, recurso)
        │   └─ Si no hay custom: usa PROFESSIONS_CONFIG (ej: Recolector produce 10 food)
        │   └─ createMovement({type: "daily_production", quantity: ...})
        │
        ├─ CONSUMO: cuenta personas en el camp (excluye deceased/exploring/traveling)
        │   └─ totalFood = personas × 2 (o custom DailyConsumption si existe)
        │   └─ totalWater = personas × 3
        │   └─ createMovement({type: "daily_consumption", quantity: ...})
        │
        └─ refreshAlertFlags: UPDATE inventory WHERE current < minimum → alert_active=true
```

### Flujo de una Exploración

```
1. POST /explorations → valida personas (can_explore, status=active, no en otra exploración)
   → calcula raciones (días × personas × consumo)
   → TRANSACCIÓN: guarda exploración + personas + descuenta recursos (exploration_out)
   → personas: status = "exploring"

2. PATCH /depart → status: "in_progress" → llama Python IA para análisis de riesgo

3. PATCH /return {recursos_encontrados} → TRANSACCIÓN:
   → personas: status = "active"
   → suma recursos encontrados al inventario (exploration_in)
   → status: "completed"
   → awardAchievements: +50 XP, sube nivel, agrega logros si aplica

4. DELETE (cancelar, solo si scheduled) → reintegra recursos → personas: "active"
```

### Flujo de Traslado Intercampamento

```
1. POST /transfers/requests → valida inventario origen suficiente
   → crea IntercampRequest (status: pending)
   → notifica al campamento destino por WebSocket

2. PATCH /approval (Camp Origen) → guarda Approval #1 → sigue pending

3. PATCH /approval (Camp Destino) → guarda Approval #2 → bothApproved = true
   → TransferExecutionService.departTransfer():
      * descuenta recursos del origen (transfer_out)
      * personas: status = "traveling"
      * descuenta raciones de viaje (travel_days × personas × consumo)
      * status: "in_transit"

4. PATCH /arrive → TransferExecutionService.arriveTransfer():
   → suma recursos al destino (transfer_in)
   → personas: status = "active", +XP, userAccount.camp_id = destino
   → status: "completed"
```

---

## 9. Inteligencia Artificial

### Filosofía: IA No Generativa (Caja de Cristal)

El sistema usa **reglas determinísticas explícitas**, no modelos de Machine Learning. Esto significa:
- La misma entrada siempre produce la misma salida
- Cada criterio evaluado es visible y auditable
- No hay archivos `.pkl` ni parámetros ocultos
- Se puede explicar exactamente por qué se tomó cada decisión

El enunciado exige que el proceso sea **transparente y justificable**. Un modelo ML no puede explicar sus decisiones de forma trazable.

### Dos componentes de evaluación

**Componente NestJS (60% del score final):**

*Reglas críticas — cortocircuitan la evaluación normal:*
- Condición médica contagiosa → REJECT automático
- Campamento al 95%+ de capacidad sin habilidades críticas → REJECT
- Déficit grave de comida y candidato sin habilidades productivas → REJECT
- Déficit grave y candidato CON la habilidad urgente → ACCEPT inmediato

*Score de 5 factores (si no aplica regla crítica):*

| Factor | Máx | Qué evalúa |
|--------|-----|-----------|
| Profession Need | 40 | Si el campamento necesita esa profesión |
| Skills | 25 | Cantidad y años de experiencia |
| Health | 15 | Promedio health_status + physical_condition |
| Resource Impact | 10 | Si produce recursos en déficit |
| Risk Assessment | 10 | Evaluación psicológica y antecedentes |

Decisión: ≥ 75 → RECOMMEND_ACCEPT · 50–74 → REQUIRES_REVIEW · < 50 → RECOMMEND_REJECT

---

**Componente Python/FastAPI (40% del score final):**

Microservicio separado que analiza el `personal_history` (texto libre) del candidato usando:
- **Keywords determinísticos**: listas de palabras de infección, engaño, trauma, habilidades
- **Regex**: patrones de evasión ("no sé", "no recuerdo", "tal vez")
- **spaCy `es_core_news_sm`**: modelo preentrenado de español para tokenización

8 criterios evaluados: riesgo biológico, salud física, edad, habilidades, honestidad narrativa, antecedentes, trauma psicológico, documentación.

Si detecta `infection_detected = true` → fuerza RECOMMEND_REJECT sin importar el score.

---

**Integración y graceful degradation:**

```
score_final = nestjs_score × 0.6 + python_nlp × 0.4

Si Python no responde (timeout 5s):
  score_final = nestjs_score × 1.0
  raw_ai_response.scoring_method = "nestjs_only (Python microservice unavailable)"
```

Si Python falla, el sistema NestJS sigue funcionando normalmente. Esto es **graceful degradation**: el fallo de un componente no bloquea el sistema.

---

**Human-in-the-Loop (Revisión Humana Obligatoria):**

La IA solo recomienda. El admin siempre tiene la última palabra:

```
IA sugiere → Admin revisa justificación → Admin decide → Sistema ejecuta

final_human_decision puede diferir de suggested_decision.
La diferencia queda registrada en admin_notes para auditoría.
```

---

## 10. Gamificación

### XP y Niveles

| Evento | XP Ganados |
|--------|-----------|
| Expedición completada | +50 XP |
| Traslado completado (personas que viajaron) | +25 XP |

Cada 100 XP → sube 1 nivel. Los XP restantes se guardan para el siguiente nivel.

### Logros (Achievements)

Guardados como array de strings en `person.achievements` (PostgreSQL array nativo).

| Logro | Código | Condición |
|-------|--------|-----------|
| Veterano del Páramo | `VETERANO_PARAMO` | 5 expediciones sobrevividas |
| Sobreviviente Élite | `SOBREVIVIENTE_ELITE` | Alcanzar nivel 5 |

### Leaderboard — SurvivalScore

Rankea los 10 mejores campamentos:

```
SurvivalScore = food_total + water_total
              + (personas_activas × 50)
              - (personas_enfermas × 20)
              - (personas_fallecidas × 100)
```

### Badges

Catálogo de insignias visuales (`asset`) que se pueden asignar a usuarios (`user_asset`). Cada usuario elige cuáles mostrar en su perfil con `is_displayed`.

---

## 11. Cumplimiento de Requerimientos

| Requerimiento del enunciado | Cómo se implementó |
|-----------------------------|--------------------|
| Acceso solo con rol específico | Guards globales: `JwtAuthGuard` + `RolesGuard`. 6 roles RBAC configurados. |
| Bloqueo por inactividad 20 min | Redis TTL 1200s. `SessionInactivityGuard` verifica en cada request. `SessionActivityInterceptor` renueva el TTL. |
| Ingreso de persona con IA | `AiModule`: evaluación híbrida NestJS 60% + Python NLP 40%. Transparente con `justification` y `raw_ai_response`. |
| IA transparente y justificable | Reglas determinísticas (Caja de Cristal). Campo `justification` con desglose. Override humano con `final_human_decision`. |
| Identificación automática SURVIVOR | `AdmissionReviewService` genera `SURVIVOR-xxx` al aceptar. |
| Asignación de profesión por IA | `matchProfession()` asigna la profesión más necesaria según habilidades del candidato. |
| Gestión de estados de personas | 9 estados. `PUT /users/persons/:id/status`. `can_work` se actualiza automáticamente. |
| Asignación temporal de profesión | Tabla `temporary_assignment`. Endpoint `POST /users/temporary-assignments`. |
| Conteo de recursos y alertas | `inventory.alert_active`. Endpoint `/alerts`. Vista `vw_inventory_alert`. |
| Proceso diario automático | BullMQ job cron `0 0 * * *`. `executeDailyProcess()` por campamento. |
| Ajuste manual de producción | `POST /resources/daily-production/:personId`. |
| Exploraciones completas | CRUD con 4 estados. Transacciones. Raciones automáticas. Gamificación al retornar. |
| Sistema multi-campamento | `camp_id` en todas las entidades. JWT lleva `campId`. |
| Traslados con doble aprobación | `ApprovalsService` cuenta aprobaciones. Al llegar a 2 ejecuta `departTransfer()`. |
| Auditoría de traslados | `audit_log` con old/new value en todas las operaciones críticas. |
| Personas viajando con raciones | `travel_days × personas × consumo` descontado al aprobar traslado. |
| Dashboard con métricas | `DashboardModule` con 7 vistas SQL, caché Redis 5min, leaderboard. |
| Cambio de campamento reinicia sesión | `PATCH /auth/switch-camp` genera nuevos tokens JWT con el nuevo `campId`. |
| Hora centralizada del servidor | `GET /health/server-time`. Usada en procesos críticos. |
| API versionada | Global prefix `/api/v1`. |
| Pruebas automáticas E2E | 44 tests Playwright contra API de producción, 100% passing. |
| Pruebas unitarias | 728 tests Jest, 63 suites, 100% passing. |
| Desplegado en la nube | Render + Supabase. |
| Roles definidos en enunciado | admin, trabajador, gestor_recursos, encargado_viajes + lider_campamento + supervisor. |

---

## 12. Preguntas de Defensa y Respuestas

### Arquitectura y herramientas

**¿Por qué NestJS en lugar de Express puro?**
NestJS provee arquitectura modular con inyección de dependencias. En un proyecto con 14 módulos, 40+ servicios y 70+ endpoints, Express sin convenciones resulta en código difícil de mantener. NestJS hace que cada módulo sea autónomo, testeable y desacoplado. Además integra de forma nativa TypeORM, Passport, Swagger y WebSocket.

**¿Qué es la inyección de dependencias?**
Es un patrón donde un objeto recibe sus dependencias desde afuera en lugar de crearlas. En NestJS, el contenedor de DI instancia los servicios automáticamente. Si `ExplorationsService` necesita `ResourcesService`, lo declara en el constructor y NestJS lo inyecta. Esto hace el código testeable: en los tests se inyecta un mock en lugar del servicio real.

**¿Por qué Redis para las sesiones y no solo PostgreSQL?**
Redis responde en microsegundos (en memoria) vs PostgreSQL en milisegundos (disco). Verificar la sesión en cada request con SQL sería costoso. Además, Redis tiene TTL nativo: `setex("session:5", 1200, "active")` crea una clave que expira automáticamente en 20 minutos sin jobs de limpieza. PostgreSQL se usa como historial persistente, Redis como estado en tiempo real.

**¿Por qué BullMQ para el proceso diario y no solo @Cron?**
`@Cron` ejecuta en CADA instancia del servidor. Con 3 instancias en producción, el proceso se ejecutaría 3 veces: inventario incorrecto. BullMQ con Redis garantiza que el job lo tome exactamente un worker, aunque haya múltiples instancias.

**¿Por qué Cloudinary para imágenes?**
El servidor Render puede reiniciarse perdiendo archivos almacenados localmente. Cloudinary persiste las imágenes independientemente del servidor. Además ofrece transformaciones on-the-fly: la URL `w_200,h_200,c_fill,r_max` convierte cualquier foto en un avatar circular de 200px sin código adicional.

---

### Base de datos

**¿Por qué la tabla `inventory` tiene clave primaria compuesta en lugar de un ID?**
La combinación `(camp_id, resource_id)` es la clave natural del concepto: un campamento tiene exactamente un registro por tipo de recurso. Usar una PK compuesta impone la restricción de unicidad en la BD, no solo en el código. Es más semántico y previene duplicados ante inserciones concurrentes.

**¿Por qué separaron `person` y `user_account`?**
Porque son conceptos distintos. `person` es un superviviente físico con profesión y estado. `user_account` es acceso al software. No toda persona tiene cuenta (niños, ancianos). No toda cuenta tiene persona (admin del sistema). Si se elimina una cuenta, la historia de la persona permanece.

**¿Por qué usan vistas SQL en lugar de hacer las consultas en el código?**
Las vistas encapsulan consultas complejas con múltiples JOINs. Se definen una vez y se reutilizan por múltiples servicios. TypeORM las trata como entidades de solo lectura con el mismo API que las tablas. Si la consulta cambia, se actualiza solo la vista, no el código de múltiples servicios.

**¿Por qué `inventory_movement` nunca se borra?**
Es el historial inmutable de todas las operaciones. Permite auditar cómo llegó el inventario a su estado actual, detectar errores en el proceso diario y generar reportes históricos. Es equivalente a un extracto bancario: no se borra, se archiva.

**¿Por qué `daily_production` existe si ya tienen `PROFESSIONS_CONFIG` en código?**
`PROFESSIONS_CONFIG` define valores por defecto globales. `daily_production` permite sobrescribir esos valores para un campamento específico. Si el Camp Alpha tiene Recolectores especialmente productivos, se configura en BD sin tocar el código. Es el patrón "configuración por base de datos con defaults en código".

---

### Seguridad

**¿Cuál es la diferencia entre `JwtAuthGuard` y `SessionInactivityGuard`? ¿No son redundantes?**
No. `JwtAuthGuard` valida que el token JWT tenga firma correcta y no haya expirado (expiración fija en el payload). `SessionInactivityGuard` valida que el usuario haya tenido actividad en los últimos 20 minutos (TTL dinámico en Redis). Un usuario activo puede tener un JWT con 5 minutos expirado (renovable con refresh) pero con sesión Redis válida, o viceversa. Son responsabilidades diferentes.

**¿Por qué hashean el refresh token en la tabla `session`?**
Si la BD fuera comprometida, el atacante no podría usar los refresh tokens directamente porque están hasheados con bcrypt. Para verificar, se hace `bcrypt.compare(token_del_request, hash_en_BD)`. Es el mismo principio que no guardar contraseñas en claro.

**¿Qué hace el `CsrfMiddleware`?**
Valida que el header `Origin` o `Referer` del request esté en la lista de orígenes permitidos (`CORS_ORIGIN`). Si viene de un origen no autorizado en métodos que modifican datos (POST, PUT, PATCH, DELETE), devuelve 403. Previene ataques CSRF donde un sitio malicioso hace requests a nuestra API usando las credenciales del usuario.

**¿Por qué `trust proxy: 1` en el bootstrap?**
Render usa un proxy reverso. Sin esta configuración, Express vería como IP del cliente la IP del proxy (siempre la misma), haciendo inútil el rate limiting por IP. Con `trust proxy: 1`, Express lee el header `X-Forwarded-For` con la IP real del cliente.

---

### Flujos y transacciones

**¿Por qué usan transacciones en las exploraciones?**
Porque son operaciones que involucran múltiples cambios que deben ser atómicos. Si el servidor falla entre guardar la exploración y descontar los recursos, el campamento tendría una exploración activa con personas "en campo" pero los recursos seguirían como disponibles. Con transacción: si falla cualquier paso, rollback completo. La BD queda exactamente como antes.

**¿Cómo funciona la doble aprobación de traslados?**
`ApprovalsService` guarda cada `Approval` y cuenta cuántas hay para esa solicitud. Al llegar a 2 aprobaciones, `bothApproved = true` y se ejecuta `departTransfer()` automáticamente: descuenta recursos del origen, pone personas en `TRAVELING`, descuenta raciones de viaje y cambia el status a `in_transit`.

**¿Qué pasa cuando una persona llega al campamento destino en un traslado?**
`arriveTransfer()` suma los recursos al inventario del destino (crea el registro si no existe), cambia el status de las personas de `TRAVELING` a `active`, les da XP por el viaje completado, y actualiza `userAccount.camp_id` al campamento destino. La persona ahora pertenece oficialmente al otro campamento.

**¿Qué pasa si se cancela una exploración?**
Solo puede cancelarse si está en estado `scheduled`. Se hace rollback de recursos: se buscan los `ExplorationResource` con `flow: "out"` y se crea un movimiento `income` por cada uno, reintegrando exactamente lo que se había descontado. Las personas regresan a `active`.

---

### Inteligencia Artificial

**¿Por qué eligieron IA no generativa en lugar de GPT?**
El enunciado exige que el proceso sea transparente y justificable. Un modelo ML es una "caja negra" que no puede explicar sus decisiones. Con reglas determinísticas, se puede mostrar exactamente qué criterios se evaluaron y con qué resultado. Además, no se requieren datos de entrenamiento, no tiene costo de API y siempre produce el mismo resultado para la misma entrada.

**¿Qué pasa si el microservicio Python no está disponible?**
Graceful degradation: `PythonAiService` tiene un timeout de 5 segundos con `AbortController`. Si falla, retorna `null`. En `AiService.submitAdmission()`, si el resultado Python es null, se usa el score de NestJS al 100%. El campo `scoring_method` en `raw_ai_response` queda como `"nestjs_only"` para auditoría. El sistema sigue funcionando sin el componente Python.

**¿Por qué el peso es 60% NestJS y 40% Python?**
NestJS analiza datos objetivos y cuantificables del campamento (ocupación, déficits, balance). Python analiza texto libre subjetivo. Los datos numéricos concretos deben pesar más que la narrativa del candidato. La ponderación puede ajustarse; la arquitectura lo soporta fácilmente.

**¿Puede el admin ignorar la decisión de la IA?**
Sí, siempre. La IA solo recomienda. El admin revisa la justificación y decide. `final_human_decision` puede ser `ACCEPTED` aunque la IA sugiriera `REJECT`, o viceversa. Esta diferencia queda registrada en `admin_notes` para auditoría. Es el principio de "Human-in-the-Loop".

---

### Tests

**¿Por qué tienen 728 tests unitarios y solo 44 E2E?**
Los tests tienen propósitos distintos. Los unitarios son rápidos, prueban casos de borde y manejo de errores en completo aislamiento (mocks de repositorios). Los E2E son lentos, requieren la BD real y prueban que todos los módulos integran correctamente. La proporción refleja la pirámide de testing: muchos unitarios, pocos E2E que cubren los flujos principales.

**¿Cómo funcionan los tests unitarios en NestJS?**
`TestingModule` crea un módulo de prueba con dependencias mockeadas. En lugar del repositorio TypeORM real, se inyecta un objeto con `jest.fn()`:
```typescript
{ provide: getRepositoryToken(Inventory), useValue: { findOne: jest.fn(), save: jest.fn() } }
```
Esto permite probar la lógica del servicio sin necesitar BD ni Redis.

**¿Por qué Playwright para los E2E si no tiene browser?**
Playwright puede usarse solo como cliente HTTP sin levantar un navegador. En este proyecto hace requests directos a la API de producción y verifica las respuestas JSON. Es más potente que Supertest para E2E reales porque puede correr contra la URL de producción con `API_BASE_URL=https://...`.

---

### Decisiones de diseño

**¿Qué pasa si el inventario llega a valores negativos?**
Puede ocurrir en el proceso diario si el consumo supera la producción. Es intencional: el inventario negativo es una señal de alerta crítica. `alert_active` se activa automáticamente. El admin debe ver el dashboard, gestionar mejor los recursos o hacer un traslado. En operaciones manuales (exploraciones, traslados) se valida que haya inventario suficiente antes de ejecutar.

**¿Por qué `max_capacity` puede ser NULL en la tabla camp?**
Para representar campamentos cuya capacidad máxima no ha sido establecida. La vista `vw_camp_population_summary` usa `CASE WHEN max_capacity IS NOT NULL` para evitar división por cero. La regla crítica de IA que evalúa `occupancyRate > 95%` simplemente no aplica para campamentos sin capacidad definida.

**¿Cómo se garantiza que el proceso diario no se ejecute dos veces con BullMQ?**
El job se registra con `jobId: 'daily-resources-job'` fijo en `onModuleInit()`. BullMQ en Redis usa ese ID para garantizar idempotencia: si ya existe un job repetitivo con ese ID, no crea uno nuevo. Con múltiples instancias del servidor, todos llaman `queue.add()` en el inicio, pero BullMQ detecta que el job ya existe y lo ignora.

**¿Por qué la ruta de admisión `/ai/admissions/submit` es pública?**
Porque los candidatos que quieren ingresar al campamento no tienen cuenta en el sistema todavía. Es una solicitud externa. La ruta de tracking `/track/:code` también es pública para que el candidato pueda consultar el estado sin necesitar credenciales.

**¿Qué pasa si dos administradores aprueban un traslado simultáneamente (race condition)?**
Existe un potencial race condition: ambos podrían leer `count(approvals) = 1` y ejecutar `departTransfer()` dos veces. En la implementación actual no hay lock explícito. La solución correcta sería un `SELECT FOR UPDATE` o lock optimista con campo `version`. Es un área de mejora conocida y documentada del proyecto.
