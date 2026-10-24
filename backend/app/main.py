from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.db import close_pool, init_pool
from app.routers import account, accounts, admin, auth, invitations, mailboxes, messages, owners


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_pool()
    yield
    close_pool()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="YoyKnowMail App API",
        version="1.0.0",
        lifespan=lifespan,
        docs_url=None if settings.is_production else "/docs",
        redoc_url=None,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "X-CSRF-Token", "X-Requested-With"],
    )

    @app.get("/app-health")
    def app_health():
        return {"ok": True, "service": "yoyknowmail-app"}

    app.include_router(auth.router)
    app.include_router(account.router)
    app.include_router(mailboxes.router)
    app.include_router(messages.router)
    app.include_router(admin.router)
    app.include_router(accounts.router)
    app.include_router(owners.router)
    app.include_router(invitations.router)
    return app


app = create_app()
