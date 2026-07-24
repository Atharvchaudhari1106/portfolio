"""
FinTrace — Database Driver

Async SQLAlchemy engine and session management.
Supports PostgreSQL (production) and SQLite (local dev).
"""

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings


# ── Async Engine ──────────────────────────────────────

_engine_kwargs = {
    "echo": (settings.app_env == "development"),
}

if settings.use_sqlite:
    # SQLite needs these specific settings
    _engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    _engine_kwargs["pool_size"] = 20
    _engine_kwargs["max_overflow"] = 10
    _engine_kwargs["pool_pre_ping"] = True

engine = create_async_engine(settings.postgres_url, **_engine_kwargs)

# ── Session Factory ───────────────────────────────────

async_session = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


# ── Base Model ────────────────────────────────────────

class Base(DeclarativeBase):
    """Base class for all SQLAlchemy ORM models."""
    pass


# ── Dependency ────────────────────────────────────────

async def get_db() -> AsyncSession:
    """FastAPI dependency: yield a database session per request."""
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


# ── Lifecycle ─────────────────────────────────────────

async def init_db():
    """Create all tables (development only — use Alembic in production)."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def close_db():
    """Dispose the engine connection pool."""
    await engine.dispose()
