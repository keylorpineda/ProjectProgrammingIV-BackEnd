import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AiAdmission } from "../entities/ai-admission.entity";
import { Person } from "../../users/entities/person.entity";
import { UserAccount } from "../../users/entities/user-account.entity";
import {
  AdmissionDecision,
  ReviewAdmissionDto,
} from "../dto/review-admission.dto";
import { CreateUserAccountDto } from "../dto/create-user-account.dto";
import { PersonStatus } from "../../users/constants/professions.constants";
import * as bcrypt from "bcrypt";
import { randomUUID } from "crypto";
import { MailService } from "../../mail/mail.service";

@Injectable()
export class AdmissionReviewService {
  constructor(
    @InjectRepository(AiAdmission)
    private readonly admissionRepo: Repository<AiAdmission>,
    @InjectRepository(Person)
    private readonly personRepo: Repository<Person>,
    @InjectRepository(UserAccount)
    private readonly userAccountRepo: Repository<UserAccount>,
    private readonly mailService: MailService,
  ) {}

  async reviewAdmission(
    id: number,
    dto: ReviewAdmissionDto,
    adminUserId: number,
  ): Promise<{ admission: AiAdmission; person?: Person }> {
    const admission = await this.admissionRepo.findOne({
      where: { id },
      relations: ["camp", "suggestedProfession"],
    });

    if (!admission) {
      throw new NotFoundException(`Admission ${id} not found`);
    }

    if (admission.status !== "PENDING_REVIEW") {
      throw new BadRequestException("Admission already reviewed");
    }

    const candidateData: any = admission.candidate_data;

    if (dto.decision === AdmissionDecision.ACCEPTED) {
      const professionId =
        dto.override_profession_id || admission.suggested_profession_id;

      if (!professionId) {
        throw new BadRequestException("Profession ID required");
      }

      const person = this.personRepo.create({
        first_name: candidateData.first_name,
        last_name: candidateData.last_name,
        last_name2: candidateData.last_name2 || null,
        birth_date: new Date(
          new Date().getFullYear() - candidateData.age,
          0,
          1,
        ),
        profession_id: professionId,
        status: PersonStatus.ACTIVE,
        can_work: true,
        join_date: new Date(),
        identification_code: this.generateSurvivorCode(),
        photo_url: candidateData.photo_url,
        id_card_url: candidateData.id_card_url,
        previous_skills: JSON.stringify(candidateData.skills),
      });

      const savedPerson = await this.personRepo.save(person);

      admission.person_id = savedPerson.id;
      admission.status = "ACCEPTED";
      admission.final_human_decision = "ACCEPTED";
      admission.reviewed_by_user_id = adminUserId;
      admission.admin_notes = dto.notes || "";
      admission.review_date = new Date();

      const candidateEmail = candidateData.contact_email;
      if (candidateEmail) {
        admission.registration_token = randomUUID();
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 48); // Token válido por 48 horas
        admission.token_expires_at = expiresAt;
      }

      await this.admissionRepo.save(admission);

      if (candidateEmail) {
        await this.mailService.sendAdmissionDecision(
          candidateEmail,
          "accepted",
          admission.justification || "Aprobado satisfactoriamente.",
          admission.camp?.name || "Campamento Refugio",
          admission.registration_token || undefined,
        );
      }

      return { admission, person: savedPerson };
    }

    admission.status = "REJECTED";
    admission.final_human_decision = "REJECTED";
    admission.reviewed_by_user_id = adminUserId;
    admission.admin_notes = dto.notes || "";
    admission.review_date = new Date();

    await this.admissionRepo.save(admission);

    const candidateEmail = candidateData?.contact_email;
    if (candidateEmail) {
      await this.mailService.sendAdmissionDecision(
        candidateEmail,
        "rejected",
        admission.justification ||
          "Tu solicitud ha sido denegada por motivos de seguridad.",
        admission.camp?.name || "Campamento Refugio",
      );
    }

    return { admission };
  }

  async createUserAccountForPerson(
    admissionId: number,
    dto: CreateUserAccountDto,
  ): Promise<UserAccount> {
    const admission = await this.admissionRepo.findOne({
      where: { id: admissionId },
      relations: ["person", "camp"],
    });

    if (!admission || !admission.person_id) {
      throw new BadRequestException(
        "Admission not accepted or person not created",
      );
    }

    const existingAccount = await this.userAccountRepo.findOne({
      where: { person_id: admission.person_id },
    });

    if (existingAccount) {
      throw new BadRequestException(
        "User account already exists for this person",
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const userAccount = this.userAccountRepo.create({
      person_id: admission.person_id,
      camp_id: admission.camp_id,
      role_id: dto.role_id,
      username: dto.username,
      email: dto.email,
      password_hash: passwordHash,
    });

    return this.userAccountRepo.save(userAccount);
  }

  async completeRegistrationFromToken(
    token: string,
    dto: CreateUserAccountDto,
  ): Promise<UserAccount> {
    const admission = await this.admissionRepo.findOne({
      where: { registration_token: token },
      relations: ["person", "camp"],
    });

    if (!admission || !admission.person_id) {
      throw new BadRequestException("Invalid or expired registration token");
    }

    if (
      !admission.token_expires_at ||
      new Date() > new Date(admission.token_expires_at)
    ) {
      throw new BadRequestException("Registration token has expired");
    }

    if (admission.status !== "ACCEPTED") {
      throw new BadRequestException("Admission not accepted");
    }

    // Role ID 2 is usually "worker". We will use the provided role_id or default to 2.
    // However, the dto requires role_id.
    const finalRoleId = dto.role_id || 2;

    const existingAccount = await this.userAccountRepo.findOne({
      where: { person_id: admission.person_id },
    });

    if (existingAccount) {
      throw new BadRequestException("User account already exists");
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const userAccount = this.userAccountRepo.create({
      person_id: admission.person_id,
      camp_id: admission.camp_id,
      role_id: finalRoleId,
      username: dto.username,
      email: dto.email,
      password_hash: passwordHash,
    });

    const savedAccount = await this.userAccountRepo.save(userAccount);

    // Invalidate token
    admission.registration_token = null;
    admission.token_expires_at = null;
    await this.admissionRepo.save(admission);

    return savedAccount;
  }

  private generateSurvivorCode(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 7).toUpperCase();
    return `SURVIVOR-${timestamp}-${random}`;
  }
}
