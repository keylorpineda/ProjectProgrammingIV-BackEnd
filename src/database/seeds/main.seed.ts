/**
 * SEED SCRIPT — 5000+ registros
 *
 * Sube imágenes reales a Cloudinary, limpia la BD y genera datos realistas
 * para probar todas las funcionalidades del sistema.
 *
 * Uso:
 *   npx ts-node -r tsconfig-paths/register src/database/seeds/main.seed.ts
 */
import "reflect-metadata";
import * as path from "path";
import * as dotenv from "dotenv";
import * as bcrypt from "bcrypt";
import { v2 as cloudinary } from "cloudinary";
import { DataSource } from "typeorm";
import { fakerES as faker } from "@faker-js/faker";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

// ── Entity imports ────────────────────────────────────────────────────────
import { Camp } from "../../camps/entities/camp.entity";
import { Person } from "../../users/entities/person.entity";
import { UserAccount } from "../../users/entities/user-account.entity";
import { Role } from "../../users/entities/role.entity";
import { Profession } from "../../users/entities/profession.entity";
import { Resource } from "../../resources/entities/resource.entity";
import { Inventory } from "../../resources/entities/inventory.entity";
import { InventoryMovement } from "../../resources/entities/inventory-movement.entity";
import { Exploration } from "../../explorations/entities/exploration.entity";
import { ExplorationPerson } from "../../explorations/entities/exploration-person.entity";
import { ExplorationResource } from "../../explorations/entities/exploration-resource.entity";
import { IntercampRequest } from "../../transfers/entities/intercamp-request.entity";
import { RequestResourceDetail } from "../../transfers/entities/request-resource-detail.entity";
import { Approval } from "../../transfers/entities/approval.entity";
import { AiAdmission } from "../../ai/entities/ai-admission.entity";
import { PersonAchievement } from "../../users/entities/person-achievement.entity";
import { UserAsset } from "../../users/entities/user-asset.entity";
import { Asset } from "../../users/entities/asset.entity";
import { DailyProduction } from "../../resources/entities/daily-production.entity";
import { AuditLog } from "../../common/entities/audit-log.entity";
import { TemporaryAssignment } from "../../users/entities/temporary-assignment.entity";
import { RequestPersonDetail } from "../../transfers/entities/request-person-detail.entity";
import { LoginAttempt } from "../../auth/entities/login-attempt.entity";
import { Session } from "../../auth/entities/session.entity";

// ── DataSource ────────────────────────────────────────────────────────────
const ds = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || "5432"),
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  entities: [
    Camp,
    Person,
    UserAccount,
    Role,
    Profession,
    Resource,
    Inventory,
    InventoryMovement,
    Exploration,
    ExplorationPerson,
    ExplorationResource,
    IntercampRequest,
    RequestResourceDetail,
    Approval,
    AiAdmission,
    PersonAchievement,
    UserAsset,
    Asset,
    DailyProduction,
    AuditLog,
    TemporaryAssignment,
    RequestPersonDetail,
    LoginAttempt,
    Session,
  ],
  synchronize: false,
  ssl: { rejectUnauthorized: false },
  extra: { max: 5, idleTimeoutMillis: 30000 },
});

// ── Cloudinary config ─────────────────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ── Helpers ───────────────────────────────────────────────────────────────
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const rand = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;
const randDate = (start: Date, end: Date) =>
  new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

const log = (msg: string) => console.log(`\n[SEED] ${msg}`);
const step = (msg: string) => process.stdout.write(`\r  → ${msg}          `);

// ── Static data ───────────────────────────────────────────────────────────
const CAMPS_DATA = [
  {
    name: "Refugio San José",
    location: "San José, Barrio Amón",
    lat: 9.9364,
    lng: -84.0833,
    cap: 200,
  },
  {
    name: "Bastión Alajuela",
    location: "Alajuela, zona norte",
    lat: 10.0162,
    lng: -84.2147,
    cap: 180,
  },
  {
    name: "Fortaleza Cartago",
    location: "Cartago, Barva de Cartago",
    lat: 9.8671,
    lng: -83.9199,
    cap: 150,
  },
  {
    name: "Ciudadela Heredia",
    location: "Heredia, centro histórico",
    lat: 9.9998,
    lng: -84.1177,
    cap: 160,
  },
  {
    name: "Campamento Guanacaste",
    location: "Liberia, Guanacaste",
    lat: 10.6335,
    lng: -85.4397,
    cap: 140,
  },
  {
    name: "Puerto Sobreviviente",
    location: "Puntarenas, muelle central",
    lat: 9.9774,
    lng: -84.8287,
    cap: 120,
  },
  {
    name: "Colonia Caribe",
    location: "Limón, zona portuaria",
    lat: 9.9908,
    lng: -83.0363,
    cap: 130,
  },
  {
    name: "Valle del Sur",
    location: "Pérez Zeledón, San Isidro",
    lat: 9.3665,
    lng: -83.6524,
    cap: 110,
  },
  {
    name: "Volcán Base",
    location: "La Fortuna, Arenal",
    lat: 10.4686,
    lng: -84.6432,
    cap: 100,
  },
  {
    name: "Costa Refuge",
    location: "Jacó, Garabito",
    lat: 9.6179,
    lng: -84.6288,
    cap: 120,
  },
  {
    name: "Península Norte",
    location: "Nicoya, Guanacaste",
    lat: 10.1496,
    lng: -85.4522,
    cap: 100,
  },
  {
    name: "Bahía Quepos",
    location: "Quepos, Puntarenas",
    lat: 9.4324,
    lng: -84.1638,
    cap: 90,
  },
  {
    name: "Río Turrialba",
    location: "Turrialba, Cartago",
    lat: 9.9003,
    lng: -83.6802,
    cap: 110,
  },
  {
    name: "Delta Sur",
    location: "Palmar Norte, Osa",
    lat: 8.9529,
    lng: -83.4671,
    cap: 80,
  },
  {
    name: "Frontera Norte",
    location: "Upala, Alajuela",
    lat: 10.8966,
    lng: -85.0147,
    cap: 90,
  },
];

