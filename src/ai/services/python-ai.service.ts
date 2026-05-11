import { Injectable, Logger } from "@nestjs/common";
import { SubmitAdmissionDto } from "../dto/submit-admission.dto";

export interface PythonNlpResult {
  nlp_score: number;
  nlp_max_score: number;
  nlp_percentage: number;
  nlp_decision_hint: "RECOMMEND_ACCEPT" | "PENDING_HUMAN" | "RECOMMEND_REJECT";
  infection_detected: boolean;
  glass_box: {
    criteria: Array<{
      name: string;
      icon: string;
      score: number;
      max_score: number;
      percentage: number;
      status: string;
      detail: string;
      evidence: string[];
    }>;
    total_score: number;
    max_score: number;
    percentage: number;
  };
  nlp_analysis: {
    detected_skills: string[];
    risk_keywords: string[];
    trauma_indicators: string[];
    deception_indicators: string[];
    narrative_quality: string;
    word_count: number;
  };
  document_status: {
    photo_provided: boolean;
    id_card_provided: boolean;
    is_complete: boolean;
  };
  transparency_report: string;
}

/**
 * Servicio que llama al microservicio Python de IA No Generativa.
 * Si el microservicio no esta disponible, retorna null (graceful fallback).
 */
@Injectable()
export class PythonAiService {
  private readonly logger = new Logger(PythonAiService.name);
  private readonly aiServiceUrl: string;

  constructor() {
    this.aiServiceUrl = process.env.AI_SERVICE_URL ?? "http://localhost:8000";
  }

  async analyzeAdmission(
    dto: SubmitAdmissionDto,
  ): Promise<PythonNlpResult | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(
        `${this.aiServiceUrl}/api/admissions/nlp-analyze`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dto),
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        this.logger.warn(`Python AI responded ${response.status}`);
        return null;
      }

      return (await response.json()) as PythonNlpResult;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Python AI unavailable – continuing without NLP: ${message}`,
      );
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  async forecastResource(
    data: Record<string, unknown>,
  ): Promise<unknown | null> {
    return this._post("/api/resources/forecast", data);
  }

  async analyzeExpedition(
    data: Record<string, unknown>,
  ): Promise<unknown | null> {
    return this._post("/api/expeditions/analyze", data);
  }

  async generateEvents(data: Record<string, unknown>): Promise<unknown | null> {
    return this._post("/api/events/generate", data);
  }

  async isAvailable(): Promise<boolean> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);

    try {
      const res = await fetch(`${this.aiServiceUrl}/health`, {
        signal: controller.signal,
      });
      return res.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async _post(
    path: string,
    data: Record<string, unknown>,
  ): Promise<unknown | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const res = await fetch(`${this.aiServiceUrl}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        signal: controller.signal,
      });
      return res.ok ? await res.json() : null;
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }
}
