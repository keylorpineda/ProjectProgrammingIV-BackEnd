import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, In, Repository } from "typeorm";
import { Exploration } from "./entities/exploration.entity";
import { ExplorationPerson } from "./entities/exploration-person.entity";
import { ExplorationResource } from "./entities/exploration-resource.entity";
import { Person } from "../users/entities/person.entity";
import { AuditLog } from "../common/entities/audit-log.entity";
import { ResourcesService } from "../resources/resources.service";
import { PythonAiService } from "../ai/services/python-ai.service";
import type { CreateExplorationDto } from "./dto/create-exploration.dto";
import type { ReturnExplorationDto } from "./dto/return-exploration.dto";
import { Inject } from "@nestjs/common";
import { REDIS_CLIENT } from "../redis/redis.constants";
import { Redis } from "ioredis";
import {
  DAILY_CONSUMPTION,
  PersonStatus,
} from "../users/constants/professions.constants";

@Injectable()
export class ExplorationsService {
  constructor(
    @InjectRepository(Exploration)
    private readonly explorationRepo: Repository<Exploration>,
    @InjectRepository(ExplorationPerson)
    private readonly expPersonRepo: Repository<ExplorationPerson>,
    @InjectRepository(ExplorationResource)
    private readonly expResourceRepo: Repository<ExplorationResource>,
    @InjectRepository(Person)
    private readonly personRepo: Repository<Person>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    private readonly resourcesService: ResourcesService,
    private readonly pythonAiService: PythonAiService,
    private readonly dataSource: DataSource,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  private async invalidateCampDashboardCache(campId: number): Promise<void> {
    try {
      const keys = await this.redis.keys(`dashboard:metrics:${campId}:*`);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (err) {
      // Ignore
    }
  }

  async create(
    dto: CreateExplorationDto,
    userId?: number,
  ): Promise<Exploration> {
    if (!dto.persons || dto.persons.length === 0) {
      throw new BadRequestException(
        "Debe asignar al menos una persona a la exploración",
      );
    }

    const persons = await this.personRepo.find({
      where: { id: In(dto.persons.map((p) => p.person_id)) },
      relations: ["profession", "userAccount"],
    });

    if (persons.length !== dto.persons.length) {
      const foundIds = persons.map((p) => Number(p.id));
      const missing = dto.persons
        .filter((p) => !foundIds.includes(p.person_id))
        .map((p) => p.person_id);
      throw new NotFoundException(
        `Personas no encontradas: ${missing.join(", ")}`,
      );
    }

    for (const person of persons) {
      if (!person.profession || !person.profession.can_explore) {
        throw new BadRequestException(
          `${person.first_name} ${person.last_name} (ID ${person.id}) no tiene profesión habilitada para explorar`,
        );
      }

      if (!person.can_work) {
        throw new BadRequestException(
          `${person.first_name} ${person.last_name} (ID ${person.id}) no puede trabajar actualmente (estado: ${person.status})`,
        );
      }

      if (person.status !== PersonStatus.ACTIVE) {
        throw new BadRequestException(
          `${person.first_name} ${person.last_name} (ID ${person.id}) no está activo (estado: ${person.status})`,
        );
      }

      const alreadyExploring = await this.expPersonRepo
        .createQueryBuilder("ep")
        .innerJoin("ep.exploration", "e")
        .where("ep.person_id = :pid", { pid: person.id })
        .andWhere("e.status IN (:...st)", { st: ["scheduled", "in_progress"] })
        .getCount();

      if (alreadyExploring > 0) {
        throw new ConflictException(
          `${person.first_name} ${person.last_name} (ID ${person.id}) ya está asignado a otra exploración activa`,
        );
      }
    }

    const totalDays = dto.estimated_days + (dto.grace_days ?? 0);
    const totalPersons = dto.persons.length;
    const foodNeeded =
      totalPersons * totalDays * DAILY_CONSUMPTION.FOOD_PER_PERSON;
    const waterNeeded =
      totalPersons * totalDays * DAILY_CONSUMPTION.WATER_PER_PERSON;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const exploration = this.explorationRepo.create({
        camp_id: dto.camp_id,
        name: dto.name,
        destination_description: dto.destination_description,
        departure_date: new Date(dto.departure_date),
        estimated_days: dto.estimated_days,
        grace_days: dto.grace_days ?? 0,
        status: "scheduled",
        user_create_id: userId,
      });
      const saved = await queryRunner.manager.save(exploration);

      const expPersons: ExplorationPerson[] = [];
      for (const pd of dto.persons) {
        const ep = this.expPersonRepo.create({
          exploration_id: Number(saved.id),
          person_id: pd.person_id,
          is_leader: pd.is_leader ?? false,
          return_confirmed: false,
        });
        expPersons.push(await queryRunner.manager.save(ep));
      }

      const allResources = await this.resourcesService.findAll(1, 1000);
      const foodResource = allResources.data.find((r) => r.category === "food");
      const waterResource = allResources.data.find(
        (r) => r.category === "water",
      );

      if (!foodResource || !waterResource) {
        throw new BadRequestException(
          "Recursos de comida y agua no configurados en el sistema",
        );
      }

      await this.resourcesService.createMovement(
        {
          camp_id: dto.camp_id,
          resource_id: Number(foodResource.id),
          quantity: foodNeeded,
          type: "exploration_out",
          description: `Raciones de comida para exploración "${dto.name}" (${totalPersons} personas x ${totalDays} días)`,
        },
        userId,
        queryRunner.manager,
      );

      await this.resourcesService.createMovement(
        {
          camp_id: dto.camp_id,
          resource_id: Number(waterResource.id),
          quantity: waterNeeded,
          type: "exploration_out",
          description: `Raciones de agua para exploración "${dto.name}" (${totalPersons} personas x ${totalDays} días)`,
        },
        userId,
        queryRunner.manager,
      );

      const foodExpRes = this.expResourceRepo.create({
        exploration_id: Number(saved.id),
        resource_id: Number(foodResource.id),
        flow: "out",
        quantity: foodNeeded,
      });
      await queryRunner.manager.save(foodExpRes);

      const waterExpRes = this.expResourceRepo.create({
        exploration_id: Number(saved.id),
        resource_id: Number(waterResource.id),
        flow: "out",
        quantity: waterNeeded,
      });
      await queryRunner.manager.save(waterExpRes);

      if (dto.resources) {
        for (const resDto of dto.resources) {
          await this.resourcesService.createMovement(
            {
              camp_id: dto.camp_id,
              resource_id: resDto.resource_id,
              quantity: resDto.quantity,
              type: "exploration_out",
              description: `Recurso adicional para exploración "${dto.name}"`,
            },
            userId,
            queryRunner.manager,
          );

          const er = this.expResourceRepo.create({
            exploration_id: Number(saved.id),
            resource_id: resDto.resource_id,
            flow: "out",
            quantity: resDto.quantity,
          });
          await queryRunner.manager.save(er);
        }
      }

      for (const person of persons) {
        person.status = PersonStatus.EXPLORING;
        person.can_work = false;
        await queryRunner.manager.save(person);
      }

      await queryRunner.manager.save(
        this.auditRepo.create({
          user_id: userId,
          camp_id: dto.camp_id,
          action: "exploration_created",
          entity_type: "exploration",
          entity_id: Number(saved.id),
          new_value: {
            name: dto.name,
            persons: dto.persons.length,
            estimated_days: dto.estimated_days,
            food_rations: foodNeeded,
            water_rations: waterNeeded,
          },
          date: new Date(),
        }),
      );

      await queryRunner.commitTransaction();

      await this.invalidateCampDashboardCache(dto.camp_id);

      return this.findById(Number(saved.id));
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async registerReturn(
    id: number,
    dto: ReturnExplorationDto,
    userId?: number,
  ): Promise<Exploration> {
    const exploration = await this.explorationRepo.findOne({
      where: { id },
      relations: [
        "explorationPersons",
        "explorationPersons.person",
        "explorationResources",
      ],
    });

    if (!exploration) {
      throw new NotFoundException(`Exploración con ID ${id} no encontrada`);
    }

    if (exploration.status === "completed") {
      throw new ConflictException("Esta exploración ya fue completada");
    }

    if (exploration.status === "cancelled") {
      throw new ConflictException("Esta exploración fue cancelada");
    }

    if (exploration.status === "scheduled") {
      exploration.status = "in_progress";
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    let transactionCommitted = false;

    try {
      exploration.real_return_date = new Date(dto.real_return_date);
      exploration.status = "completed";
      if (dto.notes) {
        exploration.notes = dto.notes;
      }
      await queryRunner.manager.save(exploration);

      for (const ep of exploration.explorationPersons) {
        ep.return_confirmed = true;
        await queryRunner.manager.save(ep);

        if (ep.person) {
          ep.person.status = PersonStatus.ACTIVE;
          ep.person.can_work = true;
          await queryRunner.manager.save(ep.person);
        }
      }

      if (dto.found_resources && dto.found_resources.length > 0) {
        for (const fr of dto.found_resources) {
          await this.resourcesService.createMovement(
            {
              camp_id: exploration.camp_id,
              resource_id: fr.resource_id,
              quantity: fr.quantity,
              type: "exploration_in",
              description: `Recursos encontrados en exploración "${exploration.name}"`,
            },
            userId,
            queryRunner.manager,
          );

          const er = this.expResourceRepo.create({
            exploration_id: Number(exploration.id),
            resource_id: fr.resource_id,
            flow: "in",
            quantity: fr.quantity,
          });
          await queryRunner.manager.save(er);
        }
      }

      await queryRunner.manager.save(
        this.auditRepo.create({
          user_id: userId,
          camp_id: exploration.camp_id,
          action: "exploration_return",
          entity_type: "exploration",
          entity_id: Number(exploration.id),
          new_value: {
            real_return_date: dto.real_return_date,
            found_resources: dto.found_resources?.length ?? 0,
          },
          date: new Date(),
        }),
      );

      await queryRunner.commitTransaction();
      transactionCommitted = true;

      await this.invalidateCampDashboardCache(exploration.camp_id);

      await this.awardAchievements(
        exploration.explorationPersons.map((ep) => String(ep.person_id)),
      );

      return this.findById(Number(exploration.id));
    } catch (err) {
      if (!transactionCommitted) {
        await queryRunner.rollbackTransaction();
      }
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  private async awardAchievements(personIds: string[]): Promise<void> {
    if (!personIds?.length) {
      return;
    }

    const normalizedIds = [
      ...new Set(personIds.map((id) => Number(id))),
    ].filter((id) => Number.isInteger(id));

    if (!normalizedIds.length) {
      return;
    }

    await this.personRepo.increment(
      { id: In(normalizedIds) },
      "expeditionsSurvived",
      1,
    );

    const persons = await this.personRepo.find({
      where: { id: In(normalizedIds) },
      relations: ["achievements"],
    });

    for (const person of persons) {
      const achievements = Array.isArray(person.achievements)
        ? person.achievements.map((pa: any) => pa.achievement_name)
        : [];

      let newExpPoints = person.experience_points + 50; // 50 XP por expedicion
      let newLevel = person.experience_level;
      if (newExpPoints >= 100) {
        newLevel += Math.floor(newExpPoints / 100);
        newExpPoints = newExpPoints % 100;
      }
      let addedAchievements = false;
      if (!person.achievements) person.achievements = [];
      if (
        person.expeditionsSurvived === 5 &&
        !achievements.includes("VETERANO_PARAMO")
      ) {
        person.achievements.push({
          achievement_name: "VETERANO_PARAMO",
        } as any);
        addedAchievements = true;
      }
      if (newLevel >= 5 && !achievements.includes("SOBREVIVIENTE_ELITE")) {
        person.achievements.push({
          achievement_name: "SOBREVIVIENTE_ELITE",
        } as any);
        addedAchievements = true;
      }

      if (addedAchievements) {
        person.experience_points = newExpPoints;
        person.experience_level = newLevel;
        await this.personRepo.save(person);
      } else {
        await this.personRepo.update(person.id, {
          experience_points: newExpPoints,
          experience_level: newLevel,
        });
      }
    }
  }

  async findAll(
    campId?: number,
    status?: string,
    page = 1,
    limit = 20,
  ): Promise<{
    data: Exploration[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(Math.max(1, limit), 100);
    const skip = (safePage - 1) * safeLimit;

    const qb = this.explorationRepo
      .createQueryBuilder("e")
      .leftJoinAndSelect("e.explorationPersons", "ep")
      .leftJoinAndSelect("ep.person", "person")
      .leftJoinAndSelect("person.profession", "profession")
      .leftJoinAndSelect("e.explorationResources", "er")
      .leftJoinAndSelect("er.resource", "resource")
      .leftJoinAndSelect("e.camp", "camp")
      .orderBy("e.departure_date", "DESC")
      .skip(skip)
      .take(safeLimit);

    if (campId) {
      qb.andWhere("e.camp_id = :campId", { campId });
    }

    if (status) {
      qb.andWhere("e.status = :status", { status });
    }

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
    };
  }

  async findById(id: number): Promise<Exploration> {
    const exploration = await this.explorationRepo.findOne({
      where: { id },
      relations: [
        "camp",
        "userCreate",
        "explorationPersons",
        "explorationPersons.person",
        "explorationPersons.person.profession",
        "explorationResources",
        "explorationResources.resource",
      ],
    });

    if (!exploration) {
      throw new NotFoundException(`Exploración con ID ${id} no encontrada`);
    }

    return exploration;
  }

  async cancel(id: number, userId?: number): Promise<Exploration> {
    const exploration = await this.explorationRepo.findOne({
      where: { id },
      relations: [
        "explorationPersons",
        "explorationPersons.person",
        "explorationResources",
      ],
    });

    if (!exploration) {
      throw new NotFoundException(`Exploración con ID ${id} no encontrada`);
    }

    if (exploration.status !== "scheduled") {
      throw new ConflictException(
        `Solo se pueden cancelar exploraciones programadas. Estado actual: ${exploration.status}`,
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const outResources = exploration.explorationResources.filter(
        (er) => er.flow === "out",
      );

      for (const er of outResources) {
        await this.resourcesService.createMovement(
          {
            camp_id: exploration.camp_id,
            resource_id: Number(er.resource_id),
            quantity: Number(er.quantity),
            type: "exploration_in",
            description: `Devolución por cancelación de exploración "${exploration.name}"`,
          },
          userId,
          queryRunner.manager,
        );
      }

      for (const ep of exploration.explorationPersons) {
        if (ep.person && ep.person.status === PersonStatus.EXPLORING) {
          ep.person.status = PersonStatus.ACTIVE;
          ep.person.can_work = true;
          await queryRunner.manager.save(ep.person);
        }
      }

      exploration.status = "cancelled";
      await queryRunner.manager.save(exploration);

      await queryRunner.manager.save(
        this.auditRepo.create({
          user_id: userId,
          camp_id: exploration.camp_id,
          action: "exploration_cancelled",
          entity_type: "exploration",
          entity_id: Number(exploration.id),
          new_value: { refunded_resources: outResources.length },
          date: new Date(),
        }),
      );

      await queryRunner.commitTransaction();

      await this.invalidateCampDashboardCache(exploration.camp_id);

      return this.findById(Number(exploration.id));
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async depart(id: number, userId?: number): Promise<Exploration> {
    const exploration = await this.explorationRepo.findOne({
      where: { id },
      relations: ["explorationPersons", "explorationPersons.person"],
    });

    if (!exploration) {
      throw new NotFoundException(`Exploración con ID ${id} no encontrada`);
    }

    if (exploration.status !== "scheduled") {
      throw new ConflictException(
        `Solo se pueden iniciar exploraciones programadas. Estado actual: ${exploration.status}`,
      );
    }

    // La llamada al microservicio de IA se hace ANTES de abrir la transacción
    // para no mantener locks de BD abiertos durante una operación de red.
    const expeditionPayload = this.buildExpeditionPayload(exploration);
    const expeditionAiAnalysis =
      await this.pythonAiService.analyzeExpedition(expeditionPayload);

    exploration.status = "in_progress";
    exploration.departure_date = new Date();

    // El cambio de estado y el registro de auditoría se confirman juntos para
    // que no quede uno sin el otro si algo falla.
    await this.dataSource.transaction(async (manager) => {
      await manager.save(exploration);
      await manager.save(
        manager.create(AuditLog, {
          user_id: userId,
          camp_id: exploration.camp_id,
          action: "exploration_departed",
          entity_type: "exploration",
          entity_id: Number(exploration.id),
          new_value: {
            departed_at: new Date(),
            expedition_ai_analysis: expeditionAiAnalysis,
          },
          date: new Date(),
        }),
      );
    });

    await this.invalidateCampDashboardCache(exploration.camp_id);

    return this.findById(Number(exploration.id));
  }

  private buildExpeditionPayload(
    exploration: Exploration,
  ): Record<string, unknown> {
    const explorers = (exploration.explorationPersons ?? []).map((ep) => ({
      id: Number(ep.person_id),
      role: ep.is_leader ? "leader" : "member",
      health_status: this.resolveHealthStatus(ep.person),
      achievements: Array.isArray(ep.person?.achievements)
        ? ep.person.achievements.map((pa: any) =>
            typeof pa === "string" ? pa : pa.achievement_name,
          )
        : [],
    }));

    const avgHealth = explorers.length
      ? explorers.reduce((sum, person) => sum + person.health_status, 0) /
        explorers.length
      : 75;

    const avgExperience = (exploration.explorationPersons ?? []).length
      ? (exploration.explorationPersons ?? []).reduce(
          (sum, ep) => sum + Number(ep.person?.experience_level ?? 1),
          0,
        ) / (exploration.explorationPersons ?? []).length
      : 1;

    return {
      objective: exploration.destination_description ?? exploration.name,
      difficulty: this.resolveDifficulty(exploration),
      group_size: explorers.length,
      leaders: explorers.filter((person) => person.role === "leader").length,
      avg_experience: Number(avgExperience.toFixed(2)),
      duration_days: Number(exploration.estimated_days ?? 1),
      avg_health: Number(avgHealth.toFixed(2)),
      explorers,
    };
  }

  private resolveHealthStatus(person?: Person): number {
    if (!person) {
      return 75;
    }

    if (person.status === PersonStatus.SICK) {
      return 40;
    }

    if (person.status === PersonStatus.INJURED) {
      return 60;
    }

    if (
      person.status === PersonStatus.EXPLORING ||
      person.status === PersonStatus.ACTIVE
    ) {
      return 85;
    }

    return person.can_work ? 80 : 70;
  }

  private resolveDifficulty(exploration: Exploration): number {
    const duration = Number(exploration.estimated_days ?? 1);

    if (duration >= 10) {
      return 5;
    }

    if (duration >= 7) {
      return 4;
    }

    if (duration >= 4) {
      return 3;
    }

    if (duration >= 2) {
      return 2;
    }

    return 1;
  }
}