const PERSON_STATUSES_WEIGHTED = [
  "active",
  "active",
  "active",
  "active",
  "active",
  "active",
  "active",
  "sick",
  "injured",
  "idle",
  "resting",
  "exploring",
];

const MOVEMENT_TYPES = [
  "manual_in",
  "manual_in",
  "manual_out",
  "daily_production",
  "daily_consumption",
  "exploration_out",
  "manual_in",
  "daily_production",
];

const MOVEMENT_DESCS: Record<string, string[]> = {
  manual_in: [
    "Suministros recibidos",
    "Donación de recursos",
    "Recolección exitosa",
    "Compra de provisiones",
  ],
  manual_out: [
    "Consumo de emergencia",
    "Distribución de raciones",
    "Préstamo a otro sector",
    "Pérdida por deterioro",
  ],
  daily_production: [
    "Producción diaria del turno mañana",
    "Producción turno tarde",
    "Producción nocturna",
  ],
  daily_consumption: [
    "Consumo diario del campamento",
    "Ración diaria distribuida",
    "Consumo por habitantes",
  ],
  exploration_out: [
    "Suministros para exploración norte",
    "Recursos para misión exterior",
    "Provisiones de exploración",
  ],
};

const TRANSFER_STATUSES = [
  "pending",
  "approved",
  "in_transit",
  "completed",
  "rejected",
  "cancelled",
];

const EXPLORATION_STATUSES = [
  "scheduled",
  "in_progress",
  "completed",
  "cancelled",
];

const ADMISSION_DECISION_STATUSES = [
  "PENDING_REVIEW",
  "PENDING_REVIEW",
  "APPROVED",
  "APPROVED",
  "APPROVED",
  "REJECTED",
  "REJECTED",
];

const ACHIEVEMENT_NAMES = [
  "PRIMER_TRABAJO",
  "EXPLORADOR_NATO",
  "GUARDIAN_DEL_AGUA",
  "COSECHADOR_EXPERTO",
  "MEDICO_DE_CAMPO",
  "INGENIERO_SUPERVIVIENTE",
  "COCINERO_MAESTRO",
  "ALMACENISTA_EFICIENTE",
  "AGRICULTOR_RESILIENTE",
  "CONSTRUCTOR_HABIL",
  "VETERANO_PARAMO",
  "SOBREVIVIENTE_ELITE",
  "LIDER_NATURAL",
  "COLABORADOR_MODELO",
  "ESCUDO_DEL_CAMP",
];

const CANDIDATE_SKILLS = [
  "Mecánica básica",
  "Primeros auxilios",
  "Cultivo hidropónico",
  "Purificación de agua",
  "Carpintería de campo",
  "Navegación por estrellas",
  "Electrónica básica",
  "Caza y pesca",
  "Radio comunicaciones",
  "Defensa personal",
  "Medicina herbal",
  "Soldadura rústica",
  "Costura y reparación",
  "Química básica",
  "Agricultura orgánica",
  "Minería artesanal",
];

const CANDIDATE_JUSTIFICATIONS = [
  "Candidato con habilidades técnicas sólidas adecuadas para el campamento.",
  "Perfil de salud óptimo y buena adaptación al entorno.",
  "Experiencia previa en situaciones de supervivencia demostrada.",
  "Sin habilidades relevantes para las necesidades actuales del camp.",
  "Perfil compatible con las profesiones más demandadas.",
  "Decisión automática basada en puntaje mayor a 70.",
  "Rechazado por historial de conflictos grupales.",
  "Aprobado por unanimidad del comité de admisión.",
];

// Picsum IDs con buena apariencia para logos de campamentos
const CAMP_PICSUM_IDS = [
  10, 15, 28, 43, 76, 82, 103, 114, 167, 193, 212, 247, 291, 315, 358,
];

// ── Image upload ──────────────────────────────────────────────────────────
type ImgRef = { url: string; public_id: string };

async function uploadImg(
  srcUrl: string,
  folder: string,
  pid: string,
): Promise<ImgRef> {
  try {
    const r = await cloudinary.uploader.upload(srcUrl, {
      folder: `seed/${folder}`,
      public_id: pid,
      overwrite: true,
      transformation: [{ quality: "auto", fetch_format: "auto" }],
    });
    return { url: r.secure_url, public_id: r.public_id };
  } catch {
    return { url: "", public_id: "" };
  }
}

async function phaseImages(): Promise<{ persons: ImgRef[]; camps: ImgRef[] }> {
  log("FASE 1 — Subiendo imágenes a Cloudinary");

  const persons: ImgRef[] = [];
  const camps: ImgRef[] = [];

  // 15 hombres + 15 mujeres = 30 avatares de personas
  for (let i = 1; i <= 15; i++) {
    const img = await uploadImg(
      `https://randomuser.me/api/portraits/men/${i}.jpg`,
      "persons",
      `man_${i}`,
    );
    persons.push(img);
    step(`Avatares ${persons.length}/30`);
  }
  for (let i = 1; i <= 15; i++) {
    const img = await uploadImg(
      `https://randomuser.me/api/portraits/women/${i}.jpg`,
      "persons",
      `woman_${i}`,
    );
    persons.push(img);
    step(`Avatares ${persons.length}/30`);
  }

  // 15 logos de campamentos
  for (let i = 0; i < CAMP_PICSUM_IDS.length; i++) {
    const img = await uploadImg(
      `https://picsum.photos/id/${CAMP_PICSUM_IDS[i]}/600/400`,
      "camps",
      `camp_${i + 1}`,
    );
    camps.push(img);
    step(`Logos camps ${camps.length}/15`);
  }

  log(
    `✓ ${persons.filter((p) => p.url).length} avatares + ${camps.filter((c) => c.url).length} logos subidos`,
  );
  return { persons, camps };
}

// ── Cleanup ───────────────────────────────────────────────────────────────
async function phaseCleanup(): Promise<void> {
  log("FASE 2 — Limpiando base de datos");

  const tables = [
    "person_achievement",
    "user_asset",
    "audit_log",
    "daily_consumption",
    "daily_production",
    "inventory_movement",
    "inventory",
    "exploration_resource",
    "exploration_person",
    "exploration",
    "request_person_detail",
    "request_resource_detail",
    "approval",
    "intercamp_request",
    "ai_admission",
    "session",
    "login_attempt",
    "temporary_assignment",
    "user_account",
    "person",
    "camp",
  ];

  for (const t of tables) {
    await ds.query(`DELETE FROM "${t}"`).catch(() => {});
    step(`Tabla ${t} limpia`);
  }

  log(
    "✓ Base de datos limpia (roles, profesiones, recursos y assets intactos)",
  );
}

// ── Camps ─────────────────────────────────────────────────────────────────
async function phaseCamps(campImgs: ImgRef[]): Promise<Camp[]> {
  log("FASE 3 — Creando campamentos");
  const repo = ds.getRepository(Camp);

  const camps = CAMPS_DATA.map((c, i) =>
    repo.create({
      name: c.name,
      location_description: c.location,
      latitude: c.lat,
      longitude: c.lng,
      max_capacity: c.cap,
      active: true,
      foundation_date: randDate(new Date("2023-01-01"), new Date("2024-06-01")),
      logo_url: campImgs[i]?.url ?? "",
      logo_public_id: campImgs[i]?.public_id ?? "",
    }),
  );

  const saved = await repo.save(camps);
  log(`✓ ${saved.length} campamentos creados`);
  return saved;
}

