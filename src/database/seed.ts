import { AppDataSource } from "./data-source";
import { Role } from "../users/entities/role.entity";
import { UserAccount } from "../users/entities/user-account.entity";
import { Camp } from "../camps/entities/camp.entity";
import * as bcrypt from "bcrypt";

async function seed() {
  console.log("Initialize database connection...");
  await AppDataSource.initialize();

  const roleRepo = AppDataSource.getRepository(Role);
  const userRepo = AppDataSource.getRepository(UserAccount);
  const campRepo = AppDataSource.getRepository(Camp);

  console.log("Seeding Roles...");
  const roleNames = [
    "admin",
    "worker",
    "resource_manager",
    "travel_manager",
    "camp_leader",
  ];
  const roles: Role[] = [];

  for (const name of roleNames) {
    let role = await roleRepo.findOne({ where: { name } });
    if (!role) {
      role = roleRepo.create({ name, description: `Role for ${name}` });
      await roleRepo.save(role);
    }
    roles.push(role);
  }

  console.log("Seeding Camps...");
  // Fix Postgres sequence if out of sync due to manual inserts
  await AppDataSource.query(
    `SELECT setval(pg_get_serial_sequence('user_account', 'id'), coalesce(max(id),0) + 1, false) FROM user_account;`,
  );
  let campAlfa = await campRepo.findOne({ where: { name: "BUNKER ALFA" } });
  if (!campAlfa) {
    campAlfa = campRepo.create({
      name: "BUNKER ALFA",
      location_description: "Sector 7G — Cuenca del Río Virilla",
      max_capacity: 100,
      active: true,
      latitude: 9.9281,
      longitude: -84.0907,
    });
  } else {
    campAlfa.latitude = 9.9281;
    campAlfa.longitude = -84.0907;
    campAlfa.location_description = "Sector 7G — Cuenca del Río Virilla";
  }
  await campRepo.save(campAlfa);

  let campBeta = await campRepo.findOne({ where: { name: "CAMP BETA" } });
  if (!campBeta) {
    campBeta = campRepo.create({
      name: "CAMP BETA",
      location_description: "Zona Muerta — Ruinas de Cartago",
      max_capacity: 50,
      active: true,
      latitude: 9.8647,
      longitude: -83.9197,
    });
  } else {
    campBeta.latitude = 9.8647;
    campBeta.longitude = -83.9197;
    campBeta.location_description = "Zona Muerta — Ruinas de Cartago";
  }
  await campRepo.save(campBeta);

  console.log("Seeding Users...");
  const password_hash = await bcrypt.hash("123456", 10);

  const usersToCreate = [
    {
      username: "admin",
      email: "admin@doomsday.com",
      roleName: "admin",
      camp: campAlfa,
    },
    {
      username: "leader",
      email: "leader@doomsday.com",
      roleName: "camp_leader",
      camp: campAlfa,
    },
    {
      username: "worker",
      email: "worker@doomsday.com",
      roleName: "worker",
      camp: campAlfa,
    },
    {
      username: "manager",
      email: "manager@doomsday.com",
      roleName: "resource_manager",
      camp: undefined,
    },
    {
      username: "resources",
      email: "resources@doomsday.com",
      roleName: "resource_manager",
      camp: campAlfa,
    },
    {
      username: "travel",
      email: "travel@doomsday.com",
      roleName: "travel_manager",
      camp: campAlfa,
    },
  ];

  for (const u of usersToCreate) {
    let user = await userRepo.findOne({
      where: { username: u.username },
      relations: ["role"],
    });
    const role = roles.find((r) => r.name === u.roleName);

    if (!user) {
      user = userRepo.create({
        username: u.username,
        email: u.email,
        password_hash,
        role: role,
        camp: u.camp,
      });
      await userRepo.save(user);
      console.log(`Created user: ${u.username} (${u.roleName})`);
    } else {
      console.log(
        `User ${u.username} already exists. Forcing password and role update...`,
      );
      user.password_hash = password_hash;
      if (role) user.role = role;
      if (u.camp) user.camp = u.camp;
      await userRepo.save(user);
    }
  }

  console.log("Seeding finished successfully.");
  await AppDataSource.destroy();
}

seed().catch((err) => {
  console.error("Error during seeding:", err);
  process.exit(1);
});
