import logging
from typing import Dict, List, Any, Optional

log = logging.getLogger(__name__)


class ScoringService:

    def calculate_weighted_score(
            self,
            scores: Dict[str, float],
            weights: Dict[str, float]
    ) -> float:

        try:
            total = sum(scores[k] * weights.get(k, 0.0) for k in scores)
            log.info(f"Score ponderado calculado: {total:.3f}")
            return total
        except Exception as e:
            log.error(f"Error en calculate_weighted_score: {e}")
            return 0.0

    def convert_to_scale(self, score: float, max_scale: float = 20.0) -> float:
        return score * max_scale

    def nivel_to_score(self, nivel: str) -> float:

        mapa = {
            "Excelente": 1.0,
            "Bueno": 0.75,
            "Regular": 0.5,
            "Deficiente": 0.25,
            "Muy Deficiente": 0.0
        }
        return mapa.get(nivel, 0.0)

    def get_level_from_score(self, score: float, niveles: List[Any]) -> Optional[Any]:

        try:
            if not niveles:
                return None

            max_posible = max([n.puntaje_max for n in niveles]) if niveles else 20.0
            score_escalado = score * max_posible

            niveles_ordenados = sorted(niveles, key=lambda x: x.puntaje_min, reverse=True)

            for nivel in niveles_ordenados:
                if score_escalado >= nivel.puntaje_min:
                    return nivel

            return niveles_ordenados[-1]

        except Exception as e:
            log.error(f"Error al obtener nivel desde score ({score}): {e}")
            return niveles[0] if niveles else None
