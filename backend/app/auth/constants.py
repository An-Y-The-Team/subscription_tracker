# Name the Authlib client is registered under in the OAuth registry.
OIDC_PROVIDER_NAME = "authentik"

# Byte length for the opaque session id (token_urlsafe(32) -> ~43 url-safe chars).
SESSION_ID_BYTES = 32

# Key under which the post-login redirect target is stashed in the transient flow
# session (Starlette SessionMiddleware) between /auth/login and /auth/callback.
POST_LOGIN_NEXT_KEY = "post_login_next"
