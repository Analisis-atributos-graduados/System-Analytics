import logging
from typing import TypeVar, Generic, List, Optional, Type
from sqlalchemy.orm import Session

log = logging.getLogger(__name__)

ModelType = TypeVar("ModelType")


class BaseRepository(Generic[ModelType]):
    """
    Repositorio base con operaciones CRUD genéricas.
    """

    def __init__(self, db: Session, model: Type[ModelType]):
        """
        Inicializa el repositorio.

        Args:
            db: Sesión de SQLAlchemy
            model: Clase del modelo (ej: Usuario, Rubrica)
        """
        self._db = db  # ✅ Guardar como _db (privado)
        self.model = model  # ✅ Guardar el modelo

    @property
    def db(self) -> Session:
        """Propiedad para acceder a la sesión"""
        return self._db

    def get_by_id(self, id: int) -> Optional[ModelType]:
        """
        Obtiene una entidad por su ID.

        Args:
            id: ID de la entidad

        Returns:
            Entidad encontrada o None
        """
        try:
            return self._db.query(self.model).filter(self.model.id == id).first()
        except Exception as e:
            log.error(f"Error al obtener {self.model.__name__} con ID {id}: {e}")
            raise

    def get_all(self, skip: int = 0, limit: int = 100) -> List[ModelType]:
        """
        Obtiene todas las entidades con paginación.

        Args:
            skip: Cantidad de registros a saltar
            limit: Cantidad máxima de registros a devolver

        Returns:
            Lista de entidades
        """
        try:
            return self._db.query(self.model).offset(skip).limit(limit).all()
        except Exception as e:
            log.error(f"Error al obtener listado de {self.model.__name__}: {e}")
            raise

    def create(self, entity: ModelType) -> ModelType:
        """
        Crea una nueva entidad.

        Args:
            entity: Entidad a crear

        Returns:
            Entidad creada con ID asignado
        """
        try:
            self._db.add(entity)
            self._db.commit()
            self._db.refresh(entity)
            log.info(f"Creado {self.model.__name__} con ID {entity.id}")
            return entity
        except Exception as e:
            self._db.rollback()
            log.error(f"Error al crear {self.model.__name__}: {e}")
            raise

    def update(self, id: int, **kwargs) -> Optional[ModelType]:
        """
        Actualiza una entidad existente.

        Args:
            id: ID de la entidad a actualizar
            **kwargs: Campos a actualizar

        Returns:
            Entidad actualizada o None si no existe
        """
        try:
            entity = self.get_by_id(id)
            if not entity:
                return None

            for key, value in kwargs.items():
                if hasattr(entity, key):
                    setattr(entity, key, value)

            self._db.commit()
            self._db.refresh(entity)
            log.info(f"Actualizado {self.model.__name__} con ID {id}")
            return entity
        except Exception as e:
            self._db.rollback()
            log.error(f"Error al actualizar {self.model.__name__} con ID {id}: {e}")
            raise

    def delete(self, id: int) -> bool:
        """
        Elimina una entidad.

        Args:
            id: ID de la entidad a eliminar

        Returns:
            True si se eliminó, False si no existía
        """
        try:
            entity = self.get_by_id(id)
            if not entity:
                return False

            self._db.delete(entity)
            self._db.commit()
            log.info(f"Eliminado {self.model.__name__} con ID {id}")
            return True
        except Exception as e:
            self._db.rollback()
            log.error(f"Error al eliminar {self.model.__name__} con ID {id}: {e}")
            raise
