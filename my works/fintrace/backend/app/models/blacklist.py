"""
FinTrace — Blacklisted Account Model

Stores known suspicious/blacklisted account identifiers.
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database.postgres import Base
from app.models.transaction import UUIDType


class BlacklistedAccount(Base):
    """A known suspicious or blacklisted account from uploaded lists."""

    __tablename__ = "blacklisted_accounts"

    id: Mapped[str] = mapped_column(
        UUIDType(),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    account_id: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        unique=True,
        index=True,
    )
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=True,
    )
    reason: Mapped[str] = mapped_column(
        Text,
        nullable=True,
    )
    source: Mapped[str] = mapped_column(
        String(100),
        nullable=True,
    )
    added_at: Mapped[datetime] = mapped_column(
        DateTime(),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<Blacklisted {self.account_id}: {self.reason}>"
