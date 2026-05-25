-- 1. CAMPS
INSERT INTO camp (id, name, active, created_at, updated_at)
VALUES 
(9001, 'Bunker-04', true, NOW(), NOW()),
(9002, 'Bunker-Alpha', true, NOW(), NOW()),
(9003, 'Bunker-Beta', true, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- 2. PROFESSIONS
INSERT INTO profession (id, name, created_at, updated_at)
VALUES 
(9001, 'Doctor', NOW(), NOW()),
(9002, 'Soldier', NOW(), NOW()),
(9003, 'Farmer', NOW(), NOW()),
(9004, 'Engineer', NOW(), NOW()),
(9005, 'Scavenger', NOW(), NOW())
ON CONFLICT DO NOTHING;

-- 3. ROLES (Only inserting camp_leader just in case it's missing, using high ID)
INSERT INTO role (id, name, created_at, updated_at)
VALUES 
(9002, 'camp_leader', NOW(), NOW())
ON CONFLICT DO NOTHING;

-- 4. PERSONS (6 survivors with different statuses)
INSERT INTO person (id, profession_id, first_name, last_name, status, identification_code, can_work, previous_skills, notes, created_at, updated_at)
VALUES 
(9001, 9001, 'Marcus', 'Vance', 'active', 'SURVIVOR-DOC-1', true, 'Cirugía Avanzada, Farmacología', null, NOW(), NOW()),
(9002, 9002, 'Sarah', 'Connor', 'active', 'SURVIVOR-SOL-1', true, 'Tácticas de Guerrilla, Armas Pesadas', null, NOW(), NOW()),
(9003, 9003, 'Dave', 'Miller', 'injured', 'SURVIVOR-FAR-1', false, 'Cultivo Hidropónico, Suelos', 'Fractura en pierna izquierda por caída en conducto', NOW(), NOW()),
(9004, 9004, 'Elena', 'Rostova', 'active', 'SURVIVOR-ENG-1', true, 'Reactores de Fusión, Sistemas de Ventilación', null, NOW(), NOW()),
(9005, 9005, 'Kaelen', 'Thorne', 'sick', 'SURVIVOR-SCA-1', false, 'Exploración Urbana, Rastreo', 'Infección pulmonar leve por exposición al exterior', NOW(), NOW()),
(9006, 9003, 'John', 'Doe', 'active', 'SURVIVOR-FAR-2', true, 'Sistemas de Riego', null, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- 5. USER_ACCOUNT (Link persons to camp)
-- For marcus_vance (admin, assuming role id 1 exists)
-- For sarah_connor (camp_leader, role id 9002)
-- For dave_miller (worker, assuming role id 2 exists)
INSERT INTO user_account (id, role_id, camp_id, person_id, username, email, password_hash, created_at, updated_at)
VALUES 
(9001, 1, 9001, 9001, 'marcus_vance', 'marcus@camp.com', 'hashed_pass_mock', NOW(), NOW()),
(9002, 9002, 9001, 9002, 'sarah_connor', 'sarah@camp.com', 'hashed_pass_mock', NOW(), NOW()),
(9003, 2, 9001, 9003, 'dave_miller', 'dave@camp.com', 'hashed_pass_mock', NOW(), NOW()),
(9004, 2, 9001, 9004, 'elena_rostova', 'elena@camp.com', 'hashed_pass_mock', NOW(), NOW()),
(9005, 2, 9001, 9005, 'kaelen_thorne', 'kaelen@camp.com', 'hashed_pass_mock', NOW(), NOW()),
(9006, 2, 9001, 9006, 'john_doe_9006', 'john9006@camp.com', 'hashed_pass_mock', NOW(), NOW())
ON CONFLICT DO NOTHING;

-- 6. RESOURCES
INSERT INTO resource (id, name, category, unit, created_at, updated_at)
VALUES 
(9001, 'Raciones de Emergencia (MRE)', 'Food', 'Cajas', NOW(), NOW()),
(9002, 'Agua Purificada de Filtro', 'Water', 'Litros', NOW(), NOW()),
(9003, 'Antitoxinas y Antibióticos', 'Medicine', 'Viales', NOW(), NOW()),
(9004, 'Munición Calibre 5.56mm', 'Ammo', 'Cartuchos', NOW(), NOW()),
(9005, 'Combustible Diésel (Generador)', 'Fuel', 'Bidones', NOW(), NOW()),
(9006, 'Acero de Refuerzo Bunker', 'Materials', 'Vigas', NOW(), NOW())
ON CONFLICT DO NOTHING;

-- 7. INVENTORY (camp_id = 9001)
INSERT INTO inventory (camp_id, resource_id, current_quantity, minimum_stock_required, alert_active, created_at, updated_at)
VALUES 
(9001, 9001, 420, 600, true, NOW(), NOW()),
(9001, 9002, 820, 500, false, NOW(), NOW()),
(9001, 9003, 12, 25, true, NOW(), NOW()),
(9001, 9004, 1450, 1000, false, NOW(), NOW()),
(9001, 9005, 80, 120, true, NOW(), NOW()),
(9001, 9006, 350, 300, false, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- 8. INTERCAMP_REQUEST (Transfers)
INSERT INTO intercamp_request (id, camp_origin_id, camp_destination_id, type, status, request_date, notes, created_at, updated_at)
VALUES 
(9001, 9002, 9001, 'Antitoxinas y Antibióticos', 'pending', NOW() - INTERVAL '1 day', 'Solicitud médica de emergencia', NOW(), NOW()),
(9002, 9001, 9003, 'Raciones de Emergencia (MRE)', 'approved', NOW() - INTERVAL '12 hours', 'Intercambio pactado por repuestos de filamento', NOW(), NOW()),
(9003, 9002, 9001, 'Combustible Diésel (Generador)', 'arrived', NOW() - INTERVAL '3 days', 'Logística de soporte regular', NOW(), NOW())
ON CONFLICT DO NOTHING;
