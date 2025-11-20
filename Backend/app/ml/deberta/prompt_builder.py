import logging
from typing import List

log = logging.getLogger(__name__)


class PromptBuilder:
    """Construye prompts dinámicos para DeBERTa usando descriptores de la rúbrica."""

    @staticmethod
    def build_hypothesis(
            criterio: str,
            nivel: str,
            descriptores: List[str] = None
    ) -> str:
        """
        Construye la hipótesis para DeBERTa usando los descriptores específicos del nivel.

        Args:
            criterio: Nombre del criterio (ej: "Aplicación conceptos")
            nivel: Nombre del nivel (ej: "Excelente", "Bueno")
            descriptores: Lista de descriptores del nivel
                Ejemplo: [
                    "Justifica las necesidades y/o problemática",
                    "Describe las causas más probables",
                    "Presenta información relevante"
                ]

        Returns:
            Hipótesis formateada para NLI
        """
        # Si hay descriptores específicos, usarlos
        if descriptores and len(descriptores) > 0:
            # Limpiar descriptores vacíos
            descriptores_validos = [d.strip() for d in descriptores if d and d.strip()]

            if descriptores_validos:
                # Construir hipótesis con descriptores específicos
                if len(descriptores_validos) == 1:
                    return f"Este texto demuestra {criterio} ya que {descriptores_validos[0].lower()}."
                else:
                    descriptores_str = ", ".join([d.lower() for d in descriptores_validos[:-1]])
                    descriptores_str += f" y {descriptores_validos[-1].lower()}"
                    return f"Este texto demuestra {criterio} ya que {descriptores_str}."

        # Fallback: usar prompt genérico basado en el nivel
        nivel_lower = nivel.lower()

        if 'excelente' in nivel_lower or 'sobresaliente' in nivel_lower:
            return f"Este texto demuestra {criterio} de manera excelente, completa y profunda."
        elif 'bueno' in nivel_lower or 'satisfactorio' in nivel_lower:
            return f"Este texto demuestra {criterio} de manera adecuada y satisfactoria."
        elif 'regular' in nivel_lower or 'básico' in nivel_lower or 'aceptable' in nivel_lower:
            return f"Este texto demuestra {criterio} de manera básica o limitada."
        elif 'insuficiente' in nivel_lower or 'deficiente' in nivel_lower:
            return f"Este texto no demuestra {criterio} de manera adecuada."
        else:
            return f"Este texto demuestra {criterio} a nivel {nivel}."

    @staticmethod
    def build_context_prompt(
            criterio: str,
            tema: str,
            descripcion_tema: str,
            descriptores: List[str] = None
    ) -> str:
        """
        Construye un prompt de contexto con los descriptores esperados.

        Args:
            criterio: Nombre del criterio
            tema: Tema del documento
            descripcion_tema: Descripción del tema
            descriptores: Descriptores del criterio

        Returns:
            Prompt de contexto
        """
        prompt = f"""
        Evalúa el siguiente texto académico en base al criterio: "{criterio}"

        Contexto del documento:
        - Tema: {tema}
        - Descripción: {descripcion_tema if descripcion_tema else 'N/A'}
        """

        if descriptores and len(descriptores) > 0:
            descriptores_validos = [d.strip() for d in descriptores if d and d.strip()]
            if descriptores_validos:
                prompt += f"""

        Aspectos a evaluar para este criterio:
        """
                for i, desc in enumerate(descriptores_validos, 1):
                    prompt += f"\n        {i}. {desc}"

        return prompt
