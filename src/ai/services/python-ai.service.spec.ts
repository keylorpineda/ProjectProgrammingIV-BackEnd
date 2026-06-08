import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { PythonAiService } from "./python-ai.service";

describe("PythonAiService", () => {
  let service: PythonAiService;

  const mockSubmitDto = {
    first_name: "Sarah",
    last_name: "Connor",
    email: "sarah@example.com",
    age: 28,
    camp_id: 1,
    health_status: 95,
    physical_condition: 90,
    criminal_record: false,
    skills: ["leadership", "medical"],
  };

  const mockPythonResponse = {
    nlp_score: 850,
    nlp_max_score: 1000,
    nlp_percentage: 85,
    nlp_decision_hint: "RECOMMEND_ACCEPT" as const,
    infection_detected: false,
    glass_box: {
      criteria: [
        {
          name: "Skills Alignment",
          icon: "skills",
          score: 90,
          max_score: 100,
          percentage: 90,
          status: "EXCELLENT",
          detail: "Strong skill match",
          evidence: ["leadership", "medical"],
        },
      ],
      total_score: 850,
      max_score: 1000,
      percentage: 85,
    },
    nlp_analysis: {
      detected_skills: ["leadership", "medical"],
      risk_keywords: [],
      trauma_indicators: [],
      deception_indicators: [],
      narrative_quality: "HIGH",
      word_count: 250,
    },
    document_status: {
      photo_provided: true,
      id_card_provided: true,
      is_complete: true,
    },
    transparency_report:
      "NLP Analysis: Positive linguistic patterns detected. Confidence: 85%",
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PythonAiService],
    }).compile();

    service = module.get<PythonAiService>(PythonAiService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("analyzeAdmission", () => {
    it("should abort analyzeAdmission when the request times out", async () => {
      jest.useFakeTimers();

      jest.spyOn(global, "fetch").mockImplementationOnce((_, init) => {
        const signal = init?.signal as AbortSignal;
        return new Promise((_, reject) => {
          signal.addEventListener("abort", () => reject(new Error("aborted")));
        });
      });

      const pending = service.analyzeAdmission(mockSubmitDto);
      await jest.advanceTimersByTimeAsync(5000);

      await expect(pending).resolves.toBeNull();
      jest.useRealTimers();
    });

    it("should return null when Python AI service is unavailable", async () => {
      jest
        .spyOn(global, "fetch")
        .mockRejectedValueOnce(new Error("Network error"));

      const result = await service.analyzeAdmission(mockSubmitDto);

      expect(result).toBeNull();
    });

    it("should return null when response is not ok", async () => {
      jest.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: false,
        status: 503,
      } as Response);

      const result = await service.analyzeAdmission(mockSubmitDto);

      expect(result).toBeNull();
    });

    it("should return parsed response on success", async () => {
      jest.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce(mockPythonResponse),
      } as any as Response);

      const result = await service.analyzeAdmission(mockSubmitDto);

      expect(result).toEqual(mockPythonResponse);
      expect(result?.nlp_percentage).toBe(85);
    });

    it("should send POST request with correct endpoint", async () => {
      const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockPythonResponse),
      } as any as Response);

      await service.analyzeAdmission(mockSubmitDto);

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining("/api/admissions/nlp-analyze"),
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }),
      );
    });

    it("should handle timeout gracefully", async () => {
      jest.spyOn(global, "fetch").mockImplementationOnce(
        () =>
          new Promise((resolve, reject) => {
            setTimeout(() => reject(new Error("AbortError")), 100);
          }),
      );

      const result = await service.analyzeAdmission(mockSubmitDto);

      expect(result).toBeNull();
    });

    it("should include infection detection in response", async () => {
      const responseWithInfection = {
        ...mockPythonResponse,
        infection_detected: true,
      };

      jest.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(responseWithInfection),
      } as any as Response);

      const result = await service.analyzeAdmission(mockSubmitDto);

      expect(result?.infection_detected).toBe(true);
    });

    it("should include NLP analysis details", async () => {
      jest.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockPythonResponse),
      } as any as Response);

      const result = await service.analyzeAdmission(mockSubmitDto);

      expect(result?.nlp_analysis).toBeDefined();
      expect(result?.nlp_analysis.detected_skills).toContain("medical");
      expect(result?.nlp_analysis.word_count).toBeGreaterThan(0);
    });

    it("should validate document status", async () => {
      jest.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockPythonResponse),
      } as any as Response);

      const result = await service.analyzeAdmission(mockSubmitDto);

      expect(result?.document_status.is_complete).toBe(true);
      expect(result?.document_status.photo_provided).toBe(true);
    });

    it("should stringify non-Error failures and still return null", async () => {
      jest.spyOn(global, "fetch").mockRejectedValueOnce("timeout");

      const result = await service.analyzeAdmission(mockSubmitDto);

      expect(result).toBeNull();
    });
  });

  describe("forecastResource", () => {
    it("should call forecast endpoint successfully", async () => {
      const mockData = { camp_id: 1, resource_type: "food" };
      const mockResult = { forecast: 100, confidence: 0.85 };

      jest.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResult),
      } as any as Response);

      const result = await service.forecastResource(mockData);

      expect(result).toEqual(mockResult);
    });

    it("should return null on forecast error", async () => {
      const mockData = { camp_id: 1 };

      jest
        .spyOn(global, "fetch")
        .mockRejectedValueOnce(new Error("Service error"));

      const result = await service.forecastResource(mockData);

      expect(result).toBeNull();
    });
  });

  describe("analyzeExpedition", () => {
    it("should call analyze expedition endpoint", async () => {
      const mockData = { expedition_id: 1, route: "north" };
      const mockResult = { analysis: "feasible", risk_level: "low" };

      jest.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResult),
      } as any as Response);

      const result = await service.analyzeExpedition(mockData);

      expect(result).toEqual(mockResult);
    });

    it("should handle expedition analysis errors", async () => {
      const mockData = { expedition_id: 1 };

      jest.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: false,
        status: 400,
      } as any as Response);

      const result = await service.analyzeExpedition(mockData);

      expect(result).toBeNull();
    });
  });

  describe("generateEvents", () => {
    it("should generate events successfully", async () => {
      const mockData = { camp_id: 1, event_type: "arrival" };
      const mockResult = { events: ["event1", "event2"] };

      jest.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResult),
      } as any as Response);

      const result = await service.generateEvents(mockData);

      expect(result).toEqual(mockResult);
    });

    it("should handle event generation failures", async () => {
      const mockData = { camp_id: 1 };

      jest
        .spyOn(global, "fetch")
        .mockRejectedValueOnce(new Error("Service down"));

      const result = await service.generateEvents(mockData);

      expect(result).toBeNull();
    });
  });

  describe("Additional coverage tests", () => {
    it("should handle malformed JSON response", async () => {
      jest.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockRejectedValueOnce(new SyntaxError("Invalid JSON")),
      } as any as Response);

      const result = await service.analyzeAdmission(mockSubmitDto);

      expect(result).toBeNull();
    });

    it("should handle partial response data", async () => {
      const partialResponse = {
        nlp_score: 75,
        nlp_percentage: 75,
      };

      jest.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(partialResponse),
      } as any as Response);

      const result = await service.analyzeAdmission(mockSubmitDto);

      expect(result).toBeDefined();
      expect(result?.nlp_score).toBe(75);
    });

    it("should handle 500 server error", async () => {
      jest.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as any as Response);

      const result = await service.analyzeAdmission(mockSubmitDto);

      expect(result).toBeNull();
    });

    it("should send correct headers with analyzeAdmission", async () => {
      const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockPythonResponse),
      } as any as Response);

      await service.analyzeAdmission(mockSubmitDto);

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: expect.any(String),
        }),
      );
    });

    it("should handle forecast with missing fields", async () => {
      const incompleteForecast = { camp_id: 1 };

      jest.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(incompleteForecast),
      } as any as Response);

      const result = await service.forecastResource(incompleteForecast);

      expect(result).toBeDefined();
    });

    it("should handle 404 not found for expedition", async () => {
      const mockData = { expedition_id: 999 };

      jest.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as any as Response);

      const result = await service.analyzeExpedition(mockData);

      expect(result).toBeNull();
    });
  });
});

