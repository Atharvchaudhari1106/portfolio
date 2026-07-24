"""
FinTrace — Security Module

JWT token management, password hashing, and role-based access control.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional, List
from enum import Enum

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext  # noqa: F401 (kept for potential migration)
from pydantic import BaseModel

from app.core.config import settings


import bcrypt


def hash_password(password: str) -> str:
    """Hash a plaintext password using bcrypt."""
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against a bcrypt hash."""
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8")
        )
    except Exception:
        return False


# ── User Roles ────────────────────────────────────────

class UserRole(str, Enum):
    ADMIN = "admin"
    AUDITOR = "auditor"
    INVESTIGATOR = "investigator"


# ── JWT Token Models ──────────────────────────────────

class TokenData(BaseModel):
    user_id: str
    username: str
    role: UserRole


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


# ── JWT Token Creation ───────────────────────────────

def create_access_token(
    user_id: str,
    username: str,
    role: str,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """Create a signed JWT access token."""
    expire = datetime.now(timezone.utc) + (
        expires_delta
        or timedelta(minutes=settings.jwt_access_token_expire_minutes)
    )
    payload = {
        "sub": user_id,
        "username": username,
        "role": role,
        "exp": expire,
        "type": "access",
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_refresh_token(
    user_id: str,
    username: str,
    role: str,
) -> str:
    """Create a signed JWT refresh token with longer expiry."""
    expire = datetime.now(timezone.utc) + timedelta(
        days=settings.jwt_refresh_token_expire_days
    )
    payload = {
        "sub": user_id,
        "username": username,
        "role": role,
        "exp": expire,
        "type": "refresh",
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_token_pair(user_id: str, username: str, role: str) -> TokenPair:
    """Create both access and refresh tokens."""
    return TokenPair(
        access_token=create_access_token(user_id, username, role),
        refresh_token=create_refresh_token(user_id, username, role),
    )


# ── JWT Token Verification ───────────────────────────

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def decode_token(token: str) -> TokenData:
    """Decode and validate a JWT token, returning its payload."""
    try:
        payload = jwt.decode(
            token, settings.jwt_secret, algorithms=[settings.jwt_algorithm]
        )
        user_id = payload.get("sub")
        username = payload.get("username")
        role = payload.get("role")
        if user_id is None or username is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: missing claims",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return TokenData(user_id=user_id, username=username, role=UserRole(role))
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token validation failed: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


# ── Dependency Injection ─────────────────────────────

async def get_current_user(token: str = Depends(oauth2_scheme)) -> TokenData:
    """FastAPI dependency: extract and validate current user from JWT."""
    return decode_token(token)


def require_role(allowed_roles: List[UserRole]):
    """
    FastAPI dependency factory: restrict access to specific roles.

    Usage:
        @router.get("/admin-only", dependencies=[Depends(require_role([UserRole.ADMIN]))])
    """

    async def role_checker(current_user: TokenData = Depends(get_current_user)):
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role: {[r.value for r in allowed_roles]}",
            )
        return current_user

    return role_checker
