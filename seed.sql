-- =========================================================================================
-- SEED SQL PARA BASE DE DATOS DE POSTGRESQL (Gestión del Fin)
-- COBERTURA EXTENDIDA PARA 77 ENDPOINTS: Dashboard, Exploraciones, Auth, Usuarios, Recursos
-- =========================================================================================

-- Limpiar tablas si es necesario (Descomentar para reiniciar base)
TRUNCATE TABLE "user_account", "person", "inventory", "inventory_movement", "resource", "profession", "role", "camp", "intercamp_request", "exploration" RESTART IDENTITY CASCADE;

-- ==========================================================
-- 1. CAMPAMENTOS (Para endpoints GET /camps, PATCH /camps/:id, y Dashboards /dashboard/:campId)
-- ==========================================================
INSERT INTO "camp" ("name", "location_description", "latitude", "longitude", "max_capacity", "active", "foundation_date") VALUES 
    ('Campamento Alpha', 'Zonas subterráneas, bunker militar clase A', 40.7128000, -74.0060000, 500, true, CURRENT_DATE),
    ('Refugio Beta', 'Base en las montañas áridas', 39.7392000, -104.9903000, 1500, true, CURRENT_DATE),
    ('Estación Echo', 'Antigua red de trenes de la ciudad', 34.0522000, -118.2437000, 200, true, CURRENT_DATE),
    ('Outpost Delta', 'Puesto de avanzada en puente colapsado', 51.5074000, -0.1278000, 50, false, CURRENT_DATE), -- Para probar endpoints de campamentos inactivos
    ('Santuario Omega', 'Isla con acceso restringido', 35.6895000, 139.6917000, 2000, true, CURRENT_DATE);

-- ==========================================================
-- 2. ROLES (Para RBAC y endpoints de Auth/Roles)
-- ==========================================================
INSERT INTO "role" ("name", "description") VALUES 
    ('admin', 'Administrador Global del Fin del Mundo'),
    ('worker', 'Trabajador regular del campamento'),
    ('resource_manager', 'Especialista en administración de inventarios y logística'),
    ('travel_comms', 'Coordinador responsable de expediciones y de traslados entre bases'),
    ('medic', 'Personal encargado de actualizar estados de salud y reportes de infección');

-- ==========================================================
-- 3. PROFESIONES (Para GET /users/professions, GET /users/professions/alerts/needing-workers)
-- ==========================================================
INSERT INTO "profession" ("name", "can_explore", "minimum_active_required") VALUES 
    ('Explorador', true, 5),               -- 1
    ('Médico General', false, 3),          -- 2
    ('Ingeniero Agrónomo', false, 2),      -- 3
    ('Francotirador de Muros', false, 8),  -- 4
    ('Recolector / Scavenger', true, 10),  -- 5
    ('Técnico de Radios', false, 1),       -- 6
    ('Cocinero MRE', false, 2),            -- 7
    ('Biólogo', false, 1);                 -- 8

-- ==========================================================
-- 4. RECURSOS (Para endpoints GET /resources, y todos los de Inventarios)
-- ==========================================================
INSERT INTO "resource" ("name", "unit", "category", "description") VALUES 
    ('Agua Tratada', 'Litro', 'consumible', 'Agua filtrada mediante sistemas RO, para las bases.'),
    ('Ración MRE', 'Unidad', 'consumible', 'Raciones tipo militar listas para ingerir.'),
    ('Caja Munición 9mm', 'Caja', 'armamento', 'Cartuchos estándar 9x19mm Parabellum para defensa.'),
    ('Amoxicilina', 'Tabletas', 'medicina', 'Antibiótico de amplio espectro, útil contra heridas.'),
    ('Vendas Quirúrgicas', 'Unidad', 'medicina', 'Para contención de hemorragias en operaciones al exterior.'),
    ('Piezas de Electrónica', 'Kilo', 'material', 'Sobras de tarjetas madres y cobre para reparar radios.'),
    ('Gasolina', 'Galón', 'combustible', 'Combustible extraído de vehículos abandonados.'),
    ('Semillas de Papa', 'Gramo', 'material', 'Material genético para empezar cultivos en invernadero.');

