import { AppDataSource } from "./data-source";
import { Role } from "../users/entities/role.entity";
import { UserAccount } from "../users/entities/user-account.entity";
import { Camp } from "../camps/entities/camp.entity";
import { Profession } from "../users/entities/profession.entity";
import { Person } from "../users/entities/person.entity";
import { Resource } from "../resources/entities/resource.entity";
import { Inventory } from "../resources/entities/inventory.entity";
import { InventoryMovement } from "../resources/entities/inventory-movement.entity";
import { Exploration } from "../explorations/entities/exploration.entity";
import { ExplorationPerson } from "../explorations/entities/exploration-person.entity";
import { IntercampRequest } from "../transfers/entities/intercamp-request.entity";
import { AiAdmission } from "../ai/entities/ai-admission.entity";
import {
  PersonStatus,
  PROFESSIONS_CONFIG,
} from "../users/constants/professions.constants";
import * as bcrypt from "bcrypt";

async function seedDummyData() {
  console.log("Conectando a la base de datos...");
  await AppDataSource.initialize();

  const roleRepo = AppDataSource.getRepository(Role);
  const userRepo = AppDataSource.getRepository(UserAccount);
  const campRepo = AppDataSource.getRepository(Camp);
  const professionRepo = AppDataSource.getRepository(Profession);
  const personRepo = AppDataSource.getRepository(Person);
  const resourceRepo = AppDataSource.getRepository(Resource);
  const inventoryRepo = AppDataSource.getRepository(Inventory);
  const movementRepo = AppDataSource.getRepository(InventoryMovement);
  const explorationRepo = AppDataSource.getRepository(Exploration);
  const explorationPersonRepo = AppDataSource.getRepository(ExplorationPerson);
  const requestRepo = AppDataSource.getRepository(IntercampRequest);
  const aiAdmissionRepo = AppDataSource.getRepository(AiAdmission);

  // 1. Camps
  console.log("Verificando campamentos...");
  let campAlfa = await campRepo.findOne({ where: { name: "BUNKER ALFA" } });
  if (!campAlfa) {
    campAlfa = await campRepo.save(
      campRepo.create({
        name: "BUNKER ALFA",
        location_description: "Sector 7G",
        max_capacity: 100,
        active: true,
      }),
    );
  }
  let campBeta = await campRepo.findOne({ where: { name: "CAMP BETA" } });
  if (!campBeta) {
    campBeta = await campRepo.save(
      campRepo.create({
        name: "CAMP BETA",
        location_description: "Zona Muerta",
        max_capacity: 50,
        active: true,
      }),
    );
  }

  // 2. Roles
  console.log("Verificando roles...");
  const roleNames = [
    "admin",
    "worker",
    "resource_manager",
    "travel_manager",
    "camp_leader",
    "camp_manager",
  ];
  const roles: Record<string, Role> = {};
  for (const name of roleNames) {
    let role = await roleRepo.findOne({ where: { name } });
    if (!role) {
      role = await roleRepo.save(
        roleRepo.create({ name, description: `Role ${name}` }),
      );
    }
    roles[name] = role;
  }

  // 3. Professions
  console.log("Verificando profesiones...");
  const professions: Record<string, Profession> = {};
  for (const [key, config] of Object.entries(PROFESSIONS_CONFIG)) {
    let prof = await professionRepo.findOne({ where: { name: config.name } });
    if (!prof) {
      prof = await professionRepo.save(
        professionRepo.create({
          name: config.name,
          can_explore: config.can_explore,
          minimum_active_required: config.minimum_required,
        }),
      );
    }
    professions[config.name] = prof;
  }

  // 4. Resources & Inventory
  console.log("Insertando recursos e inventarios...");
  const resourceTypes = [
    {
      name: "Comida Enlatada",
      unit: "unidades",
      category: "food",
      description: "Raciones de supervivencia",
    },
    {
      name: "Agua Purificada",
      unit: "litros",
      category: "water",
      description: "Agua lista para beber",
    },
    {
      name: "Antibióticos",
      unit: "cajas",
      category: "medical",
      description: "Penicilina y amoxicilina",
    },
    {
      name: "Balas 9mm",
      unit: "cartuchos",
      category: "weapons",
      description: "Munición estándar",
    },
    {
      name: "Gasolina",
      unit: "galones",
      category: "materials",
      description: "Para vehículos y generadores",
    },
  ];
  const resources: Record<string, Resource> = {};
  for (const rt of resourceTypes) {
    let res = await resourceRepo.findOne({ where: { name: rt.name } });
    if (!res) res = await resourceRepo.save(resourceRepo.create(rt));
    resources[rt.category] = res;

    // Inventory para Alfa
    let invAlfa = await inventoryRepo.findOne({
      where: { camp_id: Number(campAlfa.id), resource_id: Number(res.id) },
    });
    if (!invAlfa) {
      await inventoryRepo.save(
        inventoryRepo.create({
          camp_id: Number(campAlfa.id),
          resource_id: Number(res.id),
          current_quantity: Math.floor(Math.random() * 500) + 100,
          minimum_stock_required: 50,
          alert_active: false,
          last_update: new Date(),
        }),
      );
    }
    // Inventory para Beta
    let invBeta = await inventoryRepo.findOne({
      where: { camp_id: Number(campBeta.id), resource_id: Number(res.id) },
    });
    if (!invBeta) {
      await inventoryRepo.save(
        inventoryRepo.create({
          camp_id: Number(campBeta.id),
          resource_id: Number(res.id),
          current_quantity: Math.floor(Math.random() * 300) + 50,
          minimum_stock_required: 50,
          alert_active: false,
          last_update: new Date(),
        }),
      );
    }
  }

  // 5. Persons & Users
  console.log("Creando sobrevivientes...");
  const names = [
    "Carlos",
    "Maria",
    "John",
    "Sarah",
    "Miguel",
    "Lucia",
    "Jorge",
    "Ana",
    "Luis",
    "Elena",
    "Pedro",
    "Sofia",
    "Diego",
    "Carmen",
    "Javier",
  ];
  const lastNames = [
    "Gomez",
    "Perez",
    "Smith",
    "Connor",
    "Rodriguez",
    "Fernandez",
    "Lopez",
    "Martinez",
    "Gonzalez",
    "Diaz",
  ];
  const password_hash = await bcrypt.hash("123456", 10);

  const allPersons: Person[] = [];

  for (let i = 1; i <= 20; i++) {
    const fn = names[Math.floor(Math.random() * names.length)];
    const ln = lastNames[Math.floor(Math.random() * lastNames.length)];
    const username = `${fn.toLowerCase()}.${ln.toLowerCase()}${i}`;

    const profKeys = Object.keys(professions);
    const prof =
      professions[profKeys[Math.floor(Math.random() * profKeys.length)]];
    const camp = i <= 10 ? campAlfa : campBeta;

    let user = await userRepo.findOne({ where: { username } });
    if (!user) {
      user = await userRepo.save(
        userRepo.create({
          username,
          email: `${username}@doomsday.com`,
          password_hash,
          role: roles["worker"],
          camp: camp,
        }),
      );
    }

    let person = await personRepo.findOne({
      where: { userAccount: { id: Number(user.id) } },
    });
    if (!person) {
      person = await personRepo.save(
        personRepo.create({
          first_name: fn,
          last_name: ln,
          birth_date: new Date(
            1980 + Math.floor(Math.random() * 20),
            Math.floor(Math.random() * 12),
            1,
          ),
          status: PersonStatus.ACTIVE,
          join_date: new Date(),
          can_work: true,
          identification_code: `SURVIVOR-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
          profession: prof,
          userAccount: user,
        }),
      );
    }
    allPersons.push(person);
  }

  // 6. Explorations
  console.log("Generando expediciones...");
  const exps = [
    { name: "Búsqueda Hospital Centro", status: "COMPLETED", camp: campAlfa },
    { name: "Reconocimiento Zona Este", status: "ONGOING", camp: campAlfa },
    { name: "Patrulla Bosque", status: "SCHEDULED", camp: campBeta },
  ];

  for (const ex of exps) {
    let exp = await explorationRepo.findOne({ where: { name: ex.name } });
    if (!exp) {
      exp = await explorationRepo.save(
        explorationRepo.create({
          camp_id: Number(ex.camp.id),
          name: ex.name,
          destination_description: `Coordenadas: ${Math.floor(Math.random() * 100)}N, ${Math.floor(Math.random() * 100)}W`,
          estimated_days: Math.floor(Math.random() * 5) + 1,
          status: ex.status,
          departure_date: new Date(),
        }),
      );

      // Asignar 2 personas
      const avail = allPersons.filter(
        (p) => p.userAccount?.camp?.id === ex.camp.id,
      );
      if (avail.length >= 2) {
        await explorationPersonRepo.save(
          explorationPersonRepo.create({
            exploration_id: Number(exp.id),
            person_id: Number(avail[0].id),
            is_leader: true,
          }),
        );
        await explorationPersonRepo.save(
          explorationPersonRepo.create({
            exploration_id: Number(exp.id),
            person_id: Number(avail[1].id),
            is_leader: false,
          }),
        );
      }
    }
  }

  // 7. AiAdmissions
  console.log("Generando historial de Admisiones IA...");
  for (let i = 1; i <= 5; i++) {
    const fn = names[Math.floor(Math.random() * names.length)];
    const ln = lastNames[Math.floor(Math.random() * lastNames.length)];
    const existing = await aiAdmissionRepo.findOne({
      where: { candidate_data: { identification_code: `CAND-${i}` } as any },
    });
    if (!existing) {
      await aiAdmissionRepo.save(
        aiAdmissionRepo.create({
          tracking_code: `TRACK-DUMMY-${i}-${Date.now()}`,
          camp_id: Number(campAlfa.id),
          candidate_data: {
            first_name: fn,
            last_name: ln,
            age: 25 + i,
            skills: ["survival"],
            identification_code: `CAND-${i}`,
          },
          score: 70 + Math.floor(Math.random() * 20),
          justification: "El candidato presenta buenas aptitudes físicas.",
          status: i % 2 === 0 ? "ACCEPTED" : "REJECTED",
          final_human_decision: i % 2 === 0 ? "ACCEPTED" : "REJECTED",
          review_date: new Date(),
        }),
      );
    }
  }

  // 8. Intercamp Requests
  console.log("Generando Solicitudes de Traslado...");
  const req = await requestRepo.findOne({
    where: {
      camp_origin_id: Number(campAlfa.id),
      camp_destination_id: Number(campBeta.id),
    },
  });
  if (!req) {
    await requestRepo.save(
      requestRepo.create({
        camp_origin_id: Number(campAlfa.id),
        camp_destination_id: Number(campBeta.id),
        type: "person_transfer",
        status: "pending",
        request_date: new Date(),
        notes: "Necesitamos refuerzos en Beta por ataque zombie reciente.",
      }),
    );
  }

  console.log("¡Datos generados exitosamente!");
  await AppDataSource.destroy();
}

seedDummyData().catch((err) => {
  console.error("Error generating dummy data:", err);
  process.exit(1);
});
