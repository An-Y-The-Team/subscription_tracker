from functools import lru_cache

from authlib.integrations.starlette_client import OAuth

from app.auth.constants import OIDC_PROVIDER_NAME
from app.core.config import get_settings


@lru_cache
def get_oauth() -> OAuth:
    """Build the Authlib OAuth registry once.

    Authlib lazily fetches the discovery document (and JWKS) from
    ``server_metadata_url`` on first use, so this is safe to construct even before the
    identity provider is reachable. The registered client validates the id_token
    signature, issuer, audience, expiry, and nonce automatically.
    """
    settings = get_settings()
    oauth = OAuth()
    oauth.register(
        name=OIDC_PROVIDER_NAME,
        server_metadata_url=settings.oidc_discovery_url,
        client_id=settings.oidc_client_id,
        client_secret=settings.oidc_client_secret,
        client_kwargs={
            "scope": settings.oidc_scopes,
            "code_challenge_method": "S256",
        },
    )
    return oauth
