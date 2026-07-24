"""
FinTrace — Upload Batch Model

Tracks file uploads and their processing status.
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.database.postgres import Base
from app.models.transaction import UUIDType


class UploadBatch(Base):
    """Represents a single file upload and its processing state."""

    __tablename__ = "upload_batches"

    id: Mapped[str] = mapped_column(
        UUIDType(),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    filename: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    file_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )
    file_size_bytes: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="pending",
    )
    record_count: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    error_message: Mapped[str] = mapped_column(
        String(1000),
        nullable=True,
    )

    # ── Upload User ───────────────────────────────────
    uploaded_by: Mapped[str] = mapped_column(
        UUIDType(),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # ── Cleaning Summary ──────────────────────────────
    duplicates_removed: Mapped[int] = mapped_column(Integer, default=0)
    invalid_removed: Mapped[int] = mapped_column(Integer, default=0)
    records_cleaned: Mapped[int] = mapped_column(Integer, default=0)

    def __repr__(self) -> str:
        return f"<Upload {self.filename} ({self.status}): {self.record_count} records>"
