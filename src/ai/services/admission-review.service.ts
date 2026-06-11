import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import { AiAdmission } from "../entities/ai-admission.entity";
import { Person } from "../../users/entities/person.entity";
import { Profession } from "../../users/entities/profession.entity";
import { UserAccount } from "../../users/entities/user-account.entity";
import type { ReviewAdmissionDto } from "../dto/review-admission.dto";
import { AdmissionDecision } from "../dto/review-admission.dto";
import type { CreateUserAccountDto } from "../dto/create-user-account.dto";
import { PersonStatus } from "../../users/constants/professions.constants";
import * as bcrypt from "bcrypt";
import { randomUUID } from "crypto";
import { QueryFailedError } from "typeorm";
import { MailService } from "../../mail/mail.service";

@Injectable()
export class AdmissionReviewService {
  private readonly logger = new Logger(AdmissionReviewService.name);

  constructor(
    @InjectRepository(AiAdmission)
    private readonly admissionRepo: Repository<AiAdmission>,
    @InjectRepository(Person)
    private readonly personRepo: Repository<Person>,
    @InjectRepository(UserAccount)
    private readonly userAccountRepo: Repository<UserAccount>,
    private readonly mailService: MailService,
    private readonly dataSource: DataSource,
  ) {}

  // ── Manual review (human admin) ──────────────────────────────────────────

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
      throw new BadRequestException(
        `Admission already processed (status: ${admission.status})`,
      );
    }

    if (dto.decision === AdmissionDecision.ACCEPTED) {
      const { person } = await this._executeAccept(admission, {
        overrideProfessionId: dto.override_profession_id,
        assignToCampId: dto.assign_to_camp_id,
        adminNotes: dto.notes,
        reviewedByUserId: adminUserId,
        isAuto: false,
        autoReason: null,
      });
      return { admission, person };
    }

    await this._executeReject(admission, {
      adminNotes: dto.notes,
      reviewedByUserId: adminUserId,
      isAuto: false,
      autoReason: null,
    });

    return { admission };
  }

  // ── Auto-decision (called from AI service on submit) ─────────────────────

  async processAutoDecision(
    admission: AiAdmission,
    decision: "ACCEPT" | "REJECT",
    reason: string,
  ): Promise<{ admission: AiAdmission; person?: Person }> {
    if (decision === "ACCEPT") {
      const { person } = await this._executeAccept(admission, {
        overrideProfessionId: undefined,
        assignToCampId: undefined,
        adminNotes: `[AUTO] ${reason}`,
        reviewedByUserId: null,
        isAuto: true,
        autoReason: reason,
      });
      this.logger.log(
        `[AutoDecision] ACCEPTED admission ${admission.id} — ${reason}`,
      );
      return { admission, person };
    }

    await this._executeReject(admission, {
      adminNotes: `[AUTO] ${reason}`,
      reviewedByUserId: null,
      isAuto: true,
      autoReason: reason,
    });
    this.logger.log(
      `[AutoDecision] REJECTED admission ${admission.id} — ${reason}`,
    );
    return { admission };
  }

  // ── Archive (admin action) ────────────────────────────────────────────────

  async archiveAdmission(
    id: number,
    adminUserId: number,
  ): Promise<AiAdmission> {
    const admission = await this.admissionRepo.findOne({ where: { id } });

    if (!admission) {
      throw new NotFoundException(`Admission ${id} not found`);
    }

    const archivableStatuses = [
      "AUTO_ACCEPTED",
      "AUTO_REJECTED",
      "ACCEPTED",
      "REJECTED",
    ];
    if (!archivableStatuses.includes(admission.status)) {
      throw new BadRequestException(
        `Cannot archive an admission with status "${admission.status}". Only completed admissions can be archived.`,
      );
    }

    if (admission.archived) {
      throw new BadRequestException("Admission is already archived");
    }

    admission.archived = true;
    admission.archived_at = new Date();
    admission.archived_by_user_id = adminUserId;

    return this.admissionRepo.save(admission);
  }

  // ── Shared accept / reject helpers ───────────────────────────────────────

  private async _executeAccept(
    admission: AiAdmission,
    opts: {
      overrideProfessionId?: number;
      assignToCampId?: number;
      adminNotes?: string;
      reviewedByUserId: number | null;
      isAuto: boolean;
      autoReason: string | null;
    },
  ): Promise<{ admission: AiAdmission; person: Person }> {
    const candidateData: any = admission.candidate_data;

    let professionId =
      opts.overrideProfessionId ?? admission.suggested_profession_id;

    if (!professionId) {
      const defaultProf = await this.personRepo.manager.findOne(Profession, {
        where: {},
      });
      professionId = defaultProf ? defaultProf.id : 1;
    }

    const person = this.personRepo.create({
      first_name: candidateData.first_name,
      last_name: candidateData.last_name,
      last_name2: candidateData.last_name2 || null,
      birth_date: new Date(new Date().getFullYear() - candidateData.age, 0, 1),
      profession_id: professionId,
      status: PersonStatus.ACTIVE,
      can_work: true,
      join_date: new Date(),
      identification_code: this.generateSurvivorCode(),
      photo_url: candidateData.photo_url,
      id_card_url: candidateData.id_card_url,
      previous_skills: JSON.stringify(candidateData.skills),
    });

    if (opts.assignToCampId) {
      admission.camp_id = opts.assignToCampId;
    }

    const newStatus = opts.isAuto ? "AUTO_ACCEPTED" : "ACCEPTED";

    const candidateEmail = candidateData.contact_email;
    if (candidateEmail) {
      admission.registration_token = randomUUID();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 48);
      admission.token_expires_at = expiresAt;
    }

    // La persona y la admisión se guardan en una sola transacción para evitar
    // que quede una persona "huérfana" si el guardado de la admisión falla.
    const savedPerson = await this.dataSource.transaction(async (manager) => {
      const sp = await manager.save(person);

      admission.person_id = sp.id;
      admission.status = newStatus;
      admission.final_human_decision = newStatus;
      admission.reviewed_by_user_id = opts.reviewedByUserId;
      admission.admin_notes = opts.adminNotes || "";
      admission.review_date = new Date();
      admission.is_auto_decision = opts.isAuto;
      admission.auto_decision_reason = opts.autoReason;

      await manager.save(admission);
      return sp;
    });

    if (candidateEmail) {
      this.mailService
        .sendAdmissionDecision(
          candidateEmail,
          "accepted",
          admission.justification || "Aprobado satisfactoriamente.",
          admission.camp?.name || "Campamento Refugio",
          admission.registration_token ?? undefined,
        )
        .catch((err) =>
          this.logger.error(
            `[AdmissionReview] Email de aceptación no pudo enviarse a ${candidateEmail}: ${String(err?.message ?? err)}`,
          ),
        );
    }

    return { admission, person: savedPerson };
  }

  private async _executeReject(
    admission: AiAdmission,
    opts: {
      adminNotes?: string;
      reviewedByUserId: number | null;
      isAuto: boolean;
      autoReason: string | null;
    },
  ): Promise<void> {
    const candidateData: any = admission.candidate_data;
    const newStatus = opts.isAuto ? "AUTO_REJECTED" : "REJECTED";

    admission.status = newStatus;
    admission.final_human_decision = newStatus;
    admission.reviewed_by_user_id = opts.reviewedByUserId;
    admission.admin_notes = opts.adminNotes || "";
    admission.review_date = new Date();
    admission.is_auto_decision = opts.isAuto;
    admission.auto_decision_reason = opts.autoReason;

    await this.admissionRepo.save(admission);

    const candidateEmail = candidateData?.contact_email;
    if (candidateEmail) {
      this.mailService
        .sendAdmissionDecision(
          candidateEmail,
          "rejected",
          admission.justification ||
            "Tu solicitud ha sido denegada por motivos de seguridad.",
          admission.camp?.name || "Campamento Refugio",
        )
        .catch((err) =>
          this.logger.error(
            `[AdmissionReview] Email de rechazo no pudo enviarse a ${candidateEmail}: ${String(err?.message ?? err)}`,
          ),
        );
    }
  }

  // ── Account creation ──────────────────────────────────────────────────────

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

    let savedAccount: UserAccount;
    try {
      savedAccount = await this.userAccountRepo.save(userAccount);
    } catch (err) {
      if (err instanceof QueryFailedError) {
        const detail = (err as any).detail as string | undefined;
        if (detail?.includes("username")) {
          throw new BadRequestException(
            `El nombre de usuario "${dto.username}" ya está en uso. Elige otro.`,
          );
        }
        if (detail?.includes("email")) {
          throw new BadRequestException(
            `El correo "${dto.email}" ya está registrado en el sistema.`,
          );
        }
        throw new BadRequestException(
          "No se pudo crear la cuenta: conflicto de datos únicos.",
        );
      }
      throw err;
    }

    if (dto.email) {
      try {
        await this.mailService.sendAccountCredentials(
          dto.email,
          dto.username,
          dto.password,
          admission.camp?.name || "Campamento Refugio",
        );
      } catch (mailErr) {
        this.logger.error(
          `[AdmissionReview] Email de credenciales no pudo enviarse a ${dto.email}: ${String((mailErr as any)?.message ?? mailErr)}`,
        );
        throw new BadRequestException(
          `La cuenta fue creada correctamente, pero el correo no pudo enviarse a ${dto.email}. Verifica la configuración SMTP o contacta al candidato directamente.`,
        );
      }
    }

    return savedAccount;
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

    const acceptedStatuses = ["ACCEPTED", "AUTO_ACCEPTED"];
    if (!acceptedStatuses.includes(admission.status)) {
      throw new BadRequestException("Admission not accepted");
    }

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
      email:
        dto.email ||
        (admission.candidate_data as any).contact_email ||
        `${dto.username}@camp.local`,
      password_hash: passwordHash,
    });

    const savedAccount = await this.userAccountRepo.save(userAccount);

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