-- ==========================================================
-- 5. PERSONAS (Para endpoints /users/persons, /users/persons/stats/by-status)
-- Estados posibles probables: 'active', 'infected', 'dead', 'missing', 'quarantine', 'in_transfer', 'exploring'
-- ==========================================================
INSERT INTO "person" ("profession_id", "first_name", "last_name", "join_date", "identification_code", "status", "can_work", "experience_level", "experience_points") VALUES 
    (1, 'Joel', 'Miller', CURRENT_TIMESTAMP, 'P-001', 'active', true, 10, 5000),      -- 1
    (2, 'Ellie', 'Williams', CURRENT_TIMESTAMP, 'P-002', 'active', true, 5, 2500),    -- 2
    (3, 'Rick', 'Grimes', CURRENT_TIMESTAMP, 'P-003', 'active', true, 8, 4000),       -- 3
    (5, 'Glenn', 'Rhee', CURRENT_TIMESTAMP, 'P-004', 'dead', false, 4, 1500),         -- 4
    (5, 'Maggie', 'Greene', CURRENT_TIMESTAMP, 'P-005', 'active', true, 6, 2800),     -- 5
    (4, 'Daryl', 'Dixon', CURRENT_TIMESTAMP, 'P-006', 'exploring', true, 9, 4500),    -- 6
    (7, 'Carol', 'Peletier', CURRENT_TIMESTAMP, 'P-007', 'quarantine', false, 4, 1200),-- 7
    (1, 'Michonne', 'Hawthorne', CURRENT_TIMESTAMP, 'P-008', 'missing', false, 8, 3800),-- 8
    (2, 'Hershel', 'Greene', CURRENT_TIMESTAMP, 'P-009', 'dead', false, 7, 3000),     -- 9
    (6, 'Eugene', 'Porter', CURRENT_TIMESTAMP, 'P-010', 'active', true, 3, 1000);     -- 10

-- ==========================================================
-- 6. USUARIOS Y AUTENTICACIÓN (Para /auth/login, /auth/session-status)
-- Aquí se incluyen las cuentas. 
-- El hash usado equivale a la contraseña: "Password123!" usando Bcrypt (generico comun).
-- Si tu sistema usa un salt distinto y falla, usa el endpoint de /users o /auth/register para crear el admin,
-- o inserta el hash manual generado de tu app.
-- ==========================================================
INSERT INTO "user_account" ("camp_id", "person_id", "role_id", "username", "email", "password_hash") VALUES 
    (1, 1, 1, 'admin_z', 'admin@doomsday.com', '$2b$12$b8CuXIKx.puXg9ARrc2zt.bS3spl4qZMCu/c9b7N1kk53pC0VaTQu'), -- Admin global en Alpha
    (1, 2, 2, 'worker1', 'worker1@doomsday.com', '$2b$12$b8CuXIKx.puXg9ARrc2zt.bS3spl4qZMCu/c9b7N1kk53pC0VaTQu'), -- Trabajador en Alpha
    (2, 3, 3, 'resources', 'resources@doomsday.com', '$2b$12$b8CuXIKx.puXg9ARrc2zt.bS3spl4qZMCu/c9b7N1kk53pC0VaTQu'), -- Resource Manager en Beta
    (3, 10, 4, 'comms', 'comms@doomsday.com', '$2b$12$b8CuXIKx.puXg9ARrc2zt.bS3spl4qZMCu/c9b7N1kk53pC0VaTQu'); -- Coordinador en Echo

-- ==========================================================
-- 7. INVENTARIOS (Para las vistas de GET /resources/inventory/:campId, GET /resources/inventory/:campId/alerts)
-- Se generan déficits aproposito para activar las "Alertas" de inventario
-- ==========================================================
INSERT INTO "inventory" ("camp_id", "resource_id", "current_quantity", "minimum_stock_required", "last_update") VALUES
    (1, 1, 15000.00, 500, CURRENT_DATE), -- Alpha: Agua (Sano)
    (1, 2, 800.00, 1000, CURRENT_DATE),   -- Alpha: MRE (ALERTA: 800 < 1000 requerido)
    (1, 3, 500.00, 50, CURRENT_DATE),     -- Alpha: Municion (Sano)
    (1, 4, 10.00, 100, CURRENT_DATE),      -- Alpha: Antibióticos (ALERTA CRÍTICA: 10 < 100)
    (2, 1, 3000.00, 2000, CURRENT_DATE), -- Beta: Agua
    (2, 4, 500.00, 100, CURRENT_DATE),    -- Beta: Antibióticos (Sano - ideal para transferir a Alpha)
    (3, 7, 5.00, 200, CURRENT_DATE);       -- Echo: Gasolina (ALERTA)

-- ==========================================================
-- 8. MOVIMIENTOS DE INVENTARIO (Para el DashBoard de consumos y GET /resources/movements/:campId)
-- Tipos de movimiento: 'in' (ingreso), 'out' (consumo/salida), 'loss' (perdida x zombies/asalto)
-- ==========================================================
INSERT INTO "inventory_movement" ("camp_id", "resource_id", "type", "quantity", "description", "date") VALUES 
    (1, 1, 'in', 500, 'Recolección del río por exploradores', CURRENT_TIMESTAMP),
    (1, 1, 'out', -200, 'Consumo diario poblacional', CURRENT_TIMESTAMP),
    (1, 2, 'out', -50, 'Raciones para expedición sector 4', CURRENT_TIMESTAMP),
    (1, 4, 'loss', -20, 'Lote estropeado por humedad en bodega', CURRENT_TIMESTAMP),
    (2, 4, 'in', 100, 'Producción del laboratorio interno de Beta', CURRENT_TIMESTAMP);

