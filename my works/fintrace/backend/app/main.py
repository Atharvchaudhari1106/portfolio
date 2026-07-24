"""
FinTrace — FastAPI Application Entry Point

Configures the application with CORS, lifespan events, and all route registrations.
"""

import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.database.postgres import init_db, close_db
from app.database.neo4j_driver import Neo4jDriver


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown lifecycle management."""
    # ── Startup ───────────────────────────────────────
    # Ensure upload directory exists
    os.makedirs(settings.upload_dir, exist_ok=True)

    # Initialize database (SQLite or PostgreSQL)
    await init_db()

    # Initialize Neo4j connection pool (non-fatal)
    await Neo4jDriver.connect()
    if Neo4jDriver.is_available():
        await Neo4jDriver.setup_constraints()

    # ── Print Startup Banner ──────────────────────────
    db_mode = "SQLite (local)" if settings.use_sqlite else f"PostgreSQL ({settings.postgres_host}:{settings.postgres_port})"
    neo4j_mode = f"Neo4j ({settings.neo4j_uri})" if Neo4jDriver.is_available() else "In-memory graph (Neo4j disabled)"

    print("")
    print("+----------------------------------------------+")
    print("|       FinTrace - AML Detection Platform      |")
    print("+----------------------------------------------+")
    print(f"  * Database:  {db_mode}")
    print(f"  * Graph:     {neo4j_mode}")
    print(f"  * Ollama:    {settings.ollama_base_url} ({settings.ollama_model})")
    print(f"  * API Docs:  http://localhost:{settings.app_port}/api/docs")
    print("")

    yield

    # ── Shutdown ──────────────────────────────────────
    await close_db()
    await Neo4jDriver.close()
    print("[OK] FinTrace backend shut down gracefully")


# ── Application Factory ───────────────────────────────

app = FastAPI(
    title="FinTrace",
    description="Anti-Money Laundering Detection Platform — "
    "Graph-based transaction analysis, AML detection, and AI-powered SAR generation.",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# ── CORS Middleware ───────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Route Registration ───────────────────────────────

from app.routes import auth, upload, transactions, aml, ai, dashboard  # noqa: E402

app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(upload.router, prefix="/api", tags=["Upload & Parsing"])
app.include_router(transactions.router, prefix="/api", tags=["Transactions & Graph"])
app.include_router(aml.router, prefix="/api", tags=["AML Detection"])
app.include_router(ai.router, prefix="/api", tags=["AI & SAR"])
app.include_router(dashboard.router, prefix="/api", tags=["Dashboard & Analytics"])


# ── Health Check ──────────────────────────────────────

@app.get("/api/health", tags=["System"])
async def health_check():
    """System health check endpoint."""
    return {
        "status": "healthy",
        "service": "fintrace-backend",
        "version": "1.0.0",
        "database": "sqlite" if settings.use_sqlite else "postgresql",
        "neo4j": Neo4jDriver.is_available(),
    }
