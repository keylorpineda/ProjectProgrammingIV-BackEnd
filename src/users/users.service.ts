import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { UserAccount } from "./entities/user-account.entity";
import type { Person } from "./entities/person.entity";
import type { Profession } from "./entities/profession.entity";
import type { TemporaryAssignment } from "./entities/temporary-assignment.entity";
import type { CreatePersonDto } from "./dto/create-person.dto";
import type { UpdatePersonDto } from "./dto/update-person.dto";
import type { UpdatePersonStatusDto } from "./dto/update-person-status.dto";
import type { CreateTemporaryAssignmentDto } from "./dto/create-temporary-assignment.dto";
import { PersonsService } from "./services/persons.service";
import { ProfessionsService } from "./services/professions.service";
import { AssignmentsService } from "./services/assignments.service";
import { ProductionService } from "./services/production.service";
import { UserAsset } from "./entities/user-asset.entity";
import { Asset } from "./entities/asset.entity";
import { PersonAchievement } from "./entities/person-achievement.entity";

/**
 * Servicio principal de usuarios - Act�a como orquestador
 * Delega responsabilidades espec�ficas a servicios especializados
 */
@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserAccount)
    private readonly userAccountRepo: Repository<UserAccount>,
    @InjectRepository(UserAsset)
    private readonly userAssetRepo: Repository<UserAsset>,
    @InjectRepository(PersonAchievement)
    private readonly personAchievementRepo: Repository<PersonAchievement>,
    private readonly personsService: PersonsService,
    private readonly professionsService: ProfessionsService,
    private readonly assignmentsService: AssignmentsService,
    private readonly productionService: ProductionService,
  ) {}

  async findUserById(id: number): Promise<UserAccount | null> {
    return this.userAccountRepo.findOne({
      where: { id },
      relations: ["role", "person", "person.profession", "camp"],
    });
  }

  async findUserByUsername(username: string): Promise<UserAccount | null> {
    return this.userAccountRepo.findOne({
      where: { username },
      relations: ["role", "person", "person.profession", "camp"],
    });
  }

  async createPerson(dto: CreatePersonDto): Promise<Person> {
    return this.personsService.create(dto);
  }

  async findAllPersons(campId?: number, page = 1, limit = 20, search?: string) {
    return this.personsService.findAll(campId, page, limit, search);
  }

  async findPersonById(id: number): Promise<Person> {
    return this.personsService.findById(id);
  }

  async updatePerson(id: number, dto: UpdatePersonDto): Promise<Person> {
    return this.personsService.update(id, dto);
  }

  async updatePersonStatus(
    id: number,
    dto: UpdatePersonStatusDto,
  ): Promise<Person> {
    return this.personsService.updateStatus(id, dto);
  }

  async deletePerson(id: number): Promise<void> {
    return this.personsService.delete(id);
  }

  async getPersonStatsByStatus(
    campId?: number,
  ): Promise<Array<{ status: string; count: number }>> {
    return this.personsService.getStatsByStatus(campId);
  }

  async getPersonStatsByProfession(campId?: number): Promise<
    Array<{
      professionName: string;
      total: number;
      active: number;
      inactive: number;
    }>
  > {
    return this.personsService.getStatsByProfession(campId);
  }

  async findAllProfessions(): Promise<Profession[]> {
    return this.professionsService.findAll();
  }

  async findProfessionById(id: number): Promise<Profession> {
    return this.professionsService.findById(id);
  }

  async createProfession(data: {
    name: string;
    can_explore?: boolean;
    minimum_active_required?: number;
  }): Promise<Profession> {
    return this.professionsService.create(data);
  }

  async checkProfessionMinimumWorkers(
    professionId: number,
    excludePersonId?: number,
  ): Promise<{
    needsWorkers: boolean;
    currentWorkers: number;
    minimumRequired: number;
  }> {
    return this.professionsService.checkMinimumWorkers(
      professionId,
      excludePersonId,
    );
  }

  async getProfessionsNeedingWorkers(): Promise<
    Array<{
      profession: Profession;
      currentWorkers: number;
      minimumRequired: number;
      deficit: number;
    }>
  > {
    return this.professionsService.getProfessionsNeedingWorkers();
  }

  async getProfessionsWithExcess(): Promise<
    Array<{
      profession: Profession;
      currentWorkers: number;
      minimumRequired: number;
      excess: number;
    }>
  > {
    return this.professionsService.getProfessionsWithExcess();
  }

  async createTemporaryAssignment(
    dto: CreateTemporaryAssignmentDto,
    approvedByUserId: number,
  ): Promise<TemporaryAssignment> {
    return this.assignmentsService.create(dto, approvedByUserId);
  }

  async getActiveTemporaryAssignments(
    campId?: number,
  ): Promise<TemporaryAssignment[]> {
    return this.assignmentsService.findActive(campId);
  }

  async endTemporaryAssignment(
    assignmentId: number,
  ): Promise<TemporaryAssignment> {
    return this.assignmentsService.end(assignmentId);
  }

  async calculateDailyProduction(campId: number): Promise<{
    totalFood: number;
    totalWater: number;
    byProfession: Array<{
      professionName: string;
      workers: number;
      foodProduction: number;
      waterProduction: number;
    }>;
  }> {
    return this.productionService.calculateDailyProduction(campId);
  }

  async calculateDailyConsumption(campId: number): Promise<{
    totalFood: number;
    totalWater: number;
    totalPersons: number;
  }> {
    return this.productionService.calculateDailyConsumption(campId);
  }

  async calculateDailyBalance(campId: number): Promise<{
    production: { food: number; water: number };
    consumption: { food: number; water: number };
    balance: { food: number; water: number };
    persons: number;
  }> {
    return this.productionService.calculateDailyBalance(campId);
  }

  async getAssignedResourcesByUser(userId: number): Promise<UserAsset[]> {
    return this.userAssetRepo.find({
      where: { user_account_id: userId, relation_type: "assigned" },
      relations: ["asset"],
      order: { acquired_at: "DESC" },
    });
  }

  async getAllAssets(type?: string): Promise<Asset[]> {
    const where: any = { active: true };
    if (type) where.asset_type = type;

    return this.userAssetRepo.manager.find(Asset, {
      where,
      order: { rarity: "ASC" },
    });
  }

  async getMyBadges(userId: number): Promise<UserAsset[]> {
    return this.userAssetRepo.find({
      where: { user_account_id: userId, relation_type: "badge" },
      relations: ["asset"],
      order: { acquired_at: "DESC" },
    });
  }

  async toggleBadgeDisplay(
    userId: number,
    badgeId: number,
    isDisplayed: boolean,
  ): Promise<UserAsset> {
    const badge = await this.userAssetRepo.findOne({
      where: { user_account_id: userId, id: badgeId, relation_type: "badge" },
      relations: ["asset"],
    });

    if (!badge) {
      throw new NotFoundException(
        "Badge no encontrado o no pertenece a este usuario",
      );
    }

    badge.is_displayed = isDisplayed;
    return this.userAssetRepo.save(badge);
  }

  async awardFirstLoginAchievement(
    userId: number,
  ): Promise<{ awarded: boolean }> {
    const user = await this.userAccountRepo.findOne({
      where: { id: userId },
      select: ["id", "person_id"],
    });

    if (!user?.person_id) {
      return { awarded: false };
    }

    const personId = Number(user.person_id);

    const existing = await this.personAchievementRepo.findOne({
      where: { person_id: personId, achievement_name: "PRIMER_TRABAJO" },
    });

    if (existing) {
      return { awarded: false };
    }

    await this.personAchievementRepo.save(
      this.personAchievementRepo.create({
        person_id: personId,
        achievement_name: "PRIMER_TRABAJO",
        obtained_at: new Date(),
      }),
    );

    return { awarded: true };
  }

  async getMyAchievements(userId: number): Promise<PersonAchievement[]> {
    const user = await this.userAccountRepo.findOne({
      where: { id: userId },
      select: ["id", "person_id"],
    });

    if (!user?.person_id) {
      return [];
    }

    return this.personAchievementRepo.find({
      where: { person_id: Number(user.person_id) },
      order: { obtained_at: "ASC" },
    });
  }
}
