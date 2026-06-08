import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AiAdmission } from "./entities/ai-admission.entity";
import { Camp } from "../camps/entities/camp.entity";
import type { Profession } from "../users/entities/profession.entity";
import type { SubmitAdmissionDto } from "./dto/submit-admission.dto";
import type { ReviewAdmissionDto } from "./dto/review-admission.dto";
import type { CreateUserAccountDto } from "./dto/create-user-account.dto";
import { CampAnalysisService } from "./services/camp-analysis.service";
import type { EvaluationResult } from "./services/ai-evaluation.service";
import { AiEvaluationService } from "./services/ai-evaluation.service";
import { AdmissionReviewService } from "./services/admission-review.service";
import { PythonAiService } from "./services/python-ai.service";

// ── Auto-decision thresholds ──────────────────────────────────────────────────
// CRITICAL confidence (from critical rules) → always auto-decide
// score >= AUTO_ACCEPT_THRESHOLD → auto-accept
// score <= AUTO_REJECT_THRESHOLD → auto-reject
// between thresholds → PENDING_REVIEW (human review)
const AUTO_ACCEPT_THRESHOLD = 80;
const AUTO_REJECT_THRESHOLD = 30;

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    @InjectRepository(AiAdmission)
    private readonly admissionRepo: Repository<AiAdmission>,
    @InjectRepository(Camp)
    private readonly campRepo: Repository<Camp>,
    private readonly campAnalysisService: CampAnalysisService,
    private readonly evaluationService: AiEvaluationService,
    private readonly reviewService: AdmissionReviewService,
    private readonly pythonAiService: PythonAiService,
  ) {}

  async submitAdmission(dto: SubmitAdmissionDto): Promise<AiAdmission> {
    const allCamps = await this.campRepo.find();
    if (allCamps.length === 0) {
      throw new NotFoundException("No camps found in the system");
    }

    let bestScore = -1;
    let bestEvaluation: EvaluationResult | null = null;
    let bestCampContext = null;
    let bestSuggestedProfession: Profession | null = null;
    let bestCampId = dto.camp_id || allCamps[0].id;

    for (const camp of allCamps) {
      const campContext = await this.campAnalysisService.analyzeCampContext(
        camp.id,
      );
      const criticalRule = this.evaluationService.checkCriticalRules(
        dto,
        campContext,
      );

      let evaluation: EvaluationResult;
      let suggestedProfession: Profession | null = null;

      if (criticalRule.applies) {
        evaluation = {
          score: criticalRule.decision === "ACCEPT" ? 100 : 0,
          decision: criticalRule.decision || "REJECT",
          confidence: "CRITICAL",
          factors: [
            {
              category: "Critical Rule",
              score: 100,
              maxScore: 100,
              detail: criticalRule.reason || "",
            },
          ],
        };
      } else {
        evaluation = await this.evaluationService.calculateAdmissionScore(
          dto,
          campContext,
        );
        suggestedProfession = await this.evaluationService.matchProfession(
          dto.skills,
          campContext,
        );
      }

      if (evaluation.score > bestScore) {
        bestScore = evaluation.score;
        bestEvaluation = evaluation;
        bestCampContext = campContext;
        bestSuggestedProfession = suggestedProfession;
        bestCampId = camp.id;
      }
    }

    const trackingCode = this.generateTrackingCode();
    const justification = this.evaluationService.generateJustification(
      bestEvaluation!,
      bestCampContext!,
    );

    // ── Python NLP microservice ──────────────────────────────────────────────
    const pythonResult = await this.pythonAiService.analyzeAdmission(dto);

    let finalScore = bestEvaluation!.score;
    let finalDecision: string = bestEvaluation!.decision;
    let finalJustification = justification;

    if (pythonResult) {
      finalScore = Math.round(
        bestEvaluation!.score * 0.6 + pythonResult.nlp_percentage * 0.4,
      );

      if (pythonResult.infection_detected) {
        finalDecision = "RECOMMEND_REJECT";
        this.logger.warn(
          `Infection detected for ${dto.first_name} ${dto.last_name} – overriding to REJECT`,
        );
      } else if (
        pythonResult.nlp_decision_hint === "RECOMMEND_ACCEPT" &&
        finalScore >= 60
      ) {
        finalDecision = bestEvaluation!.decision;
      }

      finalJustification = `${justification}\n\n${"-".repeat(64)}\nANALISIS IA (CAJA DE CRISTAL):\n${pythonResult.transparency_report}`;
    } else {
      this.logger.warn(
        "Python AI microservice unavailable – using NestJS-only evaluation",
      );
    }

    // ── Determine auto-decision ──────────────────────────────────────────────
    const autoDecision = this._resolveAutoDecision(
      bestEvaluation!.confidence,
      bestEvaluation!.decision,
      finalScore,
      pythonResult?.infection_detected ?? false,
    );

    // ── Save admission ───────────────────────────────────────────────────────
    const admission = this.admissionRepo.create({
      tracking_code: trackingCode,
      camp_id: bestCampId,
      candidate_data: dto,
      score: finalScore,
      status: autoDecision ? autoDecision.status : "PENDING_REVIEW",
      suggested_decision: finalDecision,
      suggested_profession_id: bestSuggestedProfession?.id || null,
      justification: finalJustification,
      is_auto_decision: !!autoDecision,
      auto_decision_reason: autoDecision?.reason ?? null,
      raw_ai_response: {
        nestjs_evaluation: bestEvaluation,
        python_nlp: pythonResult ?? null,
        combined_score: finalScore,
        scoring_method: pythonResult
          ? "combined_60_40 (NestJS 60% + Python NLP 40%)"
          : "nestjs_only (Python microservice unavailable)",
        auto_decision: autoDecision ?? null,
      },
    });

    // Load camp relation so the review service can use camp.name for emails
    const savedAdmission = await this.admissionRepo.save(admission);
    const admissionWithRelations = await this.admissionRepo.findOne({
      where: { id: savedAdmission.id },
      relations: ["camp", "suggestedProfession"],
    });

    // ── Fire auto-decision immediately ───────────────────────────────────────
    if (autoDecision && admissionWithRelations) {
      try {
        await this.reviewService.processAutoDecision(
          admissionWithRelations,
          autoDecision.decision,
          autoDecision.reason,
        );
      } catch (err) {
        // Log but don't fail the request — admission is already saved
        this.logger.error(
          `[AutoDecision] Failed to process auto-decision for admission ${savedAdmission.id}: ${String((err as any)?.message ?? err)}`,
        );
      }
    }

    // Return fresh record so frontend sees correct status
    return (
      (await this.admissionRepo.findOne({
        where: { id: savedAdmission.id },
        relations: ["camp", "suggestedProfession"],
      })) ?? savedAdmission
    );
  }

  async trackAdmission(trackingCode: string): Promise<any> {
    const admission = await this.admissionRepo.findOne({
      where: { tracking_code: trackingCode },
      relations: ["camp", "suggestedProfession", "person"],
    });

    if (!admission) {
      throw new NotFoundException("Admission not found");
    }

    const candidateData: any = admission.candidate_data;

    return {
      tracking_code: admission.tracking_code,
      status: admission.status,
      is_auto_decision: admission.is_auto_decision,
      auto_decision_reason: admission.auto_decision_reason,
      camp_name: admission.camp?.name ?? null,
      candidate_name: [
        candidateData.first_name,
        candidateData.last_name,
        candidateData.last_name2,
      ]
        .filter(Boolean)
        .join(" "),
      submission_date: admission.submission_date,
      review_date: admission.review_date,
      final_decision: admission.final_human_decision,
      suggested_profession: admission.suggestedProfession?.name,
      person_code: admission.person?.identification_code,
    };
  }

  async getPendingAdmissions(
    campId?: number,
    page = 1,
    limit = 20,
  ): Promise<{
    data: AiAdmission[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const where: any = { status: "PENDING_REVIEW" };
    if (campId) {
      where.camp_id = campId;
    }

    const safePage = Math.max(1, page);
    const safeLimit = Math.min(Math.max(1, limit), 100);
    const skip = (safePage - 1) * safeLimit;

    const [data, total] = await this.admissionRepo.findAndCount({
      where,
      relations: ["camp", "suggestedProfession"],
      order: { submission_date: "DESC" },
      skip,
      take: safeLimit,
    });

    return {
      data,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
    };
  }

  /** Returns auto-decided (AUTO_ACCEPTED / AUTO_REJECTED) admissions for admin review.
   *  By default excludes archived; pass archived=true to see archived ones. */
  async getAutoDecidedAdmissions(opts: {
    campId?: number;
    archived?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{
    data: AiAdmission[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const { campId, archived = false, page = 1, limit = 20 } = opts;

    const safePage = Math.max(1, page);
    const safeLimit = Math.min(Math.max(1, limit), 100);
    const skip = (safePage - 1) * safeLimit;

    const qb = this.admissionRepo
      .createQueryBuilder("a")
      .leftJoinAndSelect("a.camp", "camp")
      .leftJoinAndSelect("a.suggestedProfession", "profession")
      .leftJoinAndSelect("a.person", "person")
      .where("a.is_auto_decision = true")
      .andWhere("a.status IN (:...statuses)", {
        statuses: ["AUTO_ACCEPTED", "AUTO_REJECTED"],
      })
      .andWhere("a.archived = :archived", { archived })
      .orderBy("a.review_date", "DESC")
      .skip(skip)
      .take(safeLimit);

    if (campId) {
      qb.andWhere("a.camp_id = :campId", { campId });
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

  async getAdmissionDetail(id: number): Promise<AiAdmission> {
    const admission = await this.admissionRepo.findOne({
      where: { id },
      relations: ["camp", "suggestedProfession", "reviewedBy", "person"],
    });

    if (!admission) {
      throw new NotFoundException(`Admission ${id} not found`);
    }

    return admission;
  }

  async reviewAdmission(
    id: number,
    dto: ReviewAdmissionDto,
    adminUserId: number,
  ) {
    return this.reviewService.reviewAdmission(id, dto, adminUserId);
  }

  async archiveAdmission(
    id: number,
    adminUserId: number,
  ): Promise<AiAdmission> {
    return this.reviewService.archiveAdmission(id, adminUserId);
  }

  async createUserAccountForPerson(
    admissionId: number,
    dto: CreateUserAccountDto,
  ) {
    return this.reviewService.createUserAccountForPerson(admissionId, dto);
  }

  async completeRegistrationFromToken(
    token: string,
    dto: CreateUserAccountDto,
  ) {
    return this.reviewService.completeRegistrationFromToken(token, dto);
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  /**
   * Determines if an admission should be auto-decided and returns the decision,
   * or null if it requires human review.
   *
   * Priority:
   *  1. CRITICAL confidence rules → always auto-decide
   *  2. Infection detected by Python NLP → auto-reject
   *  3. finalScore >= AUTO_ACCEPT_THRESHOLD → auto-accept
   *  4. finalScore <= AUTO_REJECT_THRESHOLD → auto-reject
   *  5. Otherwise → null (PENDING_REVIEW)
   */
  private _resolveAutoDecision(
    confidence: string,
    decision: string,
    finalScore: number,
    infectionDetected: boolean,
  ): { decision: "ACCEPT" | "REJECT"; status: string; reason: string } | null {
    // 1. Critical rules override everything
    if (confidence === "CRITICAL") {
      if (decision === "ACCEPT") {
        return {
          decision: "ACCEPT",
          status: "AUTO_ACCEPTED",
          reason:
            "Regla crítica del campamento: aceptación automática urgente.",
        };
      }
      return {
        decision: "REJECT",
        status: "AUTO_REJECTED",
        reason:
          "Regla crítica del campamento: rechazo automático por seguridad.",
      };
    }

    // 2. Python NLP infection override
    if (infectionDetected) {
      return {
        decision: "REJECT",
        status: "AUTO_REJECTED",
        reason:
          "Riesgo biológico detectado: condición contagiosa confirmada por análisis NLP.",
      };
    }

    // 3. High-confidence accept by score
    if (finalScore >= AUTO_ACCEPT_THRESHOLD) {
      return {
        decision: "ACCEPT",
        status: "AUTO_ACCEPTED",
        reason: `Puntuación alta (${finalScore}/100): candidato cumple todos los criterios de admisión.`,
      };
    }

    // 4. High-confidence reject by score
    if (finalScore <= AUTO_REJECT_THRESHOLD) {
      return {
        decision: "REJECT",
        status: "AUTO_REJECTED",
        reason: `Puntuación baja (${finalScore}/100): candidato no cumple los criterios mínimos de admisión.`,
      };
    }

    // 5. Requires human review
    return null;
  }

  private generateTrackingCode(): string {
    const year = new Date().getFullYear();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `ADM-${year}-${random}`;
  }
}
