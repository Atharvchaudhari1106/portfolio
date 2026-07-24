"""
FinTrace — Authentication Routes

JWT login, registration, token refresh, and user profile endpoints.
"""

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import (
    UserRole,
    TokenPair,
    TokenData,
    hash_password,
    verify_password,
    create_token_pair,
    decode_token,
    get_current_user,
    require_role,
)
from app.database.postgres import get_db
from app.models.user import User


router = APIRouter()


# ── Request/Response Schemas ──────────────────────────

class RegisterRequest(BaseModel):
    username: str
    email: EmailStr
    full_name: str
    password: str
    role: UserRole = UserRole.INVESTIGATOR


class UserResponse(BaseModel):
    id: str
    username: str
    email: str
    full_name: str
    role: str
    is_active: bool
    created_at: str
    last_login: Optional[str] = None


class RefreshRequest(BaseModel):
    refresh_token: str


# ── Endpoints ─────────────────────────────────────────

@router.post("/login", response_model=TokenPair)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    """Authenticate user and return JWT token pair."""
    # Find user by username
    result = await db.execute(
        select(User).where(User.username == form_data.username)
    )
    user = result.scalar_one_or_none()

    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled",
        )

    # Update last login
    user.last_login = datetime.now(timezone.utc)
    await db.flush()

    # Generate tokens
    return create_token_pair(
        user_id=str(user.id),
        username=user.username,
        role=user.role.value if isinstance(user.role, UserRole) else user.role,
    )


@router.post("/register", response_model=UserResponse)
async def register(
    request: RegisterRequest,
    db: AsyncSession = Depends(get_db),
    current_user: TokenData = Depends(require_role([UserRole.ADMIN])),
):
    """Register a new user (admin only)."""
    # Check if username or email already exists
    existing = await db.execute(
        select(User).where(
            (User.username == request.username) | (User.email == request.email)
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username or email already exists",
        )

    user = User(
        username=request.username,
        email=request.email,
        full_name=request.full_name,
        hashed_password=hash_password(request.password),
        role=request.role.value if isinstance(request.role, UserRole) else request.role,
    )
    db.add(user)
    await db.flush()

    return UserResponse(
        id=str(user.id),
        username=user.username,
        email=user.email,
        full_name=user.full_name,
        role=user.role.value if isinstance(user.role, UserRole) else user.role,
        is_active=user.is_active,
        created_at=user.created_at.isoformat(),
    )


@router.get("/me", response_model=UserResponse)
async def get_current_profile(
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the current authenticated user's profile."""
    result = await db.execute(
        select(User).where(User.id == current_user.user_id)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return UserResponse(
        id=str(user.id),
        username=user.username,
        email=user.email,
        full_name=user.full_name,
        role=user.role.value if isinstance(user.role, UserRole) else user.role,
        is_active=user.is_active,
        created_at=user.created_at.isoformat(),
        last_login=user.last_login.isoformat() if user.last_login else None,
    )


@router.post("/refresh", response_model=TokenPair)
async def refresh_token(request: RefreshRequest):
    """Refresh an access token using a valid refresh token."""
    token_data = decode_token(request.refresh_token)
    return create_token_pair(
        user_id=token_data.user_id,
        username=token_data.username,
        role=token_data.role.value if isinstance(token_data.role, UserRole) else token_data.role,
    )


@router.post("/setup", response_model=UserResponse)
async def initial_setup(
    db: AsyncSession = Depends(get_db),
):
    """
    Create the initial admin user if no users exist.
    This endpoint only works when the database is empty.
    """
    result = await db.execute(select(User).limit(1))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Initial setup already completed. Users exist in the database.",
        )

    admin = User(
        username="admin",
        email="admin@fintrace.local",
        full_name="System Administrator",
        hashed_password=hash_password("admin123"),
        role=UserRole.ADMIN.value,
    )
    db.add(admin)
    await db.flush()

    return UserResponse(
        id=str(admin.id),
        username=admin.username,
        email=admin.email,
        full_name=admin.full_name,
        role=admin.role.value if isinstance(admin.role, UserRole) else admin.role,
        is_active=admin.is_active,
        created_at=admin.created_at.isoformat(),
    )
