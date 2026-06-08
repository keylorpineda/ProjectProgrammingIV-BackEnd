import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Profession } from "../../users/entities/profession.entity";
import type { SubmitAdmissionDto } from "../dto/submit-admission.dto";
import type { CampContext } from "./camp-analysis.service";
import { PROFESSIONS_CONFIG } from "../../users/constants/professions.constants";

export interface EvaluationResult {
  score: number;
  decision: string;
  confidence: string;
  factors: Array<{
    category: string;
    score: number;
    maxScore: number;
    detail: string;
  }>;
}

@Injectable()
export class AiEvaluationService {
  constructor(
    @InjectRepository(Profession)
    private readonly professionRepo: Repository<Profession>,
  ) {}

  checkCriticalRules(
    candidate: SubmitAdmissionDto,
    context: CampContext,
  ): { applies: boolean; decision?: string; reason?: string } {
    if (context.balance.food < -10) {
      const canProduceFood = candidate.skills.some((s) =>
        ["agriculture", "farming", "hunting", "fishing"].includes(
          s.toLowerCase(),
        ),
      );

      if (!canProduceFood) {
        return {
          applies: true,
          decision: "REJECT",
          reason:
            "CRITICAL: Camp has severe food deficit. Only accepting food producers.",
        };
      }
    }

    if (context.criticalDeficit >= 2 && context.criticalProfession) {
      const hasSkillForCritical = this.hasSkillsForProfession(
        candidate.skills,
        context.criticalProfession,
      );

      if (hasSkillForCritical) {
        return {
          applies: true,
          decision: "ACCEPT",
          reason: `URGENT: Camp critically needs ${context.criticalProfession}. Immediate acceptance.`,
        };
      }
    }

    if (context.occupancyRate > 95) {
      const estimatedScore = this.quickScoreEstimate(candidate);
      if (estimatedScore < 80) {
        return {
          applies: true,
          decision: "REJECT",
          reason: "Camp at 95% capacity. Only exceptional candidates accepted.",
        };
      }
    }

    if (candidate.medical_conditions?.includes("contagious")) {
      return {
        applies: true,
        decision: "REJECT",
        reason:
          "Health risk: Contagious condition poses danger to camp population.",
      };
    }

    return { applies: false };
  }

  async calculateAdmissionScore(
    candidate: SubmitAdmissionDto,
    context: CampContext,
  ): Promise<EvaluationResult> {
    const factors: Array<{
      category: string;
      score: number;
      maxScore: number;
      detail: string;
    }> = [];

    const professionNeedScore = this.scoreProfessionNeed(candidate, context);
    factors.push(professionNeedScore);

    const skillsScore = this.scoreSkills(candidate);
    factors.push({
      category: "Skills",
      score: Math.round(skillsScore * 0.25),
      maxScore: 25,
      detail: `${candidate.skills.length} valuable skills identified`,
    });

    const healthScore =
      (candidate.health_status + candidate.physical_condition) / 2;
    factors.push({
      category: "Health",
      score: Math.round(healthScore * 0.15),
      maxScore: 15,
      detail: `Health: ${candidate.health_status}/100, Physical: ${candidate.physical_condition}/100`,
    });

    const resourceScore = this.scoreResourceImpact(candidate, context);
    factors.push(resourceScore);

    const riskScore = this.scoreRisk(candidate);
    factors.push(riskScore);

    const totalScore = factors.reduce((sum, f) => sum + f.score, 0);

    let decision = "REQUIRES_REVIEW";
    let confidence = "MEDIUM";

    if (totalScore > 75) {
      decision = "RECOMMEND_ACCEPT";
      confidence = "HIGH";
    } else if (totalScore < 50) {
      decision = "RECOMMEND_REJECT";
      confidence = "HIGH";
    }

    return {
      score: Math.round(totalScore),
      decision,
      confidence,
      factors,
    };
  }

  async matchProfession(
    skills: string[],
    context: CampContext,
  ): Promise<Profession | null> {
    const professionNames = Object.values(PROFESSIONS_CONFIG).map(
      (p) => p.name,
    );

    for (const need of context.professionsNeeded) {
      if (this.hasSkillsForProfession(skills, need.profession)) {
        const profession = await this.professionRepo.findOne({
          where: { name: need.profession },
        });
        if (profession) return profession;
      }
    }

    for (const profName of professionNames) {
      if (this.hasSkillsForProfession(skills, profName)) {
        const profession = await this.professionRepo.findOne({
          where: { name: profName },
        });
        if (profession) return profession;
      }
    }

    return null;
  }

  generateJustification(
    evaluation: EvaluationResult,
    context: CampContext,
  ): string {
    let text = `Score: ${evaluation.score}/100 (${evaluation.confidence} confidence)\n`;
    text += `Decision: ${evaluation.decision}\n\n`;
    text += "Evaluation Breakdown:\n";

    for (const factor of evaluation.factors) {
      text += `- [${factor.score}/${factor.maxScore}] ${factor.category}: ${factor.detail}\n`;
    }

    text += `\nCamp Context:\n`;
    text += `- Population: ${context.population}/${context.capacity} (${Math.round(context.occupancyRate)}%)\n`;
    text += `- Food balance: ${context.balance.food > 0 ? "+" : ""}${context.balance.food}\n`;
    text += `- Water balance: ${context.balance.water > 0 ? "+" : ""}${context.balance.water}\n`;

    if (context.professionsNeeded.length > 0) {
      text += `- Professions needed: ${context.professionsNeeded.map((p) => `${p.profession} (-${p.deficit})`).join(", ")}\n`;
    }

    return text;
  }

