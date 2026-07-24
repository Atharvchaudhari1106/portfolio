"""
FinTrace — Transaction Model

Stores parsed and cleaned financial transactions.
"""

import uuid
import json
from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy import (
    String,
    DateTime,
    Numeric,
    Text,
    ForeignKey,
    Integer,
    TypeDecorator,
)
from sqlalchemy.orm import Mapped, mapped_column


from app.database.postgres import Base



# ── SQLite-Compatible Types ───────────────────────────

class StringListType(TypeDecorator):
    """Stores a list of strings as JSON text. Works with both PostgreSQL and SQLite."""
    impl = Text
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return "[]"
        return json.dumps(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return []
        return json.loads(value)


class UUIDType(TypeDecorator):
    """UUID that works with both PostgreSQL (native UUID) and SQLite (String)."""
    impl = String(36)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        return str(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, uuid.UUID):
            return value
        return uuid.UUID(value)


class Transaction(Base):
    """A single financial transaction extracted from uploaded data."""

    __tablename__ = "transactions"

    id: Mapped[str] = mapped_column(
        UUIDType(),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    # ── Core Transaction Fields ───────────────────────
    sender: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
    )
    receiver: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
    )
    amount: Mapped[Decimal] = mapped_column(
        Numeric(precision=18, scale=2),
        nullable=False,
    )
    currency: Mapped[str] = mapped_column(
        String(3),
        nullable=False,
        default="INR",
    )
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(),
        nullable=False,
        index=True,
    )

    # ── Metadata ──────────────────────────────────────
    reference_number: Mapped[str] = mapped_column(
        String(100),
        nullable=True,
    )
    bank: Mapped[str] = mapped_column(
        String(100),
        nullable=True,
    )
    mode: Mapped[str] = mapped_column(
        String(50),
        nullable=True,
    )
    description: Mapped[str] = mapped_column(
        Text,
        nullable=True,
    )

    # ── Risk & Flags ──────────────────────────────────
    risk_score: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    flags: Mapped[list] = mapped_column(
        StringListType(),
        default=list,
        nullable=False,
    )

    # ── Upload Reference ──────────────────────────────
    upload_batch_id: Mapped[str] = mapped_column(
        UUIDType(),
        ForeignKey("upload_batches.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ── Audit ─────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(
        DateTime(),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<Transaction {self.sender} → {self.receiver}: {self.currency} {self.amount}>"
