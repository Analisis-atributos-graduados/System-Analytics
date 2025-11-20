import logging
from typing import Dict, List

log = logging.getLogger(__name__)


class SlidingWindow:
    """Procesa textos largos usando ventanas deslizantes."""

    def __init__(self, chunk_size: int = 1600, overlap: int = 400):
        self.chunk_size = chunk_size
        self.overlap = overlap
        log.info(f"SlidingWindow inicializado: chunk_size={chunk_size}, overlap={overlap}")

    def analyze_with_sliding_window(
            self,
            text: str,
            criterio: str,
            tema: str,
            descripcion_tema: str,
            niveles: List[Dict],  # ✅ NUEVO
            model_loader,
            prompt_builder
    ) -> Dict:
        """
        Analiza un texto largo usando ventanas deslizantes.
        """
        try:
            # Dividir en chunks
            chunks = self._split_into_chunks(text)
            log.info(f"Texto dividido en {len(chunks)} chunks (tamaño original: {len(text)} chars)")

            # Analizar cada chunk
            chunk_results = []

            for i, chunk in enumerate(chunks, 1):
                log.info(f"Procesando chunk {i}/{len(chunks)} para criterio '{criterio}'")

                result = self._analyze_single_chunk(
                    chunk=chunk,
                    criterio=criterio,
                    tema=tema,
                    descripcion_tema=descripcion_tema,
                    niveles=niveles,  # ✅ PASAR NIVELES
                    model_loader=model_loader,
                    prompt_builder=prompt_builder
                )

                chunk_results.append(result)

            # Agregar resultados
            final_result = self._aggregate_results(chunk_results)

            log.info(
                f"Agregación completada: score={final_result['score']:.3f}, "
                f"confidence={final_result['confidence']:.3f}, nivel={final_result['nivel']}"
            )

            return final_result

        except Exception as e:
            log.error(f"Error en analyze_with_sliding_window: {e}")
            raise

    def _split_into_chunks(self, text: str) -> List[str]:
        """Divide el texto en chunks con overlap."""
        chunks = []
        start = 0

        while start < len(text):
            end = start + self.chunk_size
            chunk = text[start:end]
            chunks.append(chunk)
            start += (self.chunk_size - self.overlap)

        return chunks

    def _analyze_single_chunk(
            self,
            chunk: str,
            criterio: str,
            tema: str,
            descripcion_tema: str,
            niveles: List[Dict],
            model_loader,
            prompt_builder
    ) -> Dict:
        """Analiza un único chunk."""
        try:
            # Construir hipótesis para cada nivel
            hypotheses = []
            nombres_niveles = []

            for nivel in niveles:
                nombre_nivel = nivel.get('nombre_nivel', 'Sin nombre')
                descriptores = nivel.get('descriptores', [])

                hypothesis = prompt_builder.build_hypothesis(
                    criterio=criterio,
                    nivel=nombre_nivel,
                    descriptores=descriptores  # ✅ PASAR DESCRIPTORES
                )

                hypotheses.append(hypothesis)
                nombres_niveles.append(nombre_nivel)

            # Obtener modelo
            model, tokenizer = model_loader.get_model()

            # Clasificar
            inputs = tokenizer(
                [chunk] * len(hypotheses),
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
            entailment_scores = probs[:, 2].tolist()

            # Encontrar mejor nivel
            max_idx = entailment_scores.index(max(entailment_scores))
            mejor_nivel = nombres_niveles[max_idx]
            score = entailment_scores[max_idx]

            return {
                'nivel': mejor_nivel,
                'score': score,
                'niveles': niveles  # Guardar para agregación
            }

        except Exception as e:
            log.error(f"Error en _analyze_single_chunk: {e}")
            raise

    def _aggregate_results(self, chunk_results: List[Dict]) -> Dict:
        if not chunk_results:
            return {"nivel": "Deficiente", "score": 0.0, "confidence": 0.0}

        total_chunks = len(chunk_results)

        # Pesos de evidencia
        weights = {"Excelente": 3.0, "Regular": 1.0, "Deficiente": 0.0}

        total_score_evidencia = 0.0
        total_confidence = 0.0

        for res in chunk_results:
            # Usamos .get() para evitar KeyError si falta algún campo
            nivel = res.get("nivel", "Deficiente")
            conf = res.get("confidence", 0.0)  # <--- AQUÍ ESTABA EL ERROR

            # Solo sumamos evidencia si el modelo está razonablemente seguro
            factor_confianza = 1.0 if conf > 0.4 else 0.5

            total_score_evidencia += weights.get(nivel, 0) * factor_confianza
            total_confidence += conf

        # Calcular el "Ratio de Excelencia"
        max_possible_score = total_chunks * 3.0

        ratio = total_score_evidencia / max_possible_score if max_possible_score > 0 else 0

        # Umbrales ajustados
        if ratio > 0.25:
            final_nivel = "Excelente"
        elif ratio > 0.10:
            final_nivel = "Regular"
        else:
            final_nivel = "Deficiente"

        avg_confidence = total_confidence / total_chunks if total_chunks > 0 else 0.0

        log.info(f"Agregación completada: ratio={ratio:.3f}, nivel={final_nivel}")

        return {
            "nivel": final_nivel,
            "score": ratio,
            "confidence": avg_confidence,
            "feedback": f"Evaluación basada en análisis de {total_chunks} fragmentos."
        }

    def _nivel_to_score(self, nivel: str, niveles: List[Dict]) -> float:
        """
        Convierte nivel a score numérico (0-1) basado en el puntaje_max del nivel.

        Ejemplo:
        - Excelente: puntaje_max=20 → score=1.0 (20/20)
        - Regular: puntaje_max=13 → score=0.65 (13/20)
        - Deficiente: puntaje_max=6 → score=0.30 (6/20)
        """
        try:
            # Buscar el nivel en la lista
            for n in niveles:
                if n.get('nombre_nivel') == nivel:
                    puntaje_max = n.get('puntaje_max', 0)

                    # ✅ CORREGIDO: Calcular el máximo absoluto de TODOS los niveles
                    # Esto asume que el nivel más alto define la escala (ej: 20 puntos)
                    escala_maxima = max(nv.get('puntaje_max', 0) for nv in niveles)

                    if escala_maxima > 0:
                        score = puntaje_max / escala_maxima
                        return min(1.0, max(0.0, score))
                    else:
                        return 0.0

            # Fallback: si no encuentra el nivel en la lista, usar mapeo genérico
            nivel_lower = nivel.lower()
            if 'excelente' in nivel_lower or 'sobresaliente' in nivel_lower:
                return 1.0
            elif 'bueno' in nivel_lower or 'satisfactorio' in nivel_lower:
                return 0.75
            elif 'regular' in nivel_lower or 'básico' in nivel_lower or 'aceptable' in nivel_lower:
                return 0.50
            elif 'deficiente' in nivel_lower or 'insuficiente' in nivel_lower or 'malo' in nivel_lower:
                return 0.20  # ✅ CORREGIDO: 0.20 = 4/20 puntos
            else:
                return 0.50

        except Exception as e:
            log.error(f"Error en _nivel_to_score: {e}")
            return 0.5

