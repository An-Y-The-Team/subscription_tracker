from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import create_async_engine
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.config import get_settings

engine = create_async_engine(get_settings().database_url, echo=False, future=True)


async def get_session() -> AsyncIterator[AsyncSession]:
    # expire_on_commit=False so objects stay usable after commit without triggering
    # an implicit (sync) refresh — the standard async-SQLAlchemy setting.
    async with AsyncSession(engine, expire_on_commit=False) as session:
        yield session


SessionDep = Annotated[AsyncSession, Depends(get_session)]


async def init_db() -> None:
    """Create any missing tables. Import the table models first so they register on
    ``SQLModel.metadata`` before ``create_all`` runs.

    Note: ``create_all`` only creates missing tables; it does not alter existing ones.
    Introduce Alembic once the schema needs to evolve against real data.
    """
    from app.sessions.models import UserSession  # noqa: F401
    from app.users.models import User  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
