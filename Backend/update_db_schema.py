import logging
import os
from sqlalchemy import create_engine, text
from app.config.database import DATABASE_URL

# Configurar logging
logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

def update_schema():
    """
    Script para actualizar el esquema de la base de datos manualmente.
    Agrega la columna curso_id a la tabla evaluaciones si no existe.
    """
    try:
        log.info("Iniciando actualización de esquema...")
        
        # Crear motor de base de datos
        engine = create_engine(DATABASE_URL)
        
        with engine.connect() as connection:
            # 1. Crear tablas nuevas (Curso, MetaPorcentaje) si no existen
            # Esto lo hace SQLAlchemy normalmente, pero aseguramos
            from app.models import Base
            Base.metadata.create_all(bind=engine)
            log.info("✅ Tablas base verificadas/creadas.")

            # 2. Verificar y agregar columna curso_id a evaluaciones
            # PostgreSQL specific check
            check_column_sql = text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='evaluaciones' AND column_name='curso_id';
            """)
            
            result = connection.execute(check_column_sql).fetchone()
            
            if not result:
                log.info("⚠️ Columna 'curso_id' no encontrada en 'evaluaciones'. Agregando...")
                
                # Agregar columna
                add_column_sql = text("""
                    ALTER TABLE evaluaciones 
                    ADD COLUMN curso_id INTEGER REFERENCES cursos(id);
                """)
                connection.execute(add_column_sql)
                connection.commit()
                log.info("✅ Columna 'curso_id' agregada exitosamente.")
            else:
                log.info("✅ Columna 'curso_id' ya existe en 'evaluaciones'.")

            # 3. Migrar datos existentes (Opcional: asignar curso default si es necesario)
            # Por ahora lo dejamos nulo o el usuario tendrá que asignarlo manualmente si hay datos viejos
            
            log.info("🚀 Actualización de esquema completada.")

    except Exception as e:
        log.error(f"❌ Error actualizando esquema: {e}")
        raise

if __name__ == "__main__":
    update_schema()
