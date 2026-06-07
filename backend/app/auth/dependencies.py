from typing import Annotated

from fastapi import Depends, HTTPException, Request, status

from app.auth import service as auth_service
from app.core.config import SettingsDep
from app.core.database import SessionDep
from app.users.models import User


async def get_current_user(
    request: Request,
    session: SessionDep,
    settings: SettingsDep,
) -> User:
    session_id = request.cookies.get(settings.session_cookie_name)
    if not session_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    user = await auth_service.resolve_session(session, session_id=session_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired or invalid",
        )
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
