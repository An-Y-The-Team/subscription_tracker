from app.core.schemas import CamelModel


class UserPublic(CamelModel):
    """Safe representation of the authenticated user (the /auth/me response)."""

    id: str
    email: str
    name: str | None = None