  private scoreProfessionNeed(
    candidate: SubmitAdmissionDto,
    context: CampContext,
  ): { category: string; score: number; maxScore: number; detail: string } {
    let score = 0;
    let detail = "No critical profession match";

    for (const need of context.professionsNeeded) {
      if (this.hasSkillsForProfession(candidate.skills, need.profession)) {
        if (need.deficit >= 2) {
          score = 40;
          detail = `CRITICAL: Camp needs ${need.deficit} ${need.profession}s`;
          break;
        } else if (need.deficit === 1) {
          score = 30;
          detail = `Camp needs ${need.profession}`;
          break;
        }
      }
    }

    if (score === 0) {
      const hasUsefulSkills = candidate.skills.some((s) =>
        [
          "medicine",
          "agriculture",
          "security",
          "engineering",
          "medicina",
          "agricultura",
          "seguridad",
          "ingeniería",
          "armas",
          "cocina",
        ].includes(s.toLowerCase()),
      );
      score = hasUsefulSkills ? 15 : 5;
      detail = hasUsefulSkills
        ? "Has generally useful skills"
        : "Limited camp utility";
    }

    return { category: "Profession Need", score, maxScore: 40, detail };
  }

  private scoreSkills(candidate: SubmitAdmissionDto): number {
    const skillCount = candidate.skills.length;
    const experienceBonus = Math.min((candidate.years_experience || 0) * 2, 20);

    let baseScore = Math.min(skillCount * 10, 60);
    baseScore += experienceBonus;

    return Math.min(baseScore, 100);
  }

  private scoreResourceImpact(
    candidate: SubmitAdmissionDto,
    context: CampContext,
  ): { category: string; score: number; maxScore: number; detail: string } {
    const canProduce = candidate.skills.some((s) =>
      [
        "agriculture",
        "farming",
        "hunting",
        "water collection",
        "engineering",
      ].includes(s.toLowerCase()),
    );

    let score = 5;
    let detail = "Neutral impact on resources";

    if (canProduce && context.balance.food < 10) {
      score = 10;
      detail = "Will contribute to critical resource production";
    } else if (canProduce) {
      score = 8;
      detail = "Will contribute to resource production";
    } else if (context.balance.food < 0) {
      score = 0;
      detail = "Camp in deficit, non-producer";
    }

    return { category: "Resource Impact", score, maxScore: 10, detail };
  }

  private scoreRisk(candidate: SubmitAdmissionDto): {
    category: string;
    score: number;
    maxScore: number;
    detail: string;
  } {
    if (candidate.criminal_record) {
      return {
        category: "Risk Assessment",
        score: 0,
        maxScore: 10,
        detail: "Criminal record present",
      };
    }

    const psych = candidate.psychological_evaluation || 70;
    const score = Math.round(psych * 0.1);

    return {
      category: "Risk Assessment",
      score,
      maxScore: 10,
      detail: `Psychological eval: ${psych}/100`,
    };
  }

  private hasSkillsForProfession(
    skills: string[],
    professionName: string,
  ): boolean {
    const skillMap: Record<string, string[]> = {
      Explorador: [
        "exploration",
        "scouting",
        "navigation",
        "survival",
        "exploración",
        "explorar",
        "reconocimiento",
        "supervivencia",
        "navegación",
        "rastreo de rutas",
      ],
      Guardia: [
        "security",
        "combat",
        "defense",
        "weapons",
        "seguridad",
        "combate",
        "defensa",
        "armas",
        "vigilancia",
        "guardia",
        "protección",
      ],
      Medico: [
        "medicine",
        "medical",
        "first aid",
        "healthcare",
        "nursing",
        "medicina",
        "médico",
        "primeros auxilios",
        "enfermería",
        "salud",
        "cirugía",
        "farmacia",
      ],
      Granjero: [
        "agriculture",
        "farming",
        "cultivation",
        "gardening",
        "agricultura",
        "cultivo",
        "granja",
        "jardinería",
        "cosecha",
        "siembra",
        "ganadería",
      ],
      Cazador: [
        "hunting",
        "tracking",
        "weapons",
        "marksmanship",
        "caza",
        "cazar",
        "rastreo",
        "armas",
        "puntería",
        "trampas",
        "supervivencia en campo",
      ],
      "Recolector de Agua": [
        "water collection",
        "engineering",
        "plumbing",
        "recolección de agua",
        "agua",
        "plomería",
        "fontanería",
        "hidráulica",
        "ingeniería",
      ],
      Ingeniero: [
        "engineering",
        "mechanics",
        "repair",
        "construction",
        "ingeniería",
        "mecánica",
        "reparación",
        "electricidad",
        "mantenimiento",
        "técnico",
      ],
      Cocinero: [
        "cooking",
        "culinary",
        "food preparation",
        "cocina",
        "cocinero",
        "gastronomía",
        "preparación de alimentos",
        "alimentación",
      ],
      Constructor: [
        "construction",
        "carpentry",
        "building",
        "masonry",
        "construcción",
        "carpintería",
        "albañilería",
        "obras",
        "arquitectura",
        "plomería",
      ],
      Investigador: [
        "research",
        "science",
        "analysis",
        "laboratory",
        "investigación",
        "ciencia",
        "análisis",
        "laboratorio",
        "química",
        "biología",
        "tecnología",
      ],
    };

    const requiredSkills = skillMap[professionName] || [];
    return skills.some((s) =>
      requiredSkills.some((req) => s.toLowerCase().includes(req)),
    );
  }

  private quickScoreEstimate(candidate: SubmitAdmissionDto): number {
    const healthAvg =
      (candidate.health_status + candidate.physical_condition) / 2;
    const skillScore = Math.min(candidate.skills.length * 10, 40);
    const riskPenalty = candidate.criminal_record ? 20 : 0;

    return healthAvg * 0.3 + skillScore - riskPenalty;
  }
}
