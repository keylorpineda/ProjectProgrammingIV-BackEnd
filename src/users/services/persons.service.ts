import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Not, In } from "typeorm";
import { Redis } from "ioredis";
import { scanKeys } from "../../redis/redis.utils";
import { Person } from "../entities/person.entity";
import { Profession } from "../entities/profession.entity";
import type { CreatePersonDto } from "../dto/create-person.dto";
import type { UpdatePersonDto } from "../dto/update-person.dto";
import type { UpdatePersonStatusDto } from "../dto/update-person-status.dto";
import {
  PersonStatus,
  WORKING_STATUSES,
} from "../constants/professions.constants";
import { REDIS_CLIENT } from "../../redis/redis.constants";

const PERSONS_CACHE_TTL = 30; // segundos

@Injectable()
export class PersonsService {
  constructor(
    @InjectRepository(Person)
    private readonly personRepo: Repository<Person>,
    @InjectRepository(Profession)
    private readonly professionRepo: Repository<Profession>,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  private personsCacheKey(
    campId?: number,
    page = 1,
    limit = 20,
    search?: string,
  ) {
    return `persons:camp:${campId ?? "all"}:p${page}:l${limit}:s${search ?? ""}`;
  }

  private async invalidatePersonsCache(campId?: number): Promise<void> {
    try {
      const pattern = `persons:camp:${campId ?? "*"}:*`;
      const keys = await scanKeys(this.redis, pattern);
      if (keys.length > 0) await this.redis.del(...keys);
    } catch {
      // Ignore
    }
  }

  async create(dto: CreatePersonDto): Promise<Person> {
    if (dto.profession_id) {
      const profession = await this.professionRepo.findOne({
        where: { id: dto.profession_id },
      });
      if (!profession) {
        throw new NotFoundException(
          `Profession with ID ${dto.profession_id} not found`,
        );
      }
    }

    const person = this.personRepo.create({
      ...dto,
      status: PersonStatus.ACTIVE,
      can_work: true,
      join_date: new Date(),
      identification_code: this.generateIdentificationCode(),
    });

    const saved = await this.personRepo.save(person);
    await this.invalidatePersonsCache(dto.camp_id);
    return saved;
  }

  async findAll(
    campId?: number,
    page = 1,
    limit = 20,
    search?: string,
  ): Promise<{
    data: Person[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(Math.max(1, limit), 100);

    // Sólo cachear consultas sin búsqueda de texto libre
    if (!search) {
      try {
        const cacheKey = this.personsCacheKey(campId, safePage, safeLimit);
        const cached = await this.redis.get(cacheKey);
        if (cached) return JSON.parse(cached);
      } catch {
        /* Redis indisponible — continuar sin caché */
      }
    }

    const query = this.personRepo
      .createQueryBuilder("person")
      .leftJoinAndSelect("person.profession", "profession")
      .leftJoinAndSelect("person.userAccount", "userAccount")
      .leftJoinAndSelect("userAccount.camp", "camp")
      .leftJoinAndSelect("person.camp", "personCamp");

    if (campId) {
      query.where("(camp.id = :campId OR person.camp_id = :campId)", {
        campId,
      });
    }

    if (search) {
      const op = campId ? "andWhere" : "where";
      query[op](
        "(LOWER(person.first_name) LIKE :s OR LOWER(person.last_name) LIKE :s OR person.identification_code LIKE :s)",
        { s: `%${search.toLowerCase()}%` },
      );
    }

    const skip = (safePage - 1) * safeLimit;
    const [data, total] = await query
      .skip(skip)
      .take(safeLimit)
      .getManyAndCount();

    const result = {
      data,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
    };

    if (!search) {
      try {
        const cacheKey = this.personsCacheKey(campId, safePage, safeLimit);
        await this.redis.setex(
          cacheKey,
          PERSONS_CACHE_TTL,
          JSON.stringify(result),
        );
      } catch {
        /* Ignore */
      }
    }

    return result;
  }

  async findById(id: number): Promise<Person> {
    const person = await this.personRepo.findOne({
      where: { id },
      relations: ["profession", "userAccount", "userAccount.camp", "camp"],
    });

    if (!person) {
      throw new NotFoundException(`Person with ID ${id} not found`);
    }

    return person;
  }

  async update(id: number, dto: UpdatePersonDto): Promise<Person> {
    const person = await this.findById(id);

    if (dto.profession_id && dto.profession_id !== person.profession_id) {
      const profession = await this.professionRepo.findOne({
        where: { id: dto.profession_id },
      });
      if (!profession) {
        throw new NotFoundException(
          `Profession with ID ${dto.profession_id} not found`,
        );
      }
    }

    Object.assign(person, dto);
    const saved = await this.personRepo.save(person);
    await this.invalidatePersonsCache();
    return saved;
  }

  async updateStatus(id: number, dto: UpdatePersonStatusDto): Promise<Person> {
    const person = await this.findById(id);

    const oldStatus = person.status;
    person.status = dto.status;

    person.can_work = WORKING_STATUSES.includes(dto.status as PersonStatus);

    if (dto.notes) {
      person.notes = person.notes
        ? `${person.notes}\n[${new Date().toISOString()}] Status changed from ${oldStatus} to ${dto.status}: ${dto.notes}`
        : `[${new Date().toISOString()}] Status changed from ${oldStatus} to ${dto.status}: ${dto.notes}`;
    }

    const saved = await this.personRepo.save(person);
    await this.invalidatePersonsCache();
    return saved;
  }

  async delete(id: number): Promise<void> {
    const person = await this.findById(id);

    if (person.userAccount) {
      throw new BadRequestException(
        "Cannot delete person with an active user account. Delete the user account first.",
      );
    }

    await this.personRepo.remove(person);
    await this.invalidatePersonsCache();
  }

  async countActiveWorkers(
    professionId: number,
    excludePersonId?: number,
  ): Promise<number> {
    return this.personRepo.count({
      where: {
        profession_id: professionId,
        can_work: true,
        status: In(WORKING_STATUSES),
        id: excludePersonId ? Not(excludePersonId) : undefined,
      },
    });
  }

  async findActiveWorkersByCamp(campId: number): Promise<Person[]> {
    return this.personRepo
      .createQueryBuilder("person")
      .leftJoinAndSelect("person.profession", "profession")
      .leftJoinAndSelect("person.userAccount", "userAccount")
      .where("(userAccount.camp_id = :campId OR person.camp_id = :campId)", {
        campId,
      })
      .andWhere("person.can_work = :canWork", { canWork: true })
      .andWhere("person.status IN (:...statuses)", {
        statuses: WORKING_STATUSES,
      })
      .getMany();
  }

  async countPersonsByCamp(
    campId: number,
    excludeDeceased: boolean = true,
  ): Promise<number> {
    const query = this.personRepo
      .createQueryBuilder("person")
      .leftJoin("person.userAccount", "userAccount")
      .where("(userAccount.camp_id = :campId OR person.camp_id = :campId)", {
        campId,
      });

    if (excludeDeceased) {
      query.andWhere("person.status != :deceasedStatus", {
        deceasedStatus: PersonStatus.DECEASED,
      });
    }

    return query.getCount();
  }

  async getStatsByStatus(campId?: number): Promise<
    Array<{
      status: string;
      count: number;
    }>
  > {
    const query = this.personRepo
      .createQueryBuilder("person")
      .select("person.status", "status")
      .addSelect("COUNT(*)", "count")
      .groupBy("person.status");

    if (campId) {
      query
        .leftJoin("person.userAccount", "userAccount")
        .where("userAccount.camp_id = :campId", { campId });
    }

    return query.getRawMany();
  }

  async getStatsByProfession(campId?: number): Promise<
    Array<{
      professionName: string;
      total: number;
      active: number;
      inactive: number;
    }>
  > {
    const query = this.personRepo
      .createQueryBuilder("person")
      .leftJoin("person.profession", "profession")
      .select("profession.name", "professionName")
      .addSelect("COUNT(*)", "total")
      .addSelect(
        `COUNT(CASE WHEN person.can_work = true AND person.status = '${PersonStatus.ACTIVE}' THEN 1 END)`,
        "active",
      )
      .addSelect(
        `COUNT(CASE WHEN person.can_work = false OR person.status != '${PersonStatus.ACTIVE}' THEN 1 END)`,
        "inactive",
      )
      .groupBy("profession.name");

    if (campId) {
      query
        .leftJoin("person.userAccount", "userAccount")
        .where("userAccount.camp_id = :campId", { campId });
    }

    return query.getRawMany();
  }

  private generateIdentificationCode(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 7);
    return `SURVIVOR-${timestamp}-${random}`.toUpperCase();
  }
}
