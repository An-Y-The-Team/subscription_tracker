"""Auth business logic — session lifecycle and JIT user provisioning.

Imports no FastAPI symbols so it stays unit-testable in isolation.
"""

import secrets
from datetime import datetime, timedelta, timezone

from sqlmodel import delete
from sqlmodel.ext.asyncio.session import AsyncSession

from app.auth.constants import SESSION_ID_BYTES
from app.sessions.models import UserSession
from app.users.models import User


def _utcnow() -> datetime:
    return datetime.now(tz=timezone.utc)


def _as_aware(value: datetime) -> datetime:
    # Defensive: treat any naive timestamp read back from the DB as UTC.
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


async def upsert_user(session: AsyncSession, *, claims: dict[str, object]) -> User:
    """Create or update a user from validated OIDC id_token claims, keyed on ``sub``."""
    sub = str(claims.get("sub", "")).strip()
    if not sub:
        raise ValueError("OIDC claims missing 'sub'")

    email = str(claims.get("email") or "").strip()
    raw_name = claims.get("name")
    name = str(raw_name).strip() if raw_name is not None else None
    now = _utcnow()

    user = await session.get(User, sub)
    if user is None:
        user = User(id=sub, email=email, name=name, created_at=now, updated_at=now)
    else:
        if email:
            user.email = email
        user.name = name
        user.updated_at = now

    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user


async def create_session(
    session: AsyncSession,
    *,
    user_id: str,
    max_age_seconds: int,
    id_token: str | None = None,
    refresh_token: str | None = None,
) -> UserSession:
    """Mint a fresh server-side session. A new id per login avoids session fixation."""
    now = _utcnow()
    user_session = UserSession(
        id=secrets.token_urlsafe(SESSION_ID_BYTES),
        user_id=user_id,
        created_at=now,
        last_seen_at=now,
        expires_at=now + timedelta(seconds=max_age_seconds),
        id_token=id_token,
        refresh_token=refresh_token,
    )
    session.add(user_session)
    await session.commit()
    await session.refresh(user_session)
    return user_session


async def resolve_session(session: AsyncSession, *, session_id: str) -> User | None:
    """Return the user for a valid (present, not revoked, unexpired) session, else None.

    Slides ``last_seen_at`` on each successful resolve.
    """
    user_session = await session.get(UserSession, session_id)
    if user_session is None or user_session.revoked:
        return None
    if _as_aware(user_session.expires_at) <= _utcnow():
        return None

    user_session.last_seen_at = _utcnow()
    session.add(user_session)
    await session.commit()

    return await session.get(User, user_session.user_id)


async def revoke_session(
    session: AsyncSession, *, session_id: str
) -> UserSession | None:
    """Mark a session revoked (idempotent). Returns it so callers can read its id_token."""
    user_session = await session.get(UserSession, session_id)
    if user_session is None:
        return None
    user_session.revoked = True
    session.add(user_session)
    await session.commit()
    await session.refresh(user_session)
    return user_session


async def delete_expired_sessions(session: AsyncSession) -> None:
    """Sweep expired sessions. Safe to call on startup."""
    # synchronize_session=False: do the comparison in SQL (bulk delete), not in Python
    # against in-session objects.
    statement = (
        delete(UserSession)
        .where(UserSession.expires_at <= _utcnow())
        .execution_options(synchronize_session=False)
    )
    await session.exec(statement)
    await session.commit()