// ── Persons + Accounts ────────────────────────────────────────────────────
async function phasePersonsAndAccounts(
  camps: Camp[],
  roles: Role[],
  professions: Profession[],
  personImgs: ImgRef[],
): Promise<{ persons: Person[]; accounts: UserAccount[] }> {
  log("FASE 4 — Creando personas y cuentas de usuario");

  const personRepo = ds.getRepository(Person);
  const accountRepo = ds.getRepository(UserAccount);
  const HASH = await bcrypt.hash("12345678", 10);

  const roleMap = Object.fromEntries(roles.map((r) => [r.name, r]));
  const allPersons: Person[] = [];
  const allAccounts: UserAccount[] = [];

  // ── Cuentas base en Refugio San José ─────────────────────────────────
  const mainCamp = camps[0];
  const BASE = [
    { username: "admin", email: "admin@refugio.cr", role: "admin" },
    { username: "travel", email: "travel@refugio.cr", role: "travel_manager" },
    {
      username: "resources",
      email: "resources@refugio.cr",
      role: "resource_manager",
    },
    { username: "leader", email: "leader@refugio.cr", role: "camp_leader" },
    { username: "worker", email: "worker@refugio.cr", role: "worker" },
  ];

  for (const b of BASE) {
    const person = await personRepo.save(
      personRepo.create({
        first_name: faker.person.firstName(),
        last_name: faker.person.lastName(),
        camp_id: Number(mainCamp.id),
        profession_id: Number(pick(professions).id),
        status: "active",
        can_work: true,
        experience_level: rand(3, 8),
        experience_points: rand(0, 99),
        expeditionsSurvived: rand(0, 5),
        join_date: new Date("2024-01-01"),
        birth_date: randDate(new Date("1980-01-01"), new Date("2000-01-01")),
        identification_code: `BASE-${b.username.toUpperCase()}`,
        photo_url: pick(personImgs).url,
        previous_skills: `${pick(CANDIDATE_SKILLS)}, ${pick(CANDIDATE_SKILLS)}`,
      }),
    );

    const account = await accountRepo.save(
      accountRepo.create({
        camp_id: Number(mainCamp.id),
        person_id: Number(person.id),
        role_id: Number(roleMap[b.role]?.id),
        username: b.username,
        email: b.email,
        password_hash: HASH,
        status: "ACTIVE",
        last_access: new Date(),
      }),
    );

    allPersons.push(person);
    allAccounts.push(account);
  }

  // ── Personas + cuentas por campamento ─────────────────────────────────
  const PERSONS_PER_CAMP = 88; // ~88 × 15 camps = 1320 personas
  const ROLE_DIST = [
    "admin",
    "travel_manager",
    "resource_manager",
    "resource_manager",
    "camp_leader",
    "camp_leader",
    "worker",
    "worker",
    "worker",
    "worker",
    "worker",
  ];

  for (let ci = 0; ci < camps.length; ci++) {
    const camp = camps[ci];

    // Batch de personas
    const batch: Partial<Person>[] = [];
    for (let pi = 0; pi < PERSONS_PER_CAMP; pi++) {
      const status = pick(PERSON_STATUSES_WEIGHTED);
      batch.push({
        first_name: faker.person.firstName(),
        last_name: faker.person.lastName(),
        last_name2: faker.person.lastName(),
        camp_id: Number(camp.id),
        profession_id: Number(pick(professions).id),
        status,
        can_work: status === "active",
        experience_level: rand(1, 10),
        experience_points: rand(0, 99),
        expeditionsSurvived: rand(0, 15),
        join_date: randDate(new Date("2023-06-01"), new Date()),
        birth_date: randDate(new Date("1965-01-01"), new Date("2005-01-01")),
        identification_code: `CR-${rand(100000, 999999)}`,
        photo_url: pick(personImgs).url,
        previous_skills: `${pick(CANDIDATE_SKILLS)}, ${pick(CANDIDATE_SKILLS)}`,
        notes: Math.random() > 0.7 ? faker.lorem.sentence() : undefined,
      });
    }

    const campPersons: Person[] = [];
    for (const b of chunk(batch, 50)) {
      const ins = await personRepo.save(b as Person[]);
      campPersons.push(...ins);
    }
    allPersons.push(...campPersons);

    // Cuentas de rol por camp (saltamos admin/travel/resources/leader en camp[0] que ya existen)
    const rolesToCreate = ci === 0 ? ROLE_DIST.slice(6) : ROLE_DIST;
    const accBatch: Partial<UserAccount>[] = [];

    for (let ri = 0; ri < rolesToCreate.length; ri++) {
      const roleName = rolesToCreate[ri];
      const person = campPersons[ri] ?? campPersons[0];
      const slug = camp.name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .slice(0, 10);

      accBatch.push({
        camp_id: Number(camp.id),
        person_id: Number(person.id),
        role_id: Number(roleMap[roleName]?.id),
        username: `${slug}_${roleName.replace("_", "")}_${ri}`,
        email: `${slug}.${roleName.replace("_", "")}.${ri}@seed.cr`,
        password_hash: HASH,
        status: "ACTIVE",
        last_access: randDate(new Date("2024-01-01"), new Date()),
        avatar_url: pick(personImgs).url,
      });
    }

    const savedAccs = await accountRepo.save(accBatch as UserAccount[]);
    allAccounts.push(...savedAccs);

    step(
      `Camp ${ci + 1}/${camps.length} — ${allPersons.length} personas, ${allAccounts.length} cuentas`,
    );
  }

  log(
    `✓ ${allPersons.length} personas y ${allAccounts.length} cuentas creadas`,
  );
  return { persons: allPersons, accounts: allAccounts };
}