describe("PythonAiService availability coverage", () => {
  let service: PythonAiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PythonAiService],
    }).compile();

    service = module.get<PythonAiService>(PythonAiService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should report availability when the health endpoint responds ok", async () => {
    jest.spyOn(global, "fetch").mockResolvedValueOnce({ ok: true } as Response);

    await expect(service.isAvailable()).resolves.toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/health"),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("should report unavailability when the health endpoint returns a non-ok status", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce({ ok: false } as Response);

    await expect(service.isAvailable()).resolves.toBe(false);
  });

  it("should report unavailability when the health endpoint throws", async () => {
    jest.spyOn(global, "fetch").mockRejectedValueOnce(new Error("offline"));

    await expect(service.isAvailable()).resolves.toBe(false);
  });

  it("should abort the availability check when the health request times out", async () => {
    jest.useFakeTimers();

    jest.spyOn(global, "fetch").mockImplementationOnce((_, init) => {
      const signal = init?.signal as AbortSignal;
      return new Promise((_, reject) => {
        signal.addEventListener("abort", () => reject(new Error("aborted")));
      });
    });

    const pending = service.isAvailable();
    await jest.advanceTimersByTimeAsync(2000);

    await expect(pending).resolves.toBe(false);
    jest.useRealTimers();
  });

  it("should return null when a helper endpoint responds with non-ok status", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce({ ok: false } as Response);

    await expect(service.forecastResource({ camp_id: 1 })).resolves.toBeNull();
  });

  it("should post helper payloads to the generate events endpoint", async () => {
    const payload = { camp_id: 4, severity: "high" };
    const response = { events: ["storm"] };
    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce(response),
    } as any as Response);

    await expect(service.generateEvents(payload)).resolves.toEqual(response);
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("/api/events/generate"),
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("should abort helper requests when they exceed the timeout", async () => {
    jest.useFakeTimers();

    jest.spyOn(global, "fetch").mockImplementationOnce((_, init) => {
      const signal = init?.signal as AbortSignal;
      return new Promise((_, reject) => {
        signal.addEventListener("abort", () => reject(new Error("aborted")));
      });
    });

    const pending = service.forecastResource({ camp_id: 99 });
    await jest.advanceTimersByTimeAsync(5000);

    await expect(pending).resolves.toBeNull();
    jest.useRealTimers();
  });
});
