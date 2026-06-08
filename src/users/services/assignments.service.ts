import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, IsNull } from "typeorm";
import { TemporaryAssignment } from "../entities/temporary-assignment.entity";
import { Person } from "../entities/person.entity";
import type { CreateTemporaryAssignmentDto } from "../dto/create-temporary-assignment.dto";
import { ProfessionsService } from "./professions.service";
import { TEMPORARY_ASSIGNMENT_CONFIG } from "../constants/professions.constants";

@Injectable()
export class AssignmentsService {
  constructor(
    @InjectRepository(TemporaryAssignment)
    private readonly tempAssignmentRepo: Repository<TemporaryAssignment>,
    @InjectRepository(Person)
    private readonly personRepo: Repository<Person>,
    private readonly professionsService: ProfessionsService,
  ) {}

  async create(
    dto: CreateTemporaryAssignmentDto,
    approvedByUserId: number,
  ): Promise<TemporaryAssignment> {
    const person = await this.personRepo.findOne({
      where: { id: dto.person_id },
      relations: ["profession", "userAccount"],
    });

    if (!person) {
      throw new NotFoundException(`Person with ID ${dto.person_id} not found`);
    }

    if (!person.profession_id) {
      throw new BadRequestException(
        "Person must have a profession to be temporarily assigned",
      );
    }

    if (!person.can_work) {
      throw new BadRequestException(
        `Person cannot work (status: ${person.status})`,
      );
    }

    await this.professionsService.findById(dto.profession_temporary_id);

    if (person.profession_id === dto.profession_temporary_id) {
      throw new BadRequestException(
        "Cannot assign person to their current profession",
      );
    }

    const existingAssignment = await this.tempAssignmentRepo.findOne({
      where: {
        user_account_id: person.userAccount?.id,
        end_date: IsNull(),
      },
    });

    if (existingAssignment) {
      throw new ConflictException(
        "Person already has an active temporary assignment",
      );
    }

    const durationDays =
      dto.duration_days || TEMPORARY_ASSIGNMENT_CONFIG.DEFAULT_DURATION_DAYS;
    const startDate = dto.start_date ? new Date(dto.start_date) : new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + durationDays);

    const assignment = this.tempAssignmentRepo.create({
      user_account_id: person.userAccount?.id,
      profession_origin_id: person.profession_id,
      profession_temporary_id: dto.profession_temporary_id,
      start_date: startDate,
      end_date: endDate,
      reason: dto.reason || "Assigned due to profession shortage",
      user_approve_id: approvedByUserId,
    });

    return this.tempAssignmentRepo.save(assignment);
  }

  async findActive(campId?: number): Promise<TemporaryAssignment[]> {
    const query = this.tempAssignmentRepo
      .createQueryBuilder("assignment")
      .leftJoinAndSelect("assignment.userAccount", "userAccount")
      .leftJoinAndSelect("userAccount.person", "person")
      .leftJoinAndSelect("assignment.professionOrigin", "professionOrigin")
      .leftJoinAndSelect(
        "assignment.professionTemporary",
        "professionTemporary",
      )
      .where("assignment.end_date IS NULL OR assignment.end_date > :now", {
        now: new Date(),
      });

    if (campId) {
      query.andWhere("userAccount.camp_id = :campId", { campId });
    }

    return query.getMany();
  }

  async end(assignmentId: number): Promise<TemporaryAssignment> {
    const assignment = await this.tempAssignmentRepo.findOne({
      where: { id: assignmentId },
    });

    if (!assignment) {
      throw new NotFoundException(
        `Temporary assignment with ID ${assignmentId} not found`,
      );
    }

    assignment.end_date = new Date();
    return this.tempAssignmentRepo.save(assignment);
  }
}
