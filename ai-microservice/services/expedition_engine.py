"""
Motor de Expediciones — Sistema de Reglas Determinístico

Probabilidad de éxito (0–100):
    base = 100
    - difficulty × 10         (dificultad 1–5 → hasta -50)
    - líderes: 0 → -25, 1 → -5, 2+ → 0
    + experiencia.promedio × 4 (experiencia 0–5 → hasta +20)
    - duración: >7d → -15, >3d → -5
    - salud promedio: <50 → -15
    - tamaño grupo: <2 → -20
    Límite: min(95, max(5, total))
"""

import random
from typing import Dict, List, Tuple


_RISK_BY_DIFF = {
    1: "BAJO",
    2: "BAJO",
    3: "MEDIO",
    4: "ALTO",
    5: "CRÍTICO",
}


class ExpeditionRuleEngine:
    """Motor determinístico para análisis de expediciones."""

    def analyze(self, data: Dict) -> Dict:
        difficulty    = max(1, min(5, int(data.get("difficulty", 3))))
        group_size    = int(data.get("group_size", 1))
        leaders       = int(data.get("leaders", 0))
        avg_experience = float(data.get("avg_experience", 0))
        duration_days = int(data.get("duration_days", 1))
        avg_health    = float(data.get("avg_health", 75))
        objective     = data.get("objective", "exploración")
        explorers     = data.get("explorers", []) or []

        # 1) Evaluar logros de exploradores antes de calcular recursos y riesgos
        resource_modifier, risk_modifier, veteran_present = self._veteran_modifiers(
            explorers,
        )

        adjustments: List[Dict] = []
        score = 100

        # Dificultad
        diff_penalty = difficulty * 10
        score -= diff_penalty
        adjustments.append({"factor": f"Dificultad nivel {difficulty}", "adjustment": -diff_penalty, "reason": "Mayor dificultad reduce probabilidad base"})

        # Líderes
        if leaders == 0:
            score -= 25
            adjustments.append({"factor": "Sin líderes", "adjustment": -25, "reason": "Sin liderazgo la expedición tiene alto riesgo de desorganización"})
        elif leaders == 1:
            score -= 5
            adjustments.append({"factor": "1 líder", "adjustment": -5, "reason": "Liderazgo mínimo. Se recomienda 2+ líderes"})
        else:
            adjustments.append({"factor": f"{leaders} líderes", "adjustment": 0, "reason": "Liderazgo adecuado"})

        # Experiencia
        exp_bonus = min(20, round(avg_experience * 4))
        score += exp_bonus
        adjustments.append({"factor": f"Experiencia promedio {avg_experience:.1f}/5", "adjustment": exp_bonus, "reason": "Experiencia del equipo mejora rendimiento"})

        # Duración
        if duration_days > 7:
            score -= 15
            adjustments.append({"factor": f"Duración {duration_days} días (>7)", "adjustment": -15, "reason": "Expediciones largas aumentan riesgo de imprevistos"})
        elif duration_days > 3:
            score -= 5
            adjustments.append({"factor": f"Duración {duration_days} días (>3)", "adjustment": -5, "reason": "Duración moderada con riesgo aceptable"})
        else:
            adjustments.append({"factor": f"Duración {duration_days} días", "adjustment": 0, "reason": "Duración corta, riesgo mínimo"})

        # Salud
        if avg_health < 50:
            score -= 15
            adjustments.append({"factor": f"Salud promedio {avg_health:.0f}%", "adjustment": -15, "reason": "Equipo con salud comprometida no es apto para expedición"})
        else:
            adjustments.append({"factor": f"Salud promedio {avg_health:.0f}%", "adjustment": 0, "reason": "Salud del equipo aceptable"})

        # Tamaño
        if group_size < 2:
            score -= 20
            adjustments.append({"factor": f"Grupo de {group_size} persona(s)", "adjustment": -20, "reason": "Expedición solitaria es extremadamente peligrosa"})
        else:
            adjustments.append({"factor": f"Grupo de {group_size} personas", "adjustment": 0, "reason": "Tamaño de grupo adecuado"})

        # Logros
        veteran_count = self._count_with_achievement(explorers, "VETERANO_PARAMO")
        veteran_bonus = min(12, veteran_count * 3)
        if veteran_bonus > 0:
            score += veteran_bonus
            adjustments.append({
                "factor": f"Veteranos del páramo ({veteran_count})",
                "adjustment": veteran_bonus,
                "reason": "Los exploradores con VETERANO_PARAMO aumentan la probabilidad de éxito",
            })
        else:
            adjustments.append({
                "factor": "Sin veteranos del páramo",
                "adjustment": 0,
                "reason": "Sin bonificación por experiencia específica en expediciones",
            })

        # 2) Calcular recursos encontrados aplicando modificador global
        resources_found = self._calculate_resources_found(
            group_size=group_size,
            duration_days=duration_days,
            avg_experience=avg_experience,
            difficulty=difficulty,
            resource_modifier=resource_modifier,
        )

        # 3) Calcular posibles heridas/enfermedades aplicando reducción de riesgo
        health_outcomes = self._calculate_health_outcomes(
            explorers=explorers,
            difficulty=difficulty,
            duration_days=duration_days,
            avg_health=avg_health,
            risk_modifier=risk_modifier,
        )

        probability   = min(95, max(5, score))
        risk_level    = _RISK_BY_DIFF.get(difficulty, "MEDIO")
        suggestions   = self._suggestions(probability, leaders, avg_health, group_size, duration_days)
        report        = self._build_report(objective, probability, risk_level, adjustments, suggestions)
        narrative_note = (
            "La experiencia de los veteranos fue clave para el éxito"
            if veteran_present
            else ""
        )
        expedition_narrative = self._build_narrative(
            objective=objective,
            probability=probability,
            resources_found=resources_found,
            health_outcomes=health_outcomes,
            narrative_note=narrative_note,
        )

        return {
            "success_probability": probability,
            "risk_level":    risk_level,
            "adjustments":   adjustments,
            "suggestions":   suggestions,
            "resources_found": resources_found,
            "health_outcomes": health_outcomes,
            "narrative_note": narrative_note,
            "expedition_narrative": expedition_narrative,
            "transparency_report": report,
        }

    def _veteran_modifiers(self, explorers: List[Dict]) -> Tuple[float, float, bool]:
        veteran_present = self._count_with_achievement(explorers, "VETERANO_PARAMO") > 0
        resource_modifier = 1.2 if veteran_present else 1.0
        risk_modifier = 0.85 if veteran_present else 1.0
        return resource_modifier, risk_modifier, veteran_present

    def _calculate_resources_found(
        self,
        group_size: int,
        duration_days: int,
        avg_experience: float,
        difficulty: int,
        resource_modifier: float,
    ) -> Dict[str, int]:
        base_food = max(
            5,
            round(
                group_size
                * duration_days
                * (1 + (avg_experience / 6.0))
                * (6 - difficulty)
                * 0.55,
            ),
        )
        base_water = max(
            5,
            round(
                group_size
                * duration_days
                * (1 + (avg_experience / 7.0))
                * (6 - difficulty)
                * 0.65,
            ),
        )

        return {
            "food": max(0, round(base_food * resource_modifier)),
            "water": max(0, round(base_water * resource_modifier)),
        }

    def _calculate_health_outcomes(
        self,
        explorers: List[Dict],
        difficulty: int,
        duration_days: int,
        avg_health: float,
        risk_modifier: float,
    ) -> Dict[str, object]:
        injury_prob = self._clamp(
            (0.08 + (difficulty * 0.06) + (max(0, duration_days - 3) * 0.015) - (avg_health / 400.0))
            * risk_modifier,
            0.02,
            0.8,
        )
        sick_prob = self._clamp(
            (0.06 + (difficulty * 0.04) + (max(0, duration_days - 4) * 0.02) - (avg_health / 500.0))
            * risk_modifier,
            0.02,
            0.7,
        )

        detailed = []
        summary = {"Sano": 0, "Herido": 0, "Enfermo": 0}
        for explorer in explorers:
            roll = random.random()
            if roll < injury_prob:
                status = "Herido"
            elif roll < injury_prob + sick_prob:
                status = "Enfermo"
            else:
                status = "Sano"

            summary[status] += 1
            detailed.append(
                {
                    "id": explorer.get("id"),
                    "role": explorer.get("role", "member"),
                    "status": status,
                },
            )

        return {
            "injury_probability": round(injury_prob, 4),
            "sick_probability": round(sick_prob, 4),
            "summary": summary,
            "detailed": detailed,
        }

    def _count_with_achievement(self, explorers: List[Dict], achievement_code: str) -> int:
        count = 0
        for explorer in explorers:
            achievements = explorer.get("achievements", []) if isinstance(explorer, dict) else []
            if isinstance(achievements, list) and achievement_code in achievements:
                count += 1
        return count

    def _build_narrative(
        self,
        objective: str,
        probability: int,
        resources_found: Dict[str, int],
        health_outcomes: Dict[str, object],
        narrative_note: str,
    ) -> str:
        summary = health_outcomes.get("summary", {}) if isinstance(health_outcomes, dict) else {}
        healthy = summary.get("Sano", 0)
        injured = summary.get("Herido", 0)
        sick = summary.get("Enfermo", 0)
        note_line = f" {narrative_note}." if narrative_note else ""

        return (
            f"La expedición hacia {objective} logró una probabilidad estimada de éxito del {probability}%. "
            f"Se recuperaron {resources_found.get('food', 0)} unidades de comida y "
            f"{resources_found.get('water', 0)} unidades de agua. "
            f"Estado del equipo: {healthy} sanos, {injured} heridos y {sick} enfermos."
            f"{note_line}"
        )

    def _clamp(self, value: float, minimum: float, maximum: float) -> float:
        return max(minimum, min(maximum, value))

    def _suggestions(
        self, prob: int, leaders: int, health: float, size: int, days: int
    ) -> List[str]:
        tips = []
        if prob < 40:
            tips.append("⛔ Probabilidad muy baja. Reconsidere la expedición o aumente preparación.")
        if leaders == 0:
            tips.append("⚠️ Asigne al menos 1 líder experimentado antes de partir.")
        if health < 60:
            tips.append(f"⚠️ Salud promedio del equipo ({health:.0f}%) es insuficiente.")
        if size < 3:
            tips.append("⚠️ Se recomienda un mínimo de 3 personas para seguridad.")
        if days > 5:
            tips.append("📦 Expedición larga: asegure suministros dobles.")
        if prob >= 70:
            tips.append("✅ La expedición tiene probabilidades razonables de éxito.")
        return tips or ["✅ Sin observaciones críticas."]

    def _build_report(
        self, objective: str, prob: int, risk: str, adjustments: List[Dict], suggestions: List[str]
    ) -> str:
        bar_len = max(1, round(prob / 5))
        bar = "█" * bar_len + "░" * (20 - bar_len)
        lines = [
            "=" * 60,
            "  ANÁLISIS DE EXPEDICIÓN (Caja de Cristal)",
            "=" * 60,
            f"  Objetivo          : {objective}",
            f"  Prob. de éxito    : {prob}% [{bar}]",
            f"  Nivel de riesgo   : {risk}",
            "",
            "  FACTORES EVALUADOS:",
            "  " + "-" * 56,
        ]
        for adj in adjustments:
            sign = "+" if adj["adjustment"] >= 0 else ""
            lines.append(f"  {adj['factor']:<35} {sign}{adj['adjustment']:3d} pts")
            lines.append(f"    → {adj['reason']}")
        lines += ["", "  SUGERENCIAS:"]
        for s in suggestions:
            lines.append(f"  • {s}")
        lines.append("=" * 60)
        return "\n".join(lines)