// ── Inventory ─────────────────────────────────────────────────────────────
async function phaseInventory(
  camps: Camp[],
  resources: Resource[],
): Promise<void> {
  log("FASE 5 — Inicializando inventarios");
  const repo = ds.getRepository(Inventory);

  const entries: Partial<Inventory>[] = [];
  for (const camp of camps) {
    for (const res of resources) {
      const maxQty = rand(50, 500);
      const minReq = rand(20, 80);
      const quantity =
        Math.random() < 0.3 ? rand(0, minReq - 1) : rand(minReq, maxQty);
      entries.push({
        camp_id: Number(camp.id),
        resource_id: Number(res.id),
        current_quantity: quantity,
        minimum_stock_required: minReq,
        alert_active: quantity < minReq,
        last_update: new Date(),
      });
    }
  }

  for (const b of chunk(entries, 100)) {
    await repo.save(b as Inventory[]);
  }

  log(
    `✓ ${entries.length} entradas de inventario (${entries.filter((e) => e.alert_active).length} con alerta)`,
  );
}

// ── Inventory Movements ───────────────────────────────────────────────────
async function phaseMovements(
  camps: Camp[],
  resources: Resource[],
  accounts: UserAccount[],
): Promise<void> {
  log("FASE 6 — Generando movimientos de inventario (1500)");
  const repo = ds.getRepository(InventoryMovement);
  const TOTAL = 1500;
  const batch: Partial<InventoryMovement>[] = [];

  for (let i = 0; i < TOTAL; i++) {
    const camp = pick(camps);
    const res = pick(resources);
    const type = pick(MOVEMENT_TYPES);
    const desc = pick(MOVEMENT_DESCS[type] ?? ["Movimiento de inventario"]);
    const account = accounts[rand(0, accounts.length - 1)];

    batch.push({
      camp_id: Number(camp.id),
      resource_id: Number(res.id),
      quantity: rand(1, 100),
      type,
      description: desc,
      date: randDate(new Date("2024-01-01"), new Date()),
      user_id: Number(account.id),
    });

    if (i % 300 === 0) step(`Movimientos ${i}/${TOTAL}`);
  }

  for (const b of chunk(batch, 200)) {
    await repo.save(b as InventoryMovement[]);
  }

  log(`✓ ${TOTAL} movimientos de inventario creados`);
}

// ── Explorations ──────────────────────────────────────────────────────────
async function phaseExplorations(
  camps: Camp[],
  persons: Person[],
  accounts: UserAccount[],
  resources: Resource[],
): Promise<void> {
  log("FASE 7 — Generando exploraciones (150)");
  const expRepo = ds.getRepository(Exploration);
  const epRepo = ds.getRepository(ExplorationPerson);
  const erRepo = ds.getRepository(ExplorationResource);

  const personsByCamp: Record<number, Person[]> = {};
  for (const p of persons) {
    const cid = Number(p.camp_id);
    if (!personsByCamp[cid]) personsByCamp[cid] = [];
    personsByCamp[cid].push(p);
  }

  const accountsByCamp: Record<number, UserAccount[]> = {};
  for (const a of accounts) {
    const cid = Number(a.camp_id);
    if (!accountsByCamp[cid]) accountsByCamp[cid] = [];
    accountsByCamp[cid].push(a);
  }

  const foodRes = resources.find((r) => r.category === "food") ?? resources[0];
  const waterRes =
    resources.find((r) => r.category === "water") ??
    resources[1] ??
    resources[0];

  let total = 0;
  for (let i = 0; i < 150; i++) {
    const camp = pick(camps);
    const status = pick(EXPLORATION_STATUSES);
    const campId = Number(camp.id);
    const campPeople = personsByCamp[campId] ?? persons.slice(0, 10);
    const campAccts = accountsByCamp[campId] ?? accounts.slice(0, 3);
    const creator = pick(campAccts);
    const estDays = rand(2, 14);
    const depDate = randDate(new Date("2024-01-01"), new Date());

    const exploration = (await expRepo.save(
      expRepo.create({
        camp_id: campId,
        name: `Expedición ${faker.location.city()} #${i + 1}`,
        destination_description: faker.lorem.sentence(),
        departure_date: depDate,
        estimated_days: estDays,
        grace_days: rand(0, 2),
        real_return_date:
          status === "completed"
            ? new Date(depDate.getTime() + estDays * 86400000)
            : undefined,
        status,
        notes: Math.random() > 0.6 ? faker.lorem.sentence() : undefined,
        user_create_id: Number(creator.id),
      } as any),
    )) as unknown as Exploration;

    // 2–5 personas por exploración
    const expPersonCount = rand(2, 5);
    const shuffled = [...campPeople]
      .sort(() => Math.random() - 0.5)
      .slice(0, expPersonCount);
    for (let pi = 0; pi < shuffled.length; pi++) {
      await epRepo.save(
        epRepo.create({
          exploration_id: Number(exploration.id),
          person_id: Number(shuffled[pi].id),
          is_leader: pi === 0,
          return_confirmed: status === "completed",
        }),
      );
    }

    // Recursos de la exploración (comida y agua)
    if (foodRes) {
      await erRepo.save(
        erRepo.create({
          exploration_id: Number(exploration.id),
          resource_id: Number(foodRes.id),
          flow: "out",
          quantity: shuffled.length * estDays * 2,
        }),
      );
    }
    if (waterRes && waterRes.id !== foodRes?.id) {
      await erRepo.save(
        erRepo.create({
          exploration_id: Number(exploration.id),
          resource_id: Number(waterRes.id),
          flow: "out",
          quantity: shuffled.length * estDays * 3,
        }),
      );
    }

    total++;
    step(`Exploraciones ${total}/150`);
  }

  log(`✓ ${total} exploraciones creadas`);
}

