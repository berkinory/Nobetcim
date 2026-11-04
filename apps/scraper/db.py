from __future__ import annotations

from sqlalchemy import Engine, create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from config import CITY_WORKER_COUNT, DATABASE_URL

_engine: Engine | None = None
_session_factory: sessionmaker[Session] | None = None


def _engine_url() -> str:
    return DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)


def get_engine() -> Engine:
    global _engine, _session_factory
    if _engine is None:
        _engine = create_engine(
            _engine_url(),
            pool_size=CITY_WORKER_COUNT + 2,
            max_overflow=0,
            pool_pre_ping=True,
        )
        _session_factory = sessionmaker(bind=_engine, autoflush=False)
    return _engine


def session_factory() -> sessionmaker[Session]:
    get_engine()
    assert _session_factory is not None
    return _session_factory


def check_db_connection() -> bool:
    try:
        with get_engine().connect() as connection:
            connection.execute(text("SELECT 1"))
        return True
    except Exception:
        return False


def dispose_pool() -> None:
    if _engine is not None:
        _engine.dispose()
