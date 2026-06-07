from sqlmodel import func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.auth import service as auth_service
from app.sessions.models import UserSession

CLAIMS = {"sub": "sub-123", "email": "alice@example.com", "name": "Alice"}


async def test_upsert_user_creates_then_updates(session: AsyncSession) -> None:
    user = await auth_service.upsert_user(session, claims=CLAIMS)
    assert user.id == "sub-123"
    assert user.email == "alice@example.com"
    assert user.name == "Alice"

    # Same sub -> same row, fields updated (not a duplicate).
    updated = await auth_service.upsert_user(
        session,
        claims={"sub": "sub-123", "email": "new@example.com", "name": "Alice B"},
    )
    assert updated.id == "sub-123"
    assert updated.email == "new@example.com"
    assert updated.name == "Alice B"


async def test_session_resolves_then_revokes(session: AsyncSession) -> None:
    user = await auth_service.upsert_user(session, claims=CLAIMS)
    user_session = await auth_service.create_session(
        session, user_id=user.id, max_age_seconds=3600
    )

    resolved = await auth_service.resolve_session(session, session_id=user_session.id)
    assert resolved is not None
    assert resolved.id == user.id

    # Unknown id never resolves.
    assert (
        await auth_service.resolve_session(session, session_id="does-not-exist") is None
    )

    # Revoked id no longer resolves.
    await auth_service.revoke_session(session, session_id=user_session.id)
    assert (
        await auth_service.resolve_session(session, session_id=user_session.id) is None
    )


async def test_expired_session_not_resolved(session: AsyncSession) -> None:
    user = await auth_service.upsert_user(session, claims=CLAIMS)
    expired = await auth_service.create_session(
        session, user_id=user.id, max_age_seconds=-10
    )
    assert await auth_service.resolve_session(session, session_id=expired.id) is None


async def test_delete_expired_sessions_keeps_valid(session: AsyncSession) -> None:
    user = await auth_service.upsert_user(session, claims=CLAIMS)
    await auth_service.create_session(session, user_id=user.id, max_age_seconds=-10)
    valid = await auth_service.create_session(
        session, user_id=user.id, max_age_seconds=3600
    )

    await auth_service.delete_expired_sessions(session)

    remaining = (
        await session.exec(select(func.count()).select_from(UserSession))
    ).one()
    assert remaining == 1
    assert await session.get(UserSession, valid.id) is not None