// ── Transfers ─────────────────────────────────────────────────────────────
async function phaseTransfers(
  camps: Camp[],
  resources: Resource[],
  accounts: UserAccount[],
): Promise<void> {
  log("FASE 8 — Generando transferencias inter-campamento (200)");
  const reqRepo = ds.getRepository(IntercampRequest);
  const detailRepo = ds.getRepository(RequestResourceDetail);
  const approvalRepo = ds.getRepository(Approval);

  const accountsByCamp: Record<number, UserAccount[]> = {};
  for (const a of accounts) {
    const cid = Number(a.camp_id);
    if (!accountsByCamp[cid]) accountsByCamp[cid] = [];
    accountsByCamp[cid].push(a);
  }

  let total = 0;
  for (let i = 0; i < 200; i++) {
    const [origin, destination] = [...camps]
      .sort(() => Math.random() - 0.5)
      .slice(0, 2);
    const status = pick(TRANSFER_STATUSES);
    const reqDate = randDate(new Date("2024-01-01"), new Date());

    const request = (await reqRepo.save(
      reqRepo.create({
        camp_origin_id: Number(origin.id),
        camp_destination_id: Number(destination.id),
        type: "resources",
        status,
        request_date: reqDate,
        notes: Math.random() > 0.5 ? faker.lorem.sentence() : undefined,
        travel_days: rand(1, 5),
        departure_date: ["in_transit", "completed"].includes(status)
          ? new Date(reqDate.getTime() + 86400000)
          : undefined,
        arrival_date:
          status === "completed"
            ? new Date(reqDate.getTime() + rand(2, 7) * 86400000)
            : undefined,
      } as any),
    )) as unknown as IntercampRequest;

    // 1–3 recursos en el detalle
    const resCount = rand(1, 3);
    const resSlice = [...resources]
      .sort(() => Math.random() - 0.5)
      .slice(0, resCount);
    for (const res of resSlice) {
      const reqQty = rand(10, 100);
      await detailRepo.save(
        detailRepo.create({
          request_id: Number(request.id),
          resource_id: Number(res.id),
          requested_quantity: reqQty,
          approved_quantity: ["approved", "in_transit", "completed"].includes(
            status,
          )
            ? reqQty
            : undefined,
          received_quantity: status === "completed" ? reqQty : undefined,
        } as any),
      );
    }

    // Aprobación si corresponde
    if (["approved", "in_transit", "completed"].includes(status)) {
      const approver = pick(accountsByCamp[Number(origin.id)] ?? accounts);
      await approvalRepo.save(
        approvalRepo.create({
          user_id: Number(approver.id),
          entity_type: "intercamp_request",
          entity_id: Number(request.id),
          approval_date: new Date(reqDate.getTime() + 3600000),
          status: "approved",
        }),
      );
    }

    total++;
    if (total % 40 === 0) step(`Transfers ${total}/200`);
  }

  log(`✓ ${total} transferencias creadas`);
}

// ── AI Admissions ─────────────────────────────────────────────────────────
async function phaseAdmissions(
  camps: Camp[],
  professions: Profession[],
  accounts: UserAccount[],
): Promise<void> {
  log("FASE 9 — Generando admisiones AI (800)");
  const repo = ds.getRepository(AiAdmission);
  const TOTAL = 800;
  const batch: Partial<AiAdmission>[] = [];

  for (let i = 0; i < TOTAL; i++) {
    const camp = pick(camps);
    const status = pick(ADMISSION_DECISION_STATUSES);
    const isAuto = Math.random() > 0.4;
    const isArch = Math.random() > 0.8;
    const reviewer = pick(accounts);
    const subDate = randDate(new Date("2024-01-01"), new Date());
    const score = rand(20, 98);
    const profession = pick(professions);

    batch.push({
      tracking_code: `ADM-${Date.now()}-${i}`,
      camp_id: Number(camp.id),
      candidate_data: {
        first_name: faker.person.firstName(),
        last_name: faker.person.lastName(),
        age: rand(18, 55),
        skills: `${pick(CANDIDATE_SKILLS)}, ${pick(CANDIDATE_SKILLS)}`,
        health_status: pick(["excellent", "good", "fair", "poor"]),
        experience: faker.lorem.sentence(),
      },
      score,
      status,
      suggested_decision:
        status === "APPROVED"
          ? "APPROVE"
          : status === "REJECTED"
            ? "REJECT"
            : undefined,
      suggested_profession_id: Number(profession.id),
      justification: pick(CANDIDATE_JUSTIFICATIONS),
      raw_ai_response: { model: "gpt-4", confidence: score / 100 },
      reviewed_by_user_id:
        status !== "PENDING_REVIEW" ? Number(reviewer.id) : undefined,
      final_human_decision: status !== "PENDING_REVIEW" ? status : undefined,
      admin_notes: Math.random() > 0.7 ? faker.lorem.sentence() : undefined,
      submission_date: subDate,
      review_date:
        status !== "PENDING_REVIEW"
          ? new Date(subDate.getTime() + rand(1, 5) * 86400000)
          : undefined,
      is_auto_decision: isAuto,
      auto_decision_reason: isAuto ? pick(CANDIDATE_JUSTIFICATIONS) : undefined,
      archived: isArch,
      archived_at: isArch ? new Date() : undefined,
      archived_by_user_id: isArch ? Number(reviewer.id) : undefined,
    });

    if (i % 200 === 0) step(`Admisiones ${i}/${TOTAL}`);
  }

  for (const b of chunk(batch, 100)) {
    await repo.save(b as AiAdmission[]);
  }

  log(`✓ ${TOTAL} admisiones creadas`);
}

