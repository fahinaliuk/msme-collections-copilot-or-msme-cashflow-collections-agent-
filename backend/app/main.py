"""FastAPI main application entrypoint for MSME Collections Copilot."""

import logging
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from backend.app.config import settings, validate_production_settings
from backend.app.database import init_db
from backend.app.routers import auth, dashboard, disputes, invoices, promises, reminders, worklist, chat
from backend.app.routers import user_settings
from backend.app.utils.rate_limiter import limiter
from backend.app.utils.scheduler import start_scheduler, stop_scheduler

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    stream=sys.stdout,
    force=True,
)
logger = logging.getLogger("backend")


# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Validate configuration, initialize database, then serve."""
    # Validate production settings at startup
    issues = validate_production_settings()
    for issue in issues:
        logger.warning("CONFIG: %s", issue)

    logger.info(
        "Starting %s v%s — environment=%s db=%s",
        settings.APP_NAME,
        settings.VERSION,
        settings.ENVIRONMENT,
        "postgresql" if not settings.is_sqlite else "sqlite",
    )
    await init_db()

    # Start the BizPilot autonomous scheduler
    start_scheduler()
    logger.info("BizPilot autonomous scheduler initialized.")

    yield

    # Graceful shutdown
    stop_scheduler()
    logger.info("Shutting down.")


# ---------------------------------------------------------------------------
# Application
# ---------------------------------------------------------------------------
app = FastAPI(
    title="MSME Collections Copilot API",
    description="Backend API powering invoice ingestion, validation preview grids, "
    "collections intelligence, and WhatsApp reminders.",
    version="1.0.0",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# Rate limiting
# ---------------------------------------------------------------------------
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# ---------------------------------------------------------------------------
# Security middleware
# ---------------------------------------------------------------------------
if not settings.DEBUG:
    @app.middleware("http")
    async def add_security_headers(request: Request, call_next):
        """Inject browser security headers on every response."""
        response = await call_next(request)
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; frame-ancestors 'none';"
        )
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Global exception handler
# ---------------------------------------------------------------------------
from backend.app.utils.scheduler import autopilot_collections_job

@app.get("/api/test-autopilot")
async def trigger_autopilot_manually():
    """Hidden endpoint to manually trigger the daily autopilot job for testing."""
    import asyncio
    # Run it in the background so the request doesn't timeout if it takes long
    asyncio.create_task(autopilot_collections_job())
    return {"status": "success", "message": "Autopilot job triggered in the background. Check server logs."}

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch unhandled exceptions and return a safe JSON response."""
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An unexpected server error occurred. Please try again later."},
    )

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
app.include_router(promises.router)
app.include_router(disputes.router)
app.include_router(auth.router)
app.include_router(invoices.router)
app.include_router(dashboard.router)
app.include_router(reminders.router)
app.include_router(worklist.router)
app.include_router(chat.router)
app.include_router(user_settings.router)


# ---------------------------------------------------------------------------
# Health / status endpoints
# ---------------------------------------------------------------------------
@app.get("/api/health")
async def health_check():
    """Operational health check. Returns 200 when the API is ready."""
    return {
        "status": "healthy",
        "app_name": settings.APP_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
    }


@app.get("/")
async def root():
    """Root redirect — API docs are at /docs."""
    return {
        "app": settings.APP_NAME,
        "version": settings.VERSION,
        "docs": "/docs",
        "health": "/api/health",
    }