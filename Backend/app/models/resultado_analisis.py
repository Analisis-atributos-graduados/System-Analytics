from sqlalchemy import Column, Integer, Float, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.config.database import Base

class ResultadoAnalisis(Base):

    __tablename__ = "resultados_analisis"

    id = Column(Integer, primary_key=True, index=True)
    evaluacion_id = Column(Integer, ForeignKey("evaluaciones.id"), nullable=False, unique=True)

    criterios_evaluados = Column(JSON, nullable=True)

    nota_final = Column(Float, default=0.0)

    feedback_general = Column(Text)

    resultado_evaluacion_id = Column(Integer, ForeignKey("resultados_evaluacion.id"), nullable=True)

    evaluacion = relationship("Evaluacion", back_populates="resultado_analisis")
    resultado_evaluacion = relationship("ResultadoEvaluacion", back_populates="resultados_analisis", lazy="joined")

    @property
    def hallazgos(self):
        return self.resultado_evaluacion.hallazgos if self.resultado_evaluacion else None

    @hallazgos.setter
    def hallazgos(self, value):
        from app.models.resultado_evaluacion import ResultadoEvaluacion
        if not self.resultado_evaluacion:
            self.resultado_evaluacion = ResultadoEvaluacion()
        self.resultado_evaluacion.hallazgos = value

    @property
    def fortalezas(self):
        return self.resultado_evaluacion.fortalezas if self.resultado_evaluacion else None

    @fortalezas.setter
    def fortalezas(self, value):
        from app.models.resultado_evaluacion import ResultadoEvaluacion
        if not self.resultado_evaluacion:
            self.resultado_evaluacion = ResultadoEvaluacion()
        self.resultado_evaluacion.fortalezas = value

    @property
    def oportunidades(self):
        return self.resultado_evaluacion.oportunidades if self.resultado_evaluacion else None

    @oportunidades.setter
    def oportunidades(self, value):
        from app.models.resultado_evaluacion import ResultadoEvaluacion
        if not self.resultado_evaluacion:
            self.resultado_evaluacion = ResultadoEvaluacion()
        self.resultado_evaluacion.oportunidades = value

