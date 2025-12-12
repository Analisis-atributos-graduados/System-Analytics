import logging
from typing import TypeVar, Generic, List, Optional, Type
from sqlalchemy.orm import Session

log = logging.getLogger(__name__)

ModelType = TypeVar("ModelType")


class BaseRepository(Generic[ModelType]):

    def __init__(self, db: Session, model: Type[ModelType]):

        self._db = db
        self.model = model

    @property
    def db(self) -> Session:
        return self._db

    def get_by_id(self, id: int) -> Optional[ModelType]:

        try:
            return self._db.query(self.model).filter(self.model.id == id).first()
        except Exception as e:
            log.error(f"Error al obtener {self.model.__name__} con ID {id}: {e}")
            raise

    def get_all(self, skip: int = 0, limit: int = 100) -> List[ModelType]:

        try:
            return self._db.query(self.model).offset(skip).limit(limit).all()
        except Exception as e:
            log.error(f"Error al obtener listado de {self.model.__name__}: {e}")
            raise

    def create(self, entity: ModelType) -> ModelType:

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
