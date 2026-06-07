from urllib.parse import urlparse

from fastapi import APIRouter, HTTPException, Request, status
from starlette.responses import RedirectResponse, Response

from app.auth import service as auth_service
from app.auth.constants import OIDC_PROVIDER_NAME, POST_LOGIN_NEXT_KEY
from app.auth.dependencies import CurrentUser
from app.auth.schemas import UserPublic
from app.core.config import SettingsDep
from app.core.database import SessionDep
from app.core.oidc import get_oauth

router = APIRouter(prefix="/auth", tags=["auth"])


def _safe_next_path(next_value: str | None) -> str | None:
    """Allow only same-app absolute paths (e.g. ``/dashboard``) to prevent open redirects."""
    if not next_value or not next_value.startswith("/"):
        return None
    parsed = urlparse(next_value)
    if parsed.scheme or parsed.netloc:
        return None
    return next_value


def _set_session_cookie(
    response: Response, *, value: str, settings: SettingsDep
) -> None:
    response.set_cookie(
        key=settings.session_cookie_name,
        value=value,
        max_age=settings.session_max_age_seconds,
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite=settings.session_cookie_samesite,
        domain=settings.session_cookie_domain,
        path="/",
    )


@router.get("/login")
async def login(
    request: Request, settings: SettingsDep, next: str | None = None
) -> Response:
    """Begin the OIDC authorization-code flow: 302 to Authentik with PKCE/state/nonce."""
    safe_next = _safe_next_path(next)
    if safe_next:
        request.session[POST_LOGIN_NEXT_KEY] = safe_next
    client = get_oauth().create_client(OIDC_PROVIDER_NAME)
    return await client.authorize_redirect(request, settings.oidc_redirect_uri)


@router.get("/callback")
async def callback(
    request: Request, session: SessionDep, settings: SettingsDep
) -> Response:
    """Exchange the code, validate the id_token, JIT-provision the user, open a session."""
    client = get_oauth().create_client(OIDC_PROVIDER_NAME)
    try:
        token = await client.authorize_access_token(request)
    except Exception as exc:  # Authlib raises on state/nonce/signature/exchange failure
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OIDC callback validation failed",
        ) from exc

    claims = token.get("userinfo")
    if not claims:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OIDC token missing identity claims",
        )

    user = await auth_service.upsert_user(session, claims=dict(claims))
    user_session = await auth_service.create_session(
        session,
        user_id=user.id,
        max_age_seconds=settings.session_max_age_seconds,
        id_token=token.get("id_token"),
        refresh_token=token.get("refresh_token"),
    )

    next_path = request.session.pop(POST_LOGIN_NEXT_KEY, None)
    redirect_url = (
        f"{settings.frontend_url}{next_path}"
        if next_path
        else settings.frontend_post_login_url
    )

    response = RedirectResponse(url=redirect_url, status_code=status.HTTP_303_SEE_OTHER)
    _set_session_cookie(response, value=user_session.id, settings=settings)
    return response


@router.api_route("/logout", methods=["GET", "POST"])
async def logout(
    request: Request, session: SessionDep, settings: SettingsDep
) -> Response:
    """Revoke the server session and clear the cookie, then redirect to the frontend."""
    session_id = request.cookies.get(settings.session_cookie_name)
    if session_id:
        await auth_service.revoke_session(session, session_id=session_id)

    response = RedirectResponse(
        url=settings.oidc_post_logout_redirect_uri,
        status_code=status.HTTP_303_SEE_OTHER,
    )
    response.delete_cookie(
        key=settings.session_cookie_name,
        domain=settings.session_cookie_domain,
        path="/",
    )
    return response


@router.get("/me", response_model=UserPublic)
async def me(user: CurrentUser) -> UserPublic:
    return UserPublic.model_validate(user)
