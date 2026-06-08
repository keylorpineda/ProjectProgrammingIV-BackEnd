import type { OnModuleInit } from "@nestjs/common";
import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Role } from "../entities/role.entity";
import { ROLES_CONFIG } from "../constants/roles.constants";

@Injectable()
export class RolesSeeder implements OnModuleInit {
  private readonly logger = new Logger(RolesSeeder.name);

  constructor(
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
  ) {}

  async onModuleInit() {
    try {
      await this.seedRoles();
    } catch (error) {
      this.logger.error("Error seeding roles", error);
    }
  }

  async seedRoles() {
    const existingRoles = await this.roleRepo.find();

    if (existingRoles.length > 0) {
      this.logger.log(`Roles already seeded (${existingRoles.length} found)`);
      return;
    }

    this.logger.log("Seeding roles...");

    const rolesToCreate = Object.entries(ROLES_CONFIG).map(([key, config]) => ({
      name: key,
      description: config.description,
    }));

    const createdRoles = await this.roleRepo.save(rolesToCreate);

    this.logger.log(`Successfully seeded ${createdRoles.length} roles:`);
    createdRoles.forEach((r) => {
      this.logger.log(`   - ${r.name}: ${r.description}`);
    });
  }

  async resetRoles() {
    this.logger.warn("Resetting roles...");
    await this.roleRepo.delete({});
    await this.seedRoles();
  }
}
