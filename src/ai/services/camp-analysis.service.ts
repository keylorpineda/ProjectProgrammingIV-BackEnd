import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Camp } from "../../camps/entities/camp.entity";
import { ProductionService } from "../../users/services/production.service";
import { ProfessionsService } from "../../users/services/professions.service";
import { PersonsService } from "../../users/services/persons.service";

export interface CampContext {
  population: number;
  capacity: number;
  occupancyRate: number;
  balance: { food: number; water: number };
  professionsNeeded: Array<{ profession: string; deficit: number }>;
  criticalProfession?: string;
  criticalDeficit: number;
}

@Injectable()
export class CampAnalysisService {
  constructor(
    @InjectRepository(Camp)
    private readonly campRepo: Repository<Camp>,
    private readonly productionService: ProductionService,
    private readonly professionsService: ProfessionsService,
    private readonly personsService: PersonsService,
  ) {}

  async analyzeCampContext(campId: number): Promise<CampContext> {
    const camp = await this.campRepo.findOne({ where: { id: campId } });
    if (!camp) {
      throw new NotFoundException(`Camp with ID ${campId} not found`);
    }

    const population = await this.personsService.countPersonsByCamp(
      campId,
      true,
    );
    const balance = await this.productionService.calculateDailyBalance(campId);
    const professionsNeeded =
      await this.professionsService.getProfessionsNeedingWorkers();

    const occupancyRate = camp.max_capacity
      ? (population / camp.max_capacity) * 100
      : 0;

    let criticalProfession: string | undefined;
    let criticalDeficit = 0;

    for (const prof of professionsNeeded) {
      if (prof.deficit > criticalDeficit) {
        criticalDeficit = prof.deficit;
        criticalProfession = prof.profession.name;
      }
    }

    return {
      population,
      capacity: camp.max_capacity || 0,
      occupancyRate,
      balance: {
        food: balance.balance.food,
        water: balance.balance.water,
      },
      professionsNeeded: professionsNeeded.map((p) => ({
        profession: p.profession.name,
        deficit: p.deficit,
      })),
      criticalProfession,
      criticalDeficit,
    };
  }
}
