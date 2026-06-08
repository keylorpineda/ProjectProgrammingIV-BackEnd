import type { OnModuleInit } from "@nestjs/common";
import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as bcrypt from "bcrypt";
import { UserAccount } from "../entities/user-account.entity";
import { Role } from "../entities/role.entity";
import { UserRole } from "../constants/roles.constants";

const SALT_ROUNDS = 12;

@Injectable()
export class AdminSeeder implements OnModuleInit {
  private readonly logger = new Logger(AdminSeeder.name);

  constructor(
    @InjectRepository(UserAccount)
    private readonly userRepo: Repository<UserAccount>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
  ) {}

  async onModuleInit() {
    try {
      await this.seedAdmin();
    } catch (error) {
      this.logger.error("Error seeding admin user", error);
    }
  }

  async seedAdmin() {
    const adminUsername = "admin";

    const existing = await this.userRepo.findOne({
      where: { username: adminUsername },
    });

    if (existing) {
      this.logger.log("Admin user already exists, skipping seed.");
      return;
    }

    const adminRole = await this.roleRepo.findOne({
      where: { name: UserRole.ADMIN },
    });

    if (!adminRole) {
      this.logger.warn(
        "Admin role not found. Make sure RolesSeeder ran first.",
      );
      return;
    }

    const passwordHash = await bcrypt.hash("Admin@1234!", SALT_ROUNDS);

    const adminUser = this.userRepo.create({
      username: adminUsername,
      email: "admin@system.local",
      password_hash: passwordHash,
      role_id: Number(adminRole.id),
      last_access: new Date(),
    });

    await this.userRepo.save(adminUser);

    this.logger.log("✅ Admin user seeded successfully!");
    this.logger.log("   Username : admin");
    this.logger.log("   Email    : admin@system.local");
    this.logger.log("   Password : Admin@1234!");
    this.logger.log(`   Role     : ${adminRole.name} (${UserRole.ADMIN})`);
  }
}
