from datetime import datetime, timezone

from sqlalchemy import DateTime
from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(tz=timezone.utc)


class UserSession(SQLModel, table=True):
    """A server-side session backing the httponly cookie issued by the BFF.

    ``id`` is the opaque value stored in the cookie. The OIDC tokens are kept only to
    support optional silent refresh and RP-initiated logout; they are never sent to
    the browser.
    """

    id: str = Field(primary_key=True)
    user_id: str = Field(foreign_key="user.id", index=True)
    created_at: datetime = Field(
        default_factory=_utcnow, sa_type=DateTime(timezone=True)
    )
    last_seen_at: datetime = Field(
        default_factory=_utcnow, sa_type=DateTime(timezone=True)
    )
    expires_at: datetime = Field(sa_type=DateTime(timezone=True))
    revoked: bool = Field(default=False)
    id_token: str | None = Field(default=None)
    refresh_token: str | None = Field(default=None)
