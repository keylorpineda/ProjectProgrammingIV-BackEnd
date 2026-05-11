# 🧟 Gestion del Fin — Documentacion Tecnica

> **Proyecto Final · Programacion IV**  
> API Backend de gestion de campamentos post-apocalipticos  
> 🌐 Produccion: `https://doomsday-system-api.onrender.com/api/v1`  
> 📖 Swagger: `https://doomsday-system-api.onrender.com/api/v1/docs`

---

## Tabla de Contenidos

1. [Descripcion del Proyecto](#1-descripcion-del-proyecto)
2. [Stack Tecnologico y Por Que Cada Herramienta](#2-stack-tecnologico-y-por-que-cada-herramienta)
3. [Arquitectura General](#3-arquitectura-general)
4. [Base de Datos — Tablas y Relaciones](#4-base-de-datos--tablas-y-relaciones)
5. [Vistas SQL](#5-vistas-sql)
6. [Modulos y Endpoints](#6-modulos-y-endpoints)
7. [Capas de Seguridad](#7-capas-de-seguridad)
8. [Flujos de Informacion Importantes](#8-flujos-de-informacion-importantes)
9. [Inteligencia Artificial](#9-inteligencia-artificial)
10. [Gamificacion](#10-gamificacion)
11. [Cumplimiento de Requerimientos](#11-cumplimiento-de-requerimientos)
12. [Preguntas de Defensa y Respuestas](#12-preguntas-de-defensa-y-respuestas)

---

## 1. Descripcion del Proyecto

**Gestion del Fin** es una API REST backend para administrar campamentos de supervivencia humana en un apocalipsis zombie. El sistema es **multi-campamento**: varios campamentos comparten la misma plataforma pero cada uno maneja sus propios datos de inventario, personas y operaciones.

**Funcionalidades principales:**
- Admision de nuevas personas evaluada por Inteligencia Artificial con revision humana
- Gestion de inventario con produccion/consumo automatico diario
- Exploraciones fuera del campamento con gestion de raciones
- Traslados de recursos y personas entre campamentos con doble aprobacion
- Dashboard con metricas en tiempo real
- Notificaciones WebSocket cuando llega una solicitud de traslado

---

## 2. Stack Tecnologico y Por Que Cada Herramienta

| Herramienta | Rol | Por que se eligio |
|------------|-----|-------------------|
| **NestJS** | Framework backend principal | Arquitectura modular con inyeccion de dependencias. Escala bien para 14 modulos y 70+ endpoints sin volverse caotico como Express puro. Integracion nativa con TypeORM, Passport, Swagger y WebSocket. |
| **TypeScript** | Lenguaje | Tipado estatico detecta errores en compilacion, no en produccion. Los DTOs con `class-validator` definen el contrato de entrada con decoradores. |
| **PostgreSQL (Supabase)** | Base de datos | ACID para transacciones criticas (exploraciones, traslados). JOINs complejos entre 22 tablas. Soporte nativo de arrays (`achievements[]`) y JSONB. Supabase provee hosting gestionado con SSL. |
| **TypeORM** | ORM | Integracion oficial con NestJS. Entidades como clases TypeScript con decoradores. QueryBuilder para consultas complejas. Soporte de `ViewEntity` para vistas SQL. |
| **Redis (ioredis)** | Cache, sesiones, cola, pub/sub | TTL nativo para timeout de inactividad (20 min). Cache del dashboard (5 min). BullMQ requiere Redis para la cola de jobs. Socket.IO necesita Redis para escalar a multiples instancias. |
| **BullMQ** | Cola de trabajos | El proceso diario de recursos debe correr exactamente una vez aunque haya multiples instancias del servidor. `@Cron` ejecuta en cada instancia (duplica el proceso). BullMQ garantiza ejecucion unica con Redis. |
| **Socket.IO + Redis Adapter** | WebSocket | Notificaciones en tiempo real cuando un campamento recibe una solicitud de traslado. El adaptador Redis permite escalar horizontalmente: una instancia puede notificar a clientes de otra instancia. |
| **JWT + Passport** | Autenticacion | Tokens stateless que cualquier instancia puede validar sin consultar BD. Dual token: access (20 min) + refresh (7 dias) con rotacion de seguridad. |
| **bcrypt** | Hash de contrasenas | Hash con salt aleatoria y costo configurable. SHA-256 es rapido (malo para passwords). bcrypt es lento a proposito, haciendo ataques de diccionario impracticables. 12 rounds = ~250ms. |
| **Cloudinary** | Imagenes | CDN global, transformaciones on-the-fly (thumbnails, avatares circulares). El servidor Render puede reiniciarse perdiendo archivos locales; Cloudinary persiste. |
| **Helmet** | Headers HTTP de seguridad | Inyecta automaticamente `X-XSS-Protection`, `X-Frame-Options`, `Strict-Transport-Security`, `Content-Security-Policy`. Una linea de codigo, multiples protecciones. |
| **xss** | Sanitizacion de inputs | Elimina/escapa HTML malicioso de todos los inputs antes de procesarlos. Previene ataques XSS que podrian inyectar scripts en datos persistidos. |
| **class-validator** | Validacion de DTOs | Validacion declarativa con decoradores (`@IsEmail`, `@Min`, `@IsEnum`). Con `whitelist: true` elimina campos no definidos en el DTO (previene mass assignment). |
| **Swagger** | Documentacion | Generada automaticamente desde los decoradores del codigo: siempre actualizada. UI interactiva en `/api/v1/docs` para probar endpoints. |
| **Jest + ts-jest** | Tests unitarios | 728 tests, 63 suites. Integracion nativa con NestJS (`TestingModule`). `ts-jest` transpila TypeScript sin compilacion previa. |
| **Playwright** | Tests E2E | 44 tests contra la API real de produccion (sin browser). Verifica que todos los modulos integran correctamente. |
| **Render** | Hosting | CI/CD automatico desde GitHub, HTTPS gestionado, variables de entorno seguras. Capa gratuita suficiente para el proyecto. |

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
 8 vistas SQL             Cache dashboard (5min)
                          BullMQ queue
                          Socket.IO pub/sub
                                │
                                ▼
                     Python / FastAPI
                     (Microservicio IA)
                     spaCy + reglas NLP
```

### Patron de modulos NestJS

Cada modulo agrupa: `Controller` (recibe HTTP) → `Service` (logica de negocio) → `Repository` (TypeORM, acceso a BD). Los modulos exportan sus servicios para que otros los importen. El modulo raiz `AppModule` registra los guards e interceptores globales.

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
└── HealthModule             → endpoints publicos
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

Entidad raiz del sistema multi-campamento. Todo dato de inventario, personas y operaciones lleva `camp_id`.

| Columna | Tipo | Descripcion |
|---------|------|-------------|
| `id` | bigint PK | Auto-incremental |
| `name` | text | Nombre del campamento |
| `location_description` | text | Descripcion de ubicacion |
| `latitude / longitude` | decimal | Coordenadas GPS |
| `max_capacity` | int | Maximo de personas (nullable) |
| `active` | bool | Soft delete |
| `foundation_date` | date | Fecha de fundacion |
| `logo_url / logo_public_id` | text | Imagen en Cloudinary |

---

### Tabla `role` — Roles del sistema

Implementa RBAC. Centralizar roles en BD permite modificarlos sin redeployar.

| Nombre | Descripcion |
|--------|-------------|
| `admin` | Acceso total, gestiona ingresos de personas |
| `trabajador` | Cambios de inventario autorizados |
| `gestor_recursos` | Traslados y recursos |
| `encargado_viajes` | Expediciones y negociaciones |
| `lider_campamento` | Variante de admin por campamento |
| `supervisor` | Supervision general |

---

### Tabla `profession` — Profesiones

Define las capacidades productivas. La profesion determina cuanto produce un trabajador al dia.

| Profesion | Food/dia | Water/dia | Puede Explorar | Min. Req. |
|-----------|----------|-----------|---------------|-----------|
| Recolector | 10 | 0 | ✅ | 2 |
| Aguatero | 0 | 15 | ❌ | 2 |
| Explorador | 5 | 0 | ✅ | 1 |
| Guardia | 0 | 0 | ❌ | 2 |
| Medico | 0 | 0 | ❌ | 1 |
| Ingeniero | 0 | 5 | ❌ | 1 |
| Cocinero | 3 | 0 | ❌ | 1 |
| Almacenista | 0 | 0 | ❌ | 1 |
| Agricultor | 8 | 0 | ❌ | 1 |
| Constructor | 0 | 0 | ❌ | 1 |

Consumo base: **2 food/persona/dia + 3 water/persona/dia**.

---

### Tabla `person` — Personas del campamento

Entidad central del dominio. Representa a cada superviviente con su historia y estado.

| Columna | Descripcion |
|---------|-------------|
| `identification_code` | Codigo `SURVIVOR-xxx` generado al aceptar la admision |
| `status` | Estado actual (ver tabla abajo) |
| `can_work` | Si puede trabajar (se usa en el proceso diario) |
| `experience_level / experience_points` | Gamificacion — progresion del superviviente |
| `expeditionsSurvived` | Contador de expediciones completadas |
| `achievements[]` | Array de logros (PostgreSQL nativo) |
| `ai_admission_result` | JSON con el resultado del proceso de admision |

**Estados de una persona:**

| Status | Que significa |
|--------|---------------|
| `active` | En el campamento, trabajando |
| `sick` | Enferma, no trabaja |
| `injured` | Herida, no trabaja |
| `deceased` | Fallecida, excluida de todas las cuentas |
| `exploring` | En expedicion activa |
| `traveling` | En transito en traslado intercampamento |
| `resting / idle / out_of_camp` | Variantes de no disponible |

---

### Tabla `user_account` — Cuentas de usuario

**¿Por que separar `person` de `user_account`?** Una persona puede existir en el sistema sin acceso al software (ninos, ancianos). Una cuenta puede existir sin persona asociada (admin del sistema). Separa identidad de negocio de credenciales de acceso.

| Columna | Descripcion |
|---------|-------------|
| `camp_id` | Campamento activo del usuario |
| `person_id` | OneToOne con persona (nullable) |
| `role_id` | Rol del usuario |
| `password_hash` | Hash bcrypt de la contrasena |
| `last_access` | Ultima vez que inicio sesion |

---

### Tabla `session` — Sesiones activas

**¿Por que existe si ya tienen Redis para sesiones?** Redis controla la inactividad en tiempo real (TTL). La tabla `session` es el historial persistente: permite saber cuantas sesiones tuvo un usuario, cuando se cerraron y si fue por inactividad (`auto_logout=true`) o voluntario.

| Columna | Descripcion |
|---------|-------------|
| `token_hash` | Hash bcrypt del refresh token (no en claro por seguridad) |
| `last_activity` | Ultima actividad registrada |
| `expires_at` | Expiracion del refresh token (7 dias) |
| `auto_logout` | `true` si cerro por inactividad |
| `is_active` | Si la sesion esta activa |

---

### Tabla `login_attempt` — Intentos de login

Registra cada intento con IP, user-agent y razon de falla. Permite detectar ataques de fuerza bruta. Limite: 1000 fallos por IP en ventana de 15 minutos → 401 automatico.

---

### Tabla `audit_log` — Auditoria

Registro inmutable de todas las acciones criticas. Guarda `old_value` y `new_value` en JSON para saber exactamente que cambio, quien lo hizo y cuando.

Acciones auditadas: movimientos de inventario, creacion/cancelacion de traslados, aprobaciones, exploraciones, admisiones IA.

---

### Tabla `resource` — Tipos de recursos

Catalogo centralizado: Food, Water, Hygiene, Defense, Medicine. Permite agregar nuevos tipos sin modificar codigo.

---

### Tabla `inventory` — Stock actual

Clave primaria compuesta `(camp_id, resource_id)` — garantiza que no puede haber dos registros del mismo recurso para el mismo campamento. La restriccion esta en la BD, no solo en codigo.

| Columna | Descripcion |
|---------|-------------|
| `current_quantity` | Stock actual |
| `minimum_stock_required` | Umbral para disparar alerta |
| `alert_active` | `true` si `current < minimum` |

---

### Tabla `inventory_movement` — Historial de movimientos

Nunca se borra. Es el historial inmutable de todas las operaciones de inventario. Tipos de movimiento:

| Tipo | Cuando se genera |
|------|-----------------|
| `income / outcome` | Movimiento manual |
| `daily_production` | Proceso diario (por trabajador) |
| `daily_consumption` | Proceso diario (por persona en el camp) |
| `transfer_in / transfer_out` | Traslado intercampamento |
| `exploration_in / exploration_out` | Al crear/completar una expedicion |

---

### Tabla `daily_production` y `daily_consumption`

Permiten sobreescribir los valores por defecto de produccion y consumo. Si no existe registro, se usa el valor de `PROFESSIONS_CONFIG` (codigo TypeScript). Esto es el patron "override por configuracion": valores inteligentes por defecto con posibilidad de personalizacion por campamento.

---

### Tabla `exploration` — Expediciones

Ciclo de vida: `scheduled` → `in_progress` → `completed` / `cancelled`.

| Columna | Descripcion |
|---------|-------------|
| `estimated_days` | Dias estimados de duracion |
| `grace_days` | Dias de gracia antes de declarar perdida |
| `real_return_date` | Cuando regresaron realmente |

Tablas relacionadas:
- `exploration_person`: personas de la expedicion con `is_leader`
- `exploration_resource`: recursos con `flow` (in = encontrados, out = llevados)

---

### Tabla `intercamp_request` — Solicitudes de traslado

Estados del traslado: `pending` → `approved` → `in_transit` → `completed` (o `rejected` / `cancelled`).

Tablas relacionadas:
- `approval`: quien aprobo y cuando (doble aprobacion)
- `request_resource_detail`: que recursos con cantidades solicitadas/aprobadas/recibidas
- `request_person_detail`: que personas con `transfer_status`

---

### Tabla `ai_admission` — Evaluaciones IA

Registra todo el proceso de admision con transparencia total.

| Columna | Descripcion |
|---------|-------------|
| `tracking_code` | `ADM-2026-XXXXXX` para seguimiento publico sin auth |
| `candidate_data` | JSON con los datos tal como los envio el candidato |
| `raw_ai_response` | JSON con evaluacion NestJS + Python NLP + score combinado |
| `suggested_decision` | Lo que la IA recomienda |
| `final_human_decision` | Lo que el admin decidio (siempre prevalece) |

---

### Tabla `temporary_assignment` — Asignaciones temporales

Cuando una profesion queda sin el minimo de trabajadores, se puede asignar temporalmente a personas de otra profesion. Guarda profesion origen, profesion temporal, fechas y razon.

---

### Tabla `asset` / `user_asset` — Gamificacion

`asset` es el catalogo de badges disponibles. `user_asset` registra que usuario tiene que badge con `is_displayed` (el usuario elige cuales mostrar en su perfil).

---

## 5. Vistas SQL

**¿Por que vistas y no queries en el codigo?** Las vistas encapsulan consultas SQL complejas con multiples JOINs y agregaciones. Son reutilizables por multiples servicios, optimizables por PostgreSQL, y TypeORM las trata como entidades de solo lectura (`ViewEntity`) con el mismo API de repositorio que las tablas normales.

| Vista | Proposito | Usada por |
|-------|-----------|-----------|
| `vw_camp_population_summary` | Poblacion, trabajadores activos, tasa de ocupacion | Dashboard, IA |
| `vw_person_status_stats` | Conteo por estado (active, sick, etc.) | Dashboard, stats |
| `vw_person_profession_stats` | Conteo por profesion con activos/inactivos | Dashboard, alertas |
| `vw_inventory_status` | Inventario completo con nombre del recurso | Dashboard |
| `vw_inventory_alert` | Solo recursos con `alert_active = true` | Dashboard, alertas |
| `vw_transfer_camp_summary` | Resumen de traslados por campamento | Dashboard |
| `vw_exploration_summary` | Exploraciones con personas y recursos | Dashboard |
| `vw_active_temporary_assignment` | Asignaciones temporales activas | UsersService |

---

## 6. Modulos y Endpoints

### AuthModule — Autenticacion

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| POST | `/auth/login` | ❌ | Login con username/password |
| POST | `/auth/logout` | ✅ | Cerrar sesion |
| POST | `/auth/refresh` | ❌ | Renovar access token |
| GET | `/auth/session-status` | ✅ | Ver TTL restante de sesion |
| PATCH | `/auth/switch-camp` | ✅ | Cambiar campamento activo |

---

### CampsModule — Campamentos

| Metodo | Ruta | Roles | Descripcion |
|--------|------|-------|-------------|
| POST | `/camps` | admin | Crear campamento + inicializar inventario |
| GET | `/camps` | todos | Listar campamentos activos |
| GET | `/camps/:id` | todos | Detalle + metricas de inventario |
| PATCH | `/camps/:id` | admin | Actualizar |
| DELETE | `/camps/:id` | admin | Soft delete |

---

### UsersModule — Personas y Profesiones

| Metodo | Ruta | Roles | Descripcion |
|--------|------|-------|-------------|
| GET | `/users/persons` | admin, gestor, viajes | Listar con paginacion |
| POST | `/users/persons` | admin | Crear persona |
| PUT | `/users/persons/:id/status` | admin, gestor | Cambiar estado (sick, injured…) |
| DELETE | `/users/persons/:id` | admin | Eliminar |
| GET | `/users/professions/alerts/needing-workers` | admin, gestor | Profesiones bajo minimo |
| POST | `/users/temporary-assignments` | admin, gestor | Asignar temporalmente a otra profesion |
| GET | `/users/camp/:campId/balance` | admin, gestor, trabajador | Balance produccion-consumo |
| GET | `/users/me/badges` | todos | Mis badges de gamificacion |

---

### ResourcesModule — Inventario

| Metodo | Ruta | Roles | Descripcion |
|--------|------|-------|-------------|
| GET | `/resources/inventory/:campId` | admin, gestor, trabajador, viajes | Ver inventario |
| GET | `/resources/inventory/:campId/alerts` | admin, gestor | Recursos bajo minimo |
| PATCH | `/resources/inventory/:campId/:resourceId` | admin, gestor | Actualizar minimos/stock |
| POST | `/resources/movements` | admin, gestor, trabajador | Registrar movimiento manual |
| GET | `/resources/movements/:campId` | admin, gestor, trabajador | Historial |
| POST | `/resources/daily-process/:campId` | admin, gestor | Ejecutar proceso diario manualmente |

---

### ExplorationsModule — Expediciones

| Metodo | Ruta | Roles | Descripcion |
|--------|------|-------|-------------|
| POST | `/explorations` | admin, viajes | Crear expedicion |
| GET | `/explorations` | admin, viajes, gestor | Listar |
| PATCH | `/explorations/:id/depart` | admin, viajes | Marcar como en curso |
| PATCH | `/explorations/:id/return` | admin, viajes | Registrar retorno + recursos encontrados |
| DELETE | `/explorations/:id` | admin, viajes | Cancelar (solo si esta scheduled) |

---

### TransfersModule — Traslados Intercampamento

| Metodo | Ruta | Roles | Descripcion |
|--------|------|-------|-------------|
| POST | `/transfers/requests` | admin, gestor, viajes | Crear solicitud |
| GET | `/transfers/requests/camp/:campId` | admin, gestor, viajes | Solicitudes del campamento |
| PATCH | `/transfers/requests/:id/approval` | admin, gestor, viajes | Aprobar / rechazar |
| PATCH | `/transfers/requests/:id/arrive` | admin, gestor, viajes, trabajador | Registrar llegada |
| GET | `/transfers/statistics/:campId` | admin, gestor | Estadisticas |

---

### AiModule — Admision con IA

| Metodo | Ruta | Auth | Roles | Descripcion |
|--------|------|------|-------|-------------|
| POST | `/ai/admissions/submit` | ❌ | — | Enviar solicitud |
| GET | `/ai/admissions/track/:code` | ❌ | — | Seguimiento publico |
| GET | `/ai/admissions/pending` | ✅ | admin, gestor | Ver pendientes |
| POST | `/ai/admissions/:id/review` | ✅ | admin | Revisar (aceptar/rechazar) |
| POST | `/ai/admissions/:id/create-account` | ✅ | admin | Crear cuenta de usuario |

---

### DashboardModule — Metricas

| Metodo | Ruta | Roles | Descripcion |
|--------|------|-------|-------------|
| GET | `/dashboard/:campId` | admin, gestor | Metricas del campamento (cache 5min) |
| GET | `/dashboard/leaderboard` | admin, gestor | Top 10 por SurvivalScore |

---

### HealthModule — Heartbeat (publicos)

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/health` | Estado de la API |
| GET | `/health/server-time` | Hora centralizada del servidor |

---

## 7. Capas de Seguridad

Cada request pasa por las siguientes capas **en este orden exacto**:

```
1. body-parser      → parsea JSON/urlencoded hasta 1MB
2. Helmet           → headers HTTP de seguridad automaticos
3. CsrfMiddleware   → valida Origin/Referer en POST/PUT/PATCH/DELETE
4. ThrottlerGuard   → rate limiting por IP (10 req/60s por defecto)
5. JwtAuthGuard     → valida firma + expiracion del Bearer token
                      bypass si la ruta tiene @Public()
6. SessionInactivityGuard → redis.exists(session:userId)
                            si 0 → 401 (sesion expirada por inactividad)
7. RolesGuard       → user.role debe estar en @Roles([...]) del endpoint
8. SessionActivityInterceptor → redis.expire(session:userId, 1200)
                                 sessionRepo.update(last_activity)
9. SanitizeInterceptor → xss() en todo el body y query params
10. ValidationPipe  → class-validator sobre el DTO
11. Handler del controller
```

**¿Por que este orden?** ThrottlerGuard va primero para bloquear IPs abusivas antes de hacer trabajo costoso (validar JWT requiere criptografia). JwtAuthGuard va antes que SessionInactivity porque necesitamos el `userId` del token para consultar Redis.

### Sistema de tokens JWT

- **Access token**: 20 minutos. Se envia en cada request (`Authorization: Bearer ...`).
- **Refresh token**: 7 dias. Se usa solo para renovar el access token. Su hash bcrypt se guarda en la tabla `session`.
- **Rotacion**: cada vez que se renueva, se genera un nuevo refresh token y el anterior queda invalido. Si alguien roba el refresh token, solo puede usarlo una vez antes de que el sistema lo invalide.

### Inactividad de sesion (20 minutos)

Al hacer login: `redis.setex("session:userId", 1200, "active")`. En cada request autenticado: `redis.expire("session:userId", 1200)` — reinicia el contador. Si el usuario no hace nada por 20 minutos, la key expira sola. El `SessionInactivityGuard` detecta que no existe y devuelve 401.

---

## 8. Flujos de Informacion Importantes

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
        ├─ PRODUCCION: por cada persona con (can_work=true, status=active)
        │   └─ Busca DailyProduction custom (camp, profesion, recurso)
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

### Flujo de una Exploracion

```
1. POST /explorations → valida personas (can_explore, status=active, no en otra exploracion)
   → calcula raciones (dias × personas × consumo)
   → TRANSACCION: guarda exploracion + personas + descuenta recursos (exploration_out)
   → personas: status = "exploring"

2. PATCH /depart → status: "in_progress" → llama Python IA para analisis de riesgo

3. PATCH /return {recursos_encontrados} → TRANSACCION:
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

### Filosofia: IA No Generativa (Caja de Cristal)

El sistema usa **reglas deterministicas explicitas**, no modelos de Machine Learning. Esto significa:
- La misma entrada siempre produce la misma salida
- Cada criterio evaluado es visible y auditable
- No hay archivos `.pkl` ni parametros ocultos
- Se puede explicar exactamente por que se tomo cada decision

El enunciado exige que el proceso sea **transparente y justificable**. Un modelo ML no puede explicar sus decisiones de forma trazable.

### Dos componentes de evaluacion

**Componente NestJS (60% del score final):**

*Reglas criticas — cortocircuitan la evaluacion normal:*
- Condicion medica contagiosa → REJECT automatico
- Campamento al 95%+ de capacidad sin habilidades criticas → REJECT
- Deficit grave de comida y candidato sin habilidades productivas → REJECT
- Deficit grave y candidato CON la habilidad urgente → ACCEPT inmediato

*Score de 5 factores (si no aplica regla critica):*

| Factor | Max | Que evalua |
|--------|-----|-----------|
| Profession Need | 40 | Si el campamento necesita esa profesion |
| Skills | 25 | Cantidad y anos de experiencia |
| Health | 15 | Promedio health_status + physical_condition |
| Resource Impact | 10 | Si produce recursos en deficit |
| Risk Assessment | 10 | Evaluacion psicologica y antecedentes |

Decision: ≥ 75 → RECOMMEND_ACCEPT · 50–74 → REQUIRES_REVIEW · < 50 → RECOMMEND_REJECT

---

**Componente Python/FastAPI (40% del score final):**

Microservicio separado que analiza el `personal_history` (texto libre) del candidato usando:
- **Keywords deterministicos**: listas de palabras de infeccion, engano, trauma, habilidades
- **Regex**: patrones de evasion ("no se", "no recuerdo", "tal vez")
- **spaCy `es_core_news_sm`**: modelo preentrenado de espanol para tokenizacion

8 criterios evaluados: riesgo biologico, salud fisica, edad, habilidades, honestidad narrativa, antecedentes, trauma psicologico, documentacion.

Si detecta `infection_detected = true` → fuerza RECOMMEND_REJECT sin importar el score.

---

**Integracion y graceful degradation:**

```
score_final = nestjs_score × 0.6 + python_nlp × 0.4

Si Python no responde (timeout 5s):
  score_final = nestjs_score × 1.0
  raw_ai_response.scoring_method = "nestjs_only (Python microservice unavailable)"
```

Si Python falla, el sistema NestJS sigue funcionando normalmente. Esto es **graceful degradation**: el fallo de un componente no bloquea el sistema.

---

**Human-in-the-Loop (Revision Humana Obligatoria):**

La IA solo recomienda. El admin siempre tiene la ultima palabra:

```
IA sugiere → Admin revisa justificacion → Admin decide → Sistema ejecuta

final_human_decision puede diferir de suggested_decision.
La diferencia queda registrada en admin_notes para auditoria.
```

---

## 10. Gamificacion

### XP y Niveles

| Evento | XP Ganados |
|--------|-----------|
| Expedicion completada | +50 XP |
| Traslado completado (personas que viajaron) | +25 XP |

Cada 100 XP → sube 1 nivel. Los XP restantes se guardan para el siguiente nivel.

### Logros (Achievements)

Guardados como array de strings en `person.achievements` (PostgreSQL array nativo).

| Logro | Codigo | Condicion |
|-------|--------|-----------|
| Veterano del Paramo | `VETERANO_PARAMO` | 5 expediciones sobrevividas |
| Sobreviviente Elite | `SOBREVIVIENTE_ELITE` | Alcanzar nivel 5 |

### Leaderboard — SurvivalScore

Rankea los 10 mejores campamentos:

```
SurvivalScore = food_total + water_total
              + (personas_activas × 50)
              - (personas_enfermas × 20)
              - (personas_fallecidas × 100)
```

### Badges

Catalogo de insignias visuales (`asset`) que se pueden asignar a usuarios (`user_asset`). Cada usuario elige cuales mostrar en su perfil con `is_displayed`.

---

## 11. Cumplimiento de Requerimientos

| Requerimiento del enunciado | Como se implemento |
|-----------------------------|--------------------|
| Acceso solo con rol especifico | Guards globales: `JwtAuthGuard` + `RolesGuard`. 6 roles RBAC configurados. |
| Bloqueo por inactividad 20 min | Redis TTL 1200s. `SessionInactivityGuard` verifica en cada request. `SessionActivityInterceptor` renueva el TTL. |
| Ingreso de persona con IA | `AiModule`: evaluacion hibrida NestJS 60% + Python NLP 40%. Transparente con `justification` y `raw_ai_response`. |
| IA transparente y justificable | Reglas deterministicas (Caja de Cristal). Campo `justification` con desglose. Override humano con `final_human_decision`. |
| Identificacion automatica SURVIVOR | `AdmissionReviewService` genera `SURVIVOR-xxx` al aceptar. |
| Asignacion de profesion por IA | `matchProfession()` asigna la profesion mas necesaria segun habilidades del candidato. |
| Gestion de estados de personas | 9 estados. `PUT /users/persons/:id/status`. `can_work` se actualiza automaticamente. |
| Asignacion temporal de profesion | Tabla `temporary_assignment`. Endpoint `POST /users/temporary-assignments`. |
| Conteo de recursos y alertas | `inventory.alert_active`. Endpoint `/alerts`. Vista `vw_inventory_alert`. |
| Proceso diario automatico | BullMQ job cron `0 0 * * *`. `executeDailyProcess()` por campamento. |
| Ajuste manual de produccion | `POST /resources/daily-production/:personId`. |
| Exploraciones completas | CRUD con 4 estados. Transacciones. Raciones automaticas. Gamificacion al retornar. |
| Sistema multi-campamento | `camp_id` en todas las entidades. JWT lleva `campId`. |
| Traslados con doble aprobacion | `ApprovalsService` cuenta aprobaciones. Al llegar a 2 ejecuta `departTransfer()`. |
| Auditoria de traslados | `audit_log` con old/new value en todas las operaciones criticas. |
| Personas viajando con raciones | `travel_days × personas × consumo` descontado al aprobar traslado. |
| Dashboard con metricas | `DashboardModule` con 7 vistas SQL, cache Redis 5min, leaderboard. |
| Cambio de campamento reinicia sesion | `PATCH /auth/switch-camp` genera nuevos tokens JWT con el nuevo `campId`. |
| Hora centralizada del servidor | `GET /health/server-time`. Usada en procesos criticos. |
| API versionada | Global prefix `/api/v1`. |
| Pruebas automaticas E2E | 44 tests Playwright contra API de produccion, 100% passing. |
| Pruebas unitarias | 728 tests Jest, 63 suites, 100% passing. |
| Desplegado en la nube | Render + Supabase. |
| Roles definidos en enunciado | admin, trabajador, gestor_recursos, encargado_viajes + lider_campamento + supervisor. |

---

## 12. Preguntas de Defensa y Respuestas

### Arquitectura y herramientas

**¿Por que NestJS en lugar de Express puro?**
NestJS provee arquitectura modular con inyeccion de dependencias. En un proyecto con 14 modulos, 40+ servicios y 70+ endpoints, Express sin convenciones resulta en codigo dificil de mantener. NestJS hace que cada modulo sea autonomo, testeable y desacoplado. Ademas integra de forma nativa TypeORM, Passport, Swagger y WebSocket.

**¿Que es la inyeccion de dependencias?**
Es un patron donde un objeto recibe sus dependencias desde afuera en lugar de crearlas. En NestJS, el contenedor de DI instancia los servicios automaticamente. Si `ExplorationsService` necesita `ResourcesService`, lo declara en el constructor y NestJS lo inyecta. Esto hace el codigo testeable: en los tests se inyecta un mock en lugar del servicio real.

**¿Por que Redis para las sesiones y no solo PostgreSQL?**
Redis responde en microsegundos (en memoria) vs PostgreSQL en milisegundos (disco). Verificar la sesion en cada request con SQL seria costoso. Ademas, Redis tiene TTL nativo: `setex("session:5", 1200, "active")` crea una clave que expira automaticamente en 20 minutos sin jobs de limpieza. PostgreSQL se usa como historial persistente, Redis como estado en tiempo real.

**¿Por que BullMQ para el proceso diario y no solo @Cron?**
`@Cron` ejecuta en CADA instancia del servidor. Con 3 instancias en produccion, el proceso se ejecutaria 3 veces: inventario incorrecto. BullMQ con Redis garantiza que el job lo tome exactamente un worker, aunque haya multiples instancias.

**¿Por que Cloudinary para imagenes?**
El servidor Render puede reiniciarse perdiendo archivos almacenados localmente. Cloudinary persiste las imagenes independientemente del servidor. Ademas ofrece transformaciones on-the-fly: la URL `w_200,h_200,c_fill,r_max` convierte cualquier foto en un avatar circular de 200px sin codigo adicional.

---

### Base de datos

**¿Por que la tabla `inventory` tiene clave primaria compuesta en lugar de un ID?**
La combinacion `(camp_id, resource_id)` es la clave natural del concepto: un campamento tiene exactamente un registro por tipo de recurso. Usar una PK compuesta impone la restriccion de unicidad en la BD, no solo en el codigo. Es mas semantico y previene duplicados ante inserciones concurrentes.

**¿Por que separaron `person` y `user_account`?**
Porque son conceptos distintos. `person` es un superviviente fisico con profesion y estado. `user_account` es acceso al software. No toda persona tiene cuenta (ninos, ancianos). No toda cuenta tiene persona (admin del sistema). Si se elimina una cuenta, la historia de la persona permanece.

**¿Por que usan vistas SQL en lugar de hacer las consultas en el codigo?**
Las vistas encapsulan consultas complejas con multiples JOINs. Se definen una vez y se reutilizan por multiples servicios. TypeORM las trata como entidades de solo lectura con el mismo API que las tablas. Si la consulta cambia, se actualiza solo la vista, no el codigo de multiples servicios.

**¿Por que `inventory_movement` nunca se borra?**
Es el historial inmutable de todas las operaciones. Permite auditar como llego el inventario a su estado actual, detectar errores en el proceso diario y generar reportes historicos. Es equivalente a un extracto bancario: no se borra, se archiva.

**¿Por que `daily_production` existe si ya tienen `PROFESSIONS_CONFIG` en codigo?**
`PROFESSIONS_CONFIG` define valores por defecto globales. `daily_production` permite sobrescribir esos valores para un campamento especifico. Si el Camp Alpha tiene Recolectores especialmente productivos, se configura en BD sin tocar el codigo. Es el patron "configuracion por base de datos con defaults en codigo".

---

### Seguridad

**¿Cual es la diferencia entre `JwtAuthGuard` y `SessionInactivityGuard`? ¿No son redundantes?**
No. `JwtAuthGuard` valida que el token JWT tenga firma correcta y no haya expirado (expiracion fija en el payload). `SessionInactivityGuard` valida que el usuario haya tenido actividad en los ultimos 20 minutos (TTL dinamico en Redis). Un usuario activo puede tener un JWT con 5 minutos expirado (renovable con refresh) pero con sesion Redis valida, o viceversa. Son responsabilidades diferentes.

**¿Por que hashean el refresh token en la tabla `session`?**
Si la BD fuera comprometida, el atacante no podria usar los refresh tokens directamente porque estan hasheados con bcrypt. Para verificar, se hace `bcrypt.compare(token_del_request, hash_en_BD)`. Es el mismo principio que no guardar contrasenas en claro.

**¿Que hace el `CsrfMiddleware`?**
Valida que el header `Origin` o `Referer` del request este en la lista de origenes permitidos (`CORS_ORIGIN`). Si viene de un origen no autorizado en metodos que modifican datos (POST, PUT, PATCH, DELETE), devuelve 403. Previene ataques CSRF donde un sitio malicioso hace requests a nuestra API usando las credenciales del usuario.

**¿Por que `trust proxy: 1` en el bootstrap?**
Render usa un proxy reverso. Sin esta configuracion, Express veria como IP del cliente la IP del proxy (siempre la misma), haciendo inutil el rate limiting por IP. Con `trust proxy: 1`, Express lee el header `X-Forwarded-For` con la IP real del cliente.

---

### Flujos y transacciones

**¿Por que usan transacciones en las exploraciones?**
Porque son operaciones que involucran multiples cambios que deben ser atomicos. Si el servidor falla entre guardar la exploracion y descontar los recursos, el campamento tendria una exploracion activa con personas "en campo" pero los recursos seguirian como disponibles. Con transaccion: si falla cualquier paso, rollback completo. La BD queda exactamente como antes.

**¿Como funciona la doble aprobacion de traslados?**
`ApprovalsService` guarda cada `Approval` y cuenta cuantas hay para esa solicitud. Al llegar a 2 aprobaciones, `bothApproved = true` y se ejecuta `departTransfer()` automaticamente: descuenta recursos del origen, pone personas en `TRAVELING`, descuenta raciones de viaje y cambia el status a `in_transit`.

**¿Que pasa cuando una persona llega al campamento destino en un traslado?**
`arriveTransfer()` suma los recursos al inventario del destino (crea el registro si no existe), cambia el status de las personas de `TRAVELING` a `active`, les da XP por el viaje completado, y actualiza `userAccount.camp_id` al campamento destino. La persona ahora pertenece oficialmente al otro campamento.

**¿Que pasa si se cancela una exploracion?**
Solo puede cancelarse si esta en estado `scheduled`. Se hace rollback de recursos: se buscan los `ExplorationResource` con `flow: "out"` y se crea un movimiento `income` por cada uno, reintegrando exactamente lo que se habia descontado. Las personas regresan a `active`.

---

### Inteligencia Artificial

**¿Por que eligieron IA no generativa en lugar de GPT?**
El enunciado exige que el proceso sea transparente y justificable. Un modelo ML es una "caja negra" que no puede explicar sus decisiones. Con reglas deterministicas, se puede mostrar exactamente que criterios se evaluaron y con que resultado. Ademas, no se requieren datos de entrenamiento, no tiene costo de API y siempre produce el mismo resultado para la misma entrada.

**¿Que pasa si el microservicio Python no esta disponible?**
Graceful degradation: `PythonAiService` tiene un timeout de 5 segundos con `AbortController`. Si falla, retorna `null`. En `AiService.submitAdmission()`, si el resultado Python es null, se usa el score de NestJS al 100%. El campo `scoring_method` en `raw_ai_response` queda como `"nestjs_only"` para auditoria. El sistema sigue funcionando sin el componente Python.

**¿Por que el peso es 60% NestJS y 40% Python?**
NestJS analiza datos objetivos y cuantificables del campamento (ocupacion, deficits, balance). Python analiza texto libre subjetivo. Los datos numericos concretos deben pesar mas que la narrativa del candidato. La ponderacion puede ajustarse; la arquitectura lo soporta facilmente.

**¿Puede el admin ignorar la decision de la IA?**
Si, siempre. La IA solo recomienda. El admin revisa la justificacion y decide. `final_human_decision` puede ser `ACCEPTED` aunque la IA sugiriera `REJECT`, o viceversa. Esta diferencia queda registrada en `admin_notes` para auditoria. Es el principio de "Human-in-the-Loop".

---

### Tests

**¿Por que tienen 728 tests unitarios y solo 44 E2E?**
Los tests tienen propositos distintos. Los unitarios son rapidos, prueban casos de borde y manejo de errores en completo aislamiento (mocks de repositorios). Los E2E son lentos, requieren la BD real y prueban que todos los modulos integran correctamente. La proporcion refleja la piramide de testing: muchos unitarios, pocos E2E que cubren los flujos principales.

**¿Como funcionan los tests unitarios en NestJS?**
`TestingModule` crea un modulo de prueba con dependencias mockeadas. En lugar del repositorio TypeORM real, se inyecta un objeto con `jest.fn()`:
```typescript
{ provide: getRepositoryToken(Inventory), useValue: { findOne: jest.fn(), save: jest.fn() } }
```
Esto permite probar la logica del servicio sin necesitar BD ni Redis.

**¿Por que Playwright para los E2E si no tiene browser?**
Playwright puede usarse solo como cliente HTTP sin levantar un navegador. En este proyecto hace requests directos a la API de produccion y verifica las respuestas JSON. Es mas potente que Supertest para E2E reales porque puede correr contra la URL de produccion con `API_BASE_URL=https://...`.

---

### Decisiones de diseno

**¿Que pasa si el inventario llega a valores negativos?**
Puede ocurrir en el proceso diario si el consumo supera la produccion. Es intencional: el inventario negativo es una senal de alerta critica. `alert_active` se activa automaticamente. El admin debe ver el dashboard, gestionar mejor los recursos o hacer un traslado. En operaciones manuales (exploraciones, traslados) se valida que haya inventario suficiente antes de ejecutar.

**¿Por que `max_capacity` puede ser NULL en la tabla camp?**
Para representar campamentos cuya capacidad maxima no ha sido establecida. La vista `vw_camp_population_summary` usa `CASE WHEN max_capacity IS NOT NULL` para evitar division por cero. La regla critica de IA que evalua `occupancyRate > 95%` simplemente no aplica para campamentos sin capacidad definida.

**¿Como se garantiza que el proceso diario no se ejecute dos veces con BullMQ?**
El job se registra con `jobId: 'daily-resources-job'` fijo en `onModuleInit()`. BullMQ en Redis usa ese ID para garantizar idempotencia: si ya existe un job repetitivo con ese ID, no crea uno nuevo. Con multiples instancias del servidor, todos llaman `queue.add()` en el inicio, pero BullMQ detecta que el job ya existe y lo ignora.

**¿Por que la ruta de admision `/ai/admissions/submit` es publica?**
Porque los candidatos que quieren ingresar al campamento no tienen cuenta en el sistema todavia. Es una solicitud externa. La ruta de tracking `/track/:code` tambien es publica para que el candidato pueda consultar el estado sin necesitar credenciales.

**¿Que pasa si dos administradores aprueban un traslado simultaneamente (race condition)?**
Existe un potencial race condition: ambos podrian leer `count(approvals) = 1` y ejecutar `departTransfer()` dos veces. En la implementacion actual no hay lock explicito. La solucion correcta seria un `SELECT FOR UPDATE` o lock optimista con campo `version`. Es un area de mejora conocida y documentada del proyecto.
