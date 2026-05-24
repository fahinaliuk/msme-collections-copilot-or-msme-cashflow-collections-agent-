"""FastAPI main application entrypoint."""

from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from backend.app.config import settings
from backend.app.database import init_db
from backend.app.routers import auth, dashboard, invoices, reminders


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan event handler to initialize the database tables on startup."""
    await init_db()
    yield


app = FastAPI(
    title="MSME Collections Copilot API",
    description="Backend API powering invoice ingestion, validation preview grids, collections intelligence, and WhatsApp reminders.",
    version="1.0.0",
    lifespan=lifespan,
)

# ==========================================
# SECURITY MIDDLEWARE
# ==========================================

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Middleware that injects browser security headers on all responses."""
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Content-Security-Policy"] = "default-src 'self'; frame-ancestors 'none';"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response


app.add_middleware(SecurityHeadersMiddleware)

# Enable CORS for frontend API requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# EXCEPTION HANDLER
# ==========================================

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Format all unhandled server exceptions into clean, user-friendly JSON models."""
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": f"An unexpected server error occurred: {str(exc)}"},
    )

# ==========================================
# MOUNT ROUTERS
# ==========================================

app.include_router(auth.router)
app.include_router(invoices.router)
app.include_router(dashboard.router)
app.include_router(reminders.router)


@app.get("/api/health")
async def health_check():
    """Retrieve operational status check of the backend APIs."""
    return {
        "status": "healthy",
        "app_name": settings.APP_NAME,
        "version": settings.VERSION,
    }
