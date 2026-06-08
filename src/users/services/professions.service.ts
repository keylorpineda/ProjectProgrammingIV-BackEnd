import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Profession } from "../entities/profession.entity";
import type { CreateProfessionDto } from "../dto/create-profession.dto";
import { PersonsService } from "./persons.service";
import { WORKING_STATUSES } from "../constants/professions.constants";

@Injectable()
export class ProfessionsService {
  constructor(
    @InjectRepository(Profession)
    private readonly professionRepo: Repository<Profession>,
    private readonly personsService: PersonsService,
  ) {}

  async findAll(): Promise<Profession[]> {
    return this.professionRepo.find({
      relations: ["persons"],
    });
  }

  async findById(id: number): Promise<Profession> {
    const profession = await this.professionRepo.findOne({
      where: { id },
      relations: ["persons"],
    });

    if (!profession) {
      throw new NotFoundException(`Profession with ID ${id} not found`);
    }

    return profession;
  }

  async create(dto: CreateProfessionDto): Promise<Profession> {
    const profession = this.professionRepo.create(dto);
    return this.professionRepo.save(profession);
  }

  async checkMinimumWorkers(
    professionId: number,
    excludePersonId?: number,
  ): Promise<{
    needsWorkers: boolean;
    currentWorkers: number;
    minimumRequired: number;
  }> {
    const profession = await this.findById(professionId);

    const activeWorkers = await this.personsService.countActiveWorkers(
      professionId,
      excludePersonId,
    );

    const needsWorkers = activeWorkers < profession.minimum_active_required;

    if (needsWorkers) {
      console.warn(
        `?? ALERTA: Profesión "${profession.name}" necesita trabajadores. ` +
          `Actual: ${activeWorkers}, Mínimo: ${profession.minimum_active_required}`,
      );
    }

    return {
      needsWorkers,
      currentWorkers: activeWorkers,
      minimumRequired: profession.minimum_active_required,
    };
  }

  private async getProfessionsWithWorkerCounts(): Promise<
    Array<Profession & { activeWorkerCount: number }>
  > {
    return (await this.professionRepo
      .createQueryBuilder("p")
      .loadRelationCountAndMap(
        "p.activeWorkerCount",
        "p.persons",
        "worker",
        (qb) =>
          qb
            .andWhere("worker.can_work = :canWork", { canWork: true })
            .andWhere("worker.status IN (:...statuses)", {
              statuses: WORKING_STATUSES,
            }),
      )
      .getMany()) as Array<Profession & { activeWorkerCount: number }>;
  }

  async getProfessionsNeedingWorkers(): Promise<
    Array<{
      profession: Profession;
      currentWorkers: number;
      minimumRequired: number;
      deficit: number;
    }>
  > {
    const professions = await this.getProfessionsWithWorkerCounts();

    return professions
      .filter((p) => p.activeWorkerCount < p.minimum_active_required)
      .map((p) => ({
        profession: p,
        currentWorkers: p.activeWorkerCount,
        minimumRequired: p.minimum_active_required,
        deficit: p.minimum_active_required - p.activeWorkerCount,
      }));
  }

  async getProfessionsWithExcess(): Promise<
    Array<{
      profession: Profession;
      currentWorkers: number;
      minimumRequired: number;
      excess: number;
    }>
  > {
    const professions = await this.getProfessionsWithWorkerCounts();

    return professions
      .filter((p) => p.activeWorkerCount > p.minimum_active_required)
      .map((p) => ({
        profession: p,
        currentWorkers: p.activeWorkerCount,
        minimumRequired: p.minimum_active_required,
        excess: p.activeWorkerCount - p.minimum_active_required,
      }));
  }
}
