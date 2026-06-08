import type { OnModuleInit } from "@nestjs/common";
import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Profession } from "../entities/profession.entity";
import { PROFESSIONS_CONFIG } from "../constants/professions.constants";

@Injectable()
export class ProfessionsSeeder implements OnModuleInit {
  private readonly logger = new Logger(ProfessionsSeeder.name);

  constructor(
    @InjectRepository(Profession)
    private readonly professionRepo: Repository<Profession>,
  ) {}

  async onModuleInit() {
    try {
      await this.seedProfessions();
    } catch (error) {
      this.logger.error("Error seeding professions", error);
    }
  }

  async seedProfessions() {
    const existingProfessions = await this.professionRepo.find();

    if (existingProfessions.length > 0) {
      this.logger.log(
        `Professions already seeded (${existingProfessions.length} found)`,
      );
      return;
    }

    this.logger.log("Seeding professions...");

    const professionsToCreate = Object.values(PROFESSIONS_CONFIG).map(
      (config) => ({
        name: config.name,
        can_explore: config.can_explore,
        minimum_active_required: config.minimum_required,
      }),
    );

    const createdProfessions =
      await this.professionRepo.save(professionsToCreate);

    this.logger.log(
      `Successfully seeded ${createdProfessions.length} professions:`,
    );
    createdProfessions.forEach((p) => {
      this.logger.log(
        `   - ${p.name} (min: ${p.minimum_active_required}, can_explore: ${p.can_explore})`,
      );
    });
  }

  async resetProfessions() {
    this.logger.warn("Resetting professions...");
    await this.professionRepo.delete({});
    await this.seedProfessions();
  }
}
