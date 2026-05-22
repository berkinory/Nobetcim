from __future__ import annotations

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from config import CITY_WORKER_COUNT, DATABASE_URL

_engine = None
_session_factory: sessionmaker[Session] | None = None


def get_database_url() -> str:
    if DATABASE_URL.startswith("postgresql://"):
        return DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)
    return DATABASE_URL


def get_engine():
    global _engine, _session_factory

    if _engine is None:
        _engine = create_engine(
            get_database_url(),
            pool_size=max(CITY_WORKER_COUNT + 2, 4),
            max_overflow=0,
            pool_pre_ping=True,
        )
        _session_factory = sessionmaker(
            bind=_engine,
            autoflush=False,
            autocommit=False,
        )

    return _engine


def get_session_factory() -> sessionmaker[Session]:
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
