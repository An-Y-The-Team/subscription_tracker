from httpx import AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession

from app.auth import service as auth_service
from app.core.config import get_settings

CLAIMS = {"sub": "sub-xyz", "email": "me@example.com", "name": "Me"}
COOKIE_NAME = get_settings().session_cookie_name


def _cookie_header(value: str) -> dict[str, str]:
    return {"Cookie": f"{COOKIE_NAME}={value}"}


async def test_me_requires_authentication(client: AsyncClient) -> None:
    response = await client.get("/auth/me")
    assert response.status_code == 401


async def test_me_returns_current_user(
    client: AsyncClient, session: AsyncSession
) -> None:
    user = await auth_service.upsert_user(session, claims=CLAIMS)
    user_session = await auth_service.create_session(
        session, user_id=user.id, max_age_seconds=3600
    )

    response = await client.get("/auth/me", headers=_cookie_header(user_session.id))

    assert response.status_code == 200
    assert response.json() == {
        "id": "sub-xyz",
        "email": "me@example.com",
        "name": "Me",
    }


async def test_me_rejects_unknown_cookie(client: AsyncClient) -> None:
    response = await client.get("/auth/me", headers=_cookie_header("bogus-session-id"))
    assert response.status_code == 401


async def test_me_rejects_revoked_session(
    client: AsyncClient, session: AsyncSession
) -> None:
    user = await auth_service.upsert_user(session, claims=CLAIMS)
    user_session = await auth_service.create_session(
        session, user_id=user.id, max_age_seconds=3600
    )
    await auth_service.revoke_session(session, session_id=user_session.id)

    response = await client.get("/auth/me", headers=_cookie_header(user_session.id))
    assert response.status_code == 401