// ── Person Achievements + User Assets ────────────────────────────────────
async function phaseAchievementsAndAssets(
  persons: Person[],
  accounts: UserAccount[],
): Promise<void> {
  log("FASE 10 — Asignando achievements y badges");
  const achRepo = ds.getRepository(PersonAchievement);
  const assetRepo = ds.getRepository(UserAsset);

  // Achievements a personas
  const achBatch: Partial<PersonAchievement>[] = [];
  for (const person of persons) {
    const count = rand(1, 3);
    const names = [...ACHIEVEMENT_NAMES]
      .sort(() => Math.random() - 0.5)
      .slice(0, count);

    // Reglas de negocio: VETERANO_PARAMO solo si expedicionsSurvived >= 5
    const filtered = names.filter((n) => {
      if (n === "VETERANO_PARAMO")
        return (person.expeditionsSurvived ?? 0) >= 5;
      if (n === "SOBREVIVIENTE_ELITE")
        return (person.experience_level ?? 0) >= 5;
      return true;
    });

    for (const name of filtered) {
      achBatch.push({
        person_id: Number(person.id),
        achievement_name: name,
        obtained_at: randDate(new Date("2024-01-01"), new Date()),
      });
    }
  }

  for (const b of chunk(achBatch, 200)) {
    await achRepo.save(b as PersonAchievement[]);
  }

  // Badges (assets existentes) a user accounts
  const existingAssets = await ds
    .getRepository(Asset)
    .find({ where: { active: true } });

  if (existingAssets.length > 0) {
    const uaBatch: Partial<UserAsset>[] = [];
    for (const account of accounts) {
      const count = rand(1, Math.min(4, existingAssets.length));
      const badges = [...existingAssets]
        .sort(() => Math.random() - 0.5)
        .slice(0, count);
      for (const badge of badges) {
        uaBatch.push({
          user_account_id: Number(account.id),
          asset_id: Number(badge.id),
          relation_type: "badge",
          acquired_at: randDate(new Date("2024-01-01"), new Date()),
          is_displayed: Math.random() > 0.5,
        });
      }
    }
    for (const b of chunk(uaBatch, 200)) {
      await assetRepo.save(b as UserAsset[]).catch(() => {});
    }
    log(
      `✓ ${achBatch.length} achievements + ${uaBatch.length} badges asignados`,
    );
  } else {
    log(
      `✓ ${achBatch.length} achievements asignados (no hay badges en asset table)`,
    );
  }
}

// ── Daily Production ──────────────────────────────────────────────────────
async function phaseDailyProduction(
  camps: Camp[],
  professions: Profession[],
  resources: Resource[],
): Promise<void> {
  log("FASE 11 — Configurando producción diaria");
  const repo = ds.getRepository(DailyProduction);

  const producerProfs = professions.filter((p) =>
    ["Recolector", "Aguatero", "Explorador", "Cocinero", "Agricultor"].includes(
      p.name,
    ),
  );

  const foodRes = resources.find((r) => r.category === "food");
  const waterRes = resources.find((r) => r.category === "water");

  if (!foodRes && !waterRes) {
    log("✗ No hay recursos food/water — salteando producción diaria");
    return;
  }

  const entries: Partial<DailyProduction>[] = [];
  const seen = new Set<string>();

  for (const camp of camps) {
    for (const prof of producerProfs) {
      const targetRes = ["Aguatero", "Ingeniero"].includes(prof.name)
        ? waterRes
        : foodRes;
      if (!targetRes) continue;

      const key = `${camp.id}-${prof.id}-${targetRes.id}`;
      if (seen.has(key)) continue;
      seen.add(key);

      entries.push({
        camp_id: Number(camp.id),
        profession_id: Number(prof.id),
        resource_id: Number(targetRes.id),
        base_production: rand(3, 15),
      });
    }
  }

  for (const b of chunk(entries, 100)) {
    await repo.save(b as DailyProduction[]).catch(() => {});
  }

  log(`✓ ${entries.length} configuraciones de producción diaria`);
}

