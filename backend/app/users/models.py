from datetime import datetime, timezone

from sqlalchemy import DateTime
from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(tz=timezone.utc)


class User(SQLModel, table=True):
    """A user provisioned just-in-time from Authentik OIDC claims.

    The primary key is the OIDC ``sub`` claim (a stable, opaque subject id). Email is
    mutable at the identity provider, so it must not be the key.
    """

    id: str = Field(primary_key=True)
    email: str = Field(index=True, unique=True)
    name: str | None = Field(default=None)
    is_active: bool = Field(default=True)
    created_at: datetime = Field(
        default_factory=_utcnow, sa_type=DateTime(timezone=True)
    )
    updated_at: datetime = Field(
        default_factory=_utcnow, sa_type=DateTime(timezone=True)
    )