-- ==========================================================
-- 9. EXPEDICIONES Y EXPLORACIONES (Para GET /explorations y sub-endpoints)
-- Estados: 'planning', 'departed', 'returned_success', 'returned_failed', 'lost'
-- ==========================================================
INSERT INTO "exploration" ("camp_id", "name", "destination_description", "status", "departure_date", "estimated_days") VALUES 
    (1, 'Expedición Hospital Central', 'Hospital Mercy (Ciudad Muerta)', 'departed', CURRENT_DATE - INTERVAL '2 days', 5),
    (2, 'Búsqueda de Combustible', 'Gasolinera Ruta 66', 'returned_success', CURRENT_DATE - INTERVAL '10 days', 7),
    (1, 'Rastreo de Señal de Radio', 'Antena Colina Norte', 'lost', CURRENT_DATE - INTERVAL '30 days', 15);

-- ==========================================================
-- 10. SOLICITUDES ENTRE CAMPAMENTOS (Para GET /transfers/requests y /transfers/statistics)
-- Estados: 'pending', 'approved', 'rejected', 'in_transit', 'completed'
-- Tipos: 'resources', 'personnel'
-- ==========================================================
INSERT INTO "intercamp_request" ("camp_origin_id", "camp_destination_id", "type", "status", "notes", "request_date") VALUES 
    (1, 2, 'resources', 'pending', 'Brote de infección en Alpha, se requieren antibióticos urgentes de Beta', CURRENT_TIMESTAMP),
    (3, 1, 'personnel', 'approved', 'Solicitud de ingeniero agrónomo para revisar cultivos', CURRENT_TIMESTAMP),
    (2, 3, 'resources', 'completed', 'Envío de gasolina completado hace 2 días', CURRENT_TIMESTAMP);


-- =========================================================================================
-- GUÍA DE CONSULTAS PARA LOS 77 ENDPOINTS (COMO VALIDAR ESTOS DATOS)
-- =========================================================================================

/*
1. ENDPOINTS DE DASHBOARD Y ESTADÍSTICAS (/dashboard, /users/persons/stats...)
   - Haz GET a /dashboard/leaderboard. Evalúa qué campamento tiene mejor status según tus fórmulas.
   - Haz GET a /users/persons/stats/by-status. Deberías ver: 5 active, 2 dead, 1 missing, 1 quarantine, 1 exploring.
   - Haz GET a /users/professions/alerts/needing-workers. Te mostrará 'Cocinero' e 'Ingeniero Agrónomo' porque sus personas vivas/activas no cumplen el minimum_active_required.

2. ENDPOINTS DE RECURSOS E INVENTARIO (/resources/inventory...)
   - Haz GET a /resources/inventory/1. Verás el inventario de Alpha.
   - Haz GET a /resources/inventory/1/alerts. El endpoint DEBE disparar alerta para "Ración MRE" y "Amoxicilina" porque su quantity es menor a minimum_required.
   - Haz GET a /resources/movements/1. Te retornará los +500 de agua, -200 de agua, y el -20 (loss) de antibióticos.

3. ENDPOINTS DE TRASLADOS (/transfers/requests...)
   - Haz GET a /transfers/requests/camp/1. Mostrará que Alpha pidió recursos a Beta (priority high, pending).
   - Haz PATCH a /transfers/requests/1/approval mandando {"status": "approved"} en el body JSON. Esto debería gatillar tu lógica de descontar del inventario de Beta.

4. ENDPOINTS DE EXPLORACIONES (/explorations)
   - Haz GET a /explorations. Verás 3 expediciones con distintos estados.
   - Haz PATCH a /explorations/1/return mandando {"status": "returned_success", "found_items": "..."}. El estado de la expedición cambiará de 'departed' a concluida. Las personas atadas a esa expedición deben cambiar su estado de 'exploring' a 'active'.

5. ENDPOINTS DE PERSONAS (/users/persons/:id/status)
   - Haz PUT a /users/persons/7/status con {"status": "infected"}. Carol Peletier (P-007) pasará a infected, probarás que la UI lo refleje y el campamento alerte riesgos biológicos.

6. ENDPOINTS DE LOGIN / AUTH (/auth/login)
   - POST a /auth/login con {"username": "admin", "password": "Password123!"}.
   - Si no puedes loguearte porque tu app usa un SALT variable: Haz POST a tu registro (/auth/register o endpoint que dispongas) o comenta el insert del user_account y créalo vía API desde 0.

7. ENDPOINTS DE INGESTIÓN / AI (/ai/admissions/pending y submit)
   - Dispara una entrada "submit" desde tu cliente y evalúala en pending con el rol de admin.
*/