// ── Audit Log sample ──────────────────────────────────────────────────────
async function phaseAuditLogs(
  camps: Camp[],
  accounts: UserAccount[],
): Promise<void> {
  log("FASE 12 — Generando audit logs (300)");
  const repo = ds.getRepository(AuditLog);

  const ACTIONS = [
    "person_created",
    "inventory_updated",
    "exploration_created",
    "transfer_requested",
    "admission_reviewed",
    "camp_updated",
    "person_status_changed",
    "resource_added",
    "daily_process_executed",
  ];

  const batch: Partial<AuditLog>[] = [];
  for (let i = 0; i < 300; i++) {
    const camp = pick(camps);
    const account = pick(accounts);
    batch.push({
      user_id: Number(account.id),
      camp_id: Number(camp.id),
      action: pick(ACTIONS),
      entity_type: pick([
        "person",
        "camp",
        "exploration",
        "transfer",
        "admission",
      ]),
      entity_id: rand(1, 500),
      new_value: { detail: faker.lorem.sentence() },
      date: randDate(new Date("2024-01-01"), new Date()),
    });
  }

  for (const b of chunk(batch, 100)) {
    await repo.save(b as AuditLog[]);
  }

  log("✓ 300 audit logs creados");
}

// ── Stats ─────────────────────────────────────────────────────────────────
async function printStats(): Promise<void> {
  const tables = [
    ["camp", "Campamentos"],
    ["person", "Personas"],
    ["user_account", "Cuentas de usuario"],
    ["inventory", "Inventarios"],
    ["inventory_movement", "Movimientos inventario"],
    ["exploration", "Exploraciones"],
    ["exploration_person", "Personas en exploración"],
    ["intercamp_request", "Transfers"],
    ["request_resource_detail", "Detalles de transfer"],
    ["ai_admission", "Admisiones AI"],
    ["person_achievement", "Achievements"],
    ["user_asset", "Badges asignados"],
    ["daily_production", "Config. producción diaria"],
    ["audit_log", "Audit logs"],
  ];

  log("═══════════════ RESUMEN FINAL ═══════════════");
  let grandTotal = 0;
  for (const [table, label] of tables) {
    const [{ count }] = await ds
      .query(`SELECT COUNT(*) as count FROM "${table}"`)
      .catch(() => [{ count: "0" }]);
    grandTotal += parseInt(count);
    console.log(
      `  ${label.padEnd(30)} ${count.toString().padStart(6)} registros`,
    );
  }
  console.log(
    `\n  ${"TOTAL".padEnd(30)} ${grandTotal.toString().padStart(6)} registros`,
  );
  log("═════════════════════════════════════════════");
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n╔══════════════════════════════════════╗");
  console.log("║     SEED — ProjectProgrammingIV      ║");
  console.log("╚══════════════════════════════════════╝");

  await ds.initialize();
  log("Conexión a BD establecida");

  // Datos existentes que NO se tocan
  const roles = await ds.getRepository(Role).find();
  const professions = await ds.getRepository(Profession).find();
  const resources = await ds.getRepository(Resource).find();

  if (!roles.length)
    throw new Error("No hay roles en la BD. Ejecuta las migraciones primero.");
  if (!professions.length)
    throw new Error(
      "No hay profesiones en la BD. Ejecuta las migraciones primero.",
    );
  if (!resources.length)
    throw new Error(
      "No hay recursos en la BD. Ejecuta las migraciones primero.",
    );

  log(
    `Encontrado: ${roles.length} roles, ${professions.length} profesiones, ${resources.length} recursos`,
  );

  // Fases
  const { persons: personImgs, camps: campImgs } = await phaseImages();
  await phaseCleanup();
  const camps = await phaseCamps(campImgs);
  const { persons, accounts } = await phasePersonsAndAccounts(
    camps,
    roles,
    professions,
    personImgs,
  );
  await phaseInventory(camps, resources);
  await phaseMovements(camps, resources, accounts);
  await phaseExplorations(camps, persons, accounts, resources);
  await phaseTransfers(camps, resources, accounts);
  await phaseAdmissions(camps, professions, accounts);
  await phaseAchievementsAndAssets(persons, accounts);
  await phaseDailyProduction(camps, professions, resources);
  await phaseAuditLogs(camps, accounts);
  await printStats();

  await ds.destroy();
  console.log("\n[SEED] ✅ Completado exitosamente\n");
}

main().catch((err) => {
  console.error("\n[SEED] ❌ Error:", err.message);
  process.exit(1);
});
