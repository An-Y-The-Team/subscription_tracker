from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from app.auth.router import router as auth_router
from app.core.config import get_settings
from app.core.database import init_db

settings = get_settings()

# The OIDC flow round-trip (login -> Authentik -> callback) is short-lived.
FLOW_SESSION_MAX_AGE_SECONDS = 600


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.http_client = httpx.AsyncClient(timeout=10.0)
    await init_db()
    try:
        yield
    finally:
        await app.state.http_client.aclose()


app = FastAPI(
    title="Household Management API",
    description="Backend API for the Household Management app",
    version="0.1.0",
    lifespan=lifespan,
)

# Backs Authlib's transient OIDC flow state (PKCE verifier, state, nonce) between
# /auth/login and /auth/callback. This is the flow cookie, NOT the app session cookie.
app.add_middleware(
    SessionMiddleware,
    secret_key=settings.session_secret,
    same_site="lax",
    https_only=settings.session_cookie_secure,
    max_age=FLOW_SESSION_MAX_AGE_SECONDS,
)

# CORS is added last so it is the outermost middleware (handles preflight first).
# Explicit origins are required because credentials are allowed.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)


@app.get("/")
async def root():
    return {
        "message": "Welcome to the Household Management API",
        "docs_url": "/docs",
        "status": "healthy",
    }


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "version": "0.1.0",
    }
