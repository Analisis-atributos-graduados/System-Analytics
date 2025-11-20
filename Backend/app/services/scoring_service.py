import logging
from typing import Dict, List, Any, Optional

log = logging.getLogger(__name__)


class ScoringService:
    """Servicio para cálculos relacionados con calificaciones."""

    def calculate_weighted_score(
            self,
            scores: Dict[str, float],
            weights: Dict[str, float]
    ) -> float:
        """
        Calcula puntaje ponderado.
        Args:
            scores: Dict con scores por criterio (0-1)
            weights: Dict con pesos por criterio (suma = 1)
        Returns:
            Score ponderado (0-1)
        """
        try:
            # Asegurar que solo sumamos criterios que existen en ambos dicts
            total = sum(scores[k] * weights.get(k, 0.0) for k in scores)
            log.info(f"Score ponderado calculado: {total:.3f}")
            return total
        except Exception as e:
            log.error(f"Error en calculate_weighted_score: {e}")
            return 0.0

    def convert_to_scale(self, score: float, max_scale: float = 20.0) -> float:
        """
        Convierte score (0-1) a escala específica (ej: 0-20).
        """
        return score * max_scale

    def nivel_to_score(self, nivel: str) -> float:
        """Convierte nombre de nivel a score aproximado (0-1)."""
        mapa = {
            "Excelente": 1.0,
            "Bueno": 0.75,
            "Regular": 0.5,
            "Deficiente": 0.25,
            "Muy Deficiente": 0.0
        }
        return mapa.get(nivel, 0.0)

    # 👇 ESTE ES EL MÉTODO QUE FALTABA 👇
    def get_level_from_score(self, score: float, niveles: List[Any]) -> Optional[Any]:
        """
        Determina el objeto Nivel correspondiente dado un score (0.0 - 1.0).

        Args:
            score: El puntaje calculado (normalizado entre 0 y 1).
            niveles: Lista de objetos Nivel (deben tener atributos puntaje_min/max o orden).

        Returns:
            El objeto Nivel que corresponde al puntaje.
        """
        try:
            if not niveles:
                return None

            # Convertimos el score (0-1) a la escala de la rúbrica (asumimos escala 20 por defecto
            # o usamos el máximo puntaje de los niveles si está disponible)

            # Encontramos el puntaje máximo posible en estos niveles para escalar
            max_posible = max([n.puntaje_max for n in niveles]) if niveles else 20.0
            score_escalado = score * max_posible

            # Ordenamos niveles de mayor puntaje a menor para evaluar rangos
            niveles_ordenados = sorted(niveles, key=lambda x: x.puntaje_min, reverse=True)

            for nivel in niveles_ordenados:
                # Si el puntaje cae en el rango o es superior al mínimo de este nivel
                if score_escalado >= nivel.puntaje_min:
                    return nivel

            # Si es muy bajo y no calza con ninguno, devolvemos el nivel más bajo (Deficiente)
            return niveles_ordenados[-1]

        except Exception as e:
            log.error(f"Error al obtener nivel desde score ({score}): {e}")
            # Retorno seguro: el primer nivel de la lista o None
            return niveles[0] if niveles else None
