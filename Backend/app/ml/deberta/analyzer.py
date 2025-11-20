import logging
from typing import Dict, List
from app.ml.deberta.model_loader import ModelLoader
from app.ml.deberta.prompt_builder import PromptBuilder
from app.ml.deberta.sliding_window import SlidingWindow

log = logging.getLogger(__name__)


class DeBertaAnalyzer:
    """Analizador de texto usando DeBERTa con Zero-Shot Classification."""

    def __init__(self):
        self.model_loader = ModelLoader()
        self.prompt_builder = PromptBuilder()
        self.sliding_window = SlidingWindow()
        log.info("DeBertaAnalyzer inicializado")

    def analyze_text(
            self,
            text: str,
            criterio: str,
            tema: str,
            descripcion_tema: str,
            niveles: List[Dict] = None  # ✅ NUEVO: Recibir niveles de la rúbrica
    ) -> Dict:
        """
        Analiza un texto según un criterio específico usando los niveles de la rúbrica.

        Args:
            text: Texto a analizar
            criterio: Nombre del criterio (ej: "Aplicación conceptos")
            tema: Tema del documento
            descripcion_tema: Descripción del tema
            niveles: Lista de niveles del criterio con sus descriptores
                Estructura: [
                    {
                        "nombre_nivel": "Excelente",
                        "puntaje_min": 3,
                        "puntaje_max": 3,
                        "descriptores": ["descriptor1", "descriptor2"],
                        "orden": 1
                    },
                    ...
                ]

        Returns:
            Dict con score, confidence y nivel asignado
        """
        try:
            # Si no se proporcionan niveles, usar niveles por defecto
            if not niveles:
                niveles = [
                    {"nombre_nivel": "Excelente", "descriptores": [], "orden": 1},
                    {"nombre_nivel": "Bueno", "descriptores": [], "orden": 2},
                    {"nombre_nivel": "Regular", "descriptores": [], "orden": 3},
                    {"nombre_nivel": "Insuficiente", "descriptores": [], "orden": 4}
                ]

            # Ordenar niveles por orden (del mejor al peor)
            niveles_ordenados = sorted(niveles, key=lambda x: x.get('orden', 999))

            # Si el texto es largo, usar sliding window
            if len(text) > 2000:
                log.info(f"Texto largo detectado ({len(text)} chars), usando sliding window")
                return self.sliding_window.analyze_with_sliding_window(
                    text=text,
                    criterio=criterio,
                    tema=tema,
                    descripcion_tema=descripcion_tema,
                    niveles=niveles_ordenados,
                    model_loader=self.model_loader,
                    prompt_builder=self.prompt_builder
                )

            # Texto corto: análisis directo
            return self._analyze_chunk(
                text=text,
                criterio=criterio,
                tema=tema,
                descripcion_tema=descripcion_tema,
                niveles=niveles_ordenados
            )

        except Exception as e:
            log.error(f"Error en analyze_text: {e}")
            raise

    def _analyze_chunk(
            self,
            text: str,
            criterio: str,
            tema: str,
            descripcion_tema: str,
            niveles: List[Dict]
    ) -> Dict:
        """Analiza un chunk de texto."""
        try:
            # Construir hipótesis para cada nivel usando sus descriptores
            hypotheses = []
            nombres_niveles = []

            for nivel in niveles:
                nombre_nivel = nivel.get('nombre_nivel', 'Sin nombre')
                descriptores = nivel.get('descriptores', [])

                # Construir hipótesis usando descriptores específicos
                hypothesis = self.prompt_builder.build_hypothesis(
                    criterio=criterio,
                    nivel=nombre_nivel,
                    descriptores=descriptores
                )

                hypotheses.append(hypothesis)
                nombres_niveles.append(nombre_nivel)

            log.info(f"Evaluando contra {len(hypotheses)} niveles: {nombres_niveles}")

            # Obtener modelo
            model, tokenizer = self.model_loader.get_model()

            # Clasificar
            inputs = tokenizer(
                [text] * len(hypotheses),
                hypotheses,
                return_tensors="pt",
                padding=True,
                truncation=True,
                max_length=512
            )

            outputs = model(**inputs)
            logits = outputs.logits

            # Obtener scores
            import torch
            probs = torch.softmax(logits, dim=1)
            entailment_scores = probs[:, 2].tolist()  # Índice 2 = entailment

            # Encontrar el mejor nivel
            max_idx = entailment_scores.index(max(entailment_scores))
            mejor_nivel = nombres_niveles[max_idx]
            score = entailment_scores[max_idx]

            # Mapear nivel a score numérico (0-1)
            score_normalizado = self._nivel_to_score(mejor_nivel, niveles)

            log.info(f"Resultado: nivel={mejor_nivel}, score={score_normalizado:.3f}, confidence={score:.3f}")

            return {
                'score': score_normalizado,
                'confidence': score,
                'nivel': mejor_nivel
            }

        except Exception as e:
            log.error(f"Error en _analyze_chunk: {e}")
            raise

    def _nivel_to_score(self, nivel: str, niveles: List[Dict]) -> float:
        """
        Convierte un nivel a un score numérico (0-1) basado en puntaje_max.

        Ejemplo con tu escala 0-20:
        - Excelente (14-20): score = 20/20 = 1.0
        - Regular (7-13): score = 13/20 = 0.65
        - Deficiente (0-6): score = 6/20 = 0.30
        """
        try:
            # Buscar el nivel en la lista de niveles del criterio
            for n in niveles:
                if n.get('nombre_nivel') == nivel:
                    puntaje_max = n.get('puntaje_max', 0)

                    # Calcular el máximo de la escala (el puntaje_max más alto)
                    escala_maxima = max(nv.get('puntaje_max', 0) for nv in niveles)

                    if escala_maxima > 0:
                        score = puntaje_max / escala_maxima
                        return min(1.0, max(0.0, score))
                    else:
                        return 0.0

            # Fallback si no encuentra el nivel
            nivel_lower = nivel.lower()
            if 'excelente' in nivel_lower or 'sobresaliente' in nivel_lower:
                return 1.0
            elif 'bueno' in nivel_lower or 'satisfactorio' in nivel_lower:
                return 0.75
            elif 'regular' in nivel_lower or 'básico' in nivel_lower:
                return 0.50
            elif 'deficiente' in nivel_lower or 'insuficiente' in nivel_lower:
                return 0.20
            else:
                return 0.50

        except Exception as e:
            log.error(f"Error en _nivel_to_score: {e}")
            return 0.5

