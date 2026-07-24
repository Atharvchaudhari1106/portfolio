"""
FinTrace — Upload & Parse Routes

File upload, parsing trigger, and upload status endpoints.
"""

import os
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import TokenData, get_current_user
from app.database.postgres import get_db
from app.models.upload import UploadBatch
from app.models.transaction import Transaction
from app.services.parser import UnifiedParser
from app.services.cleaner import DataCleaner
from app.services.graph import GraphBuilder


router = APIRouter()


# ── Response Schemas ──────────────────────────────────

class UploadResponse(BaseModel):
    id: str
    filename: str
    file_type: str
    file_size_bytes: int
    status: str
    record_count: int
    message: str


class ParseResponse(BaseModel):
    upload_id: str
    status: str
    record_count: int
    cleaning_report: dict
    message: str


class UploadListItem(BaseModel):
    id: str
    filename: str
    file_type: str
    status: str
    record_count: int
    uploaded_at: str
    duplicates_removed: Optional[int] = 0
    invalid_removed: Optional[int] = 0


# ── Helper Functions ──────────────────────────────────
def _safe_str_value(val) -> Optional[str]:
    import pandas as pd
    if val is None or pd.isna(val):
        return None
    s = str(val).strip()
    if s.lower() in ("", "none", "nan", "nat", "<na>"):
        return None
    return s


# ── Endpoints ─────────────────────────────────────────

@router.post("/upload", response_model=UploadResponse)
async def upload_file(
    file: UploadFile = File(...),
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload a transaction file (CSV, Excel, or PDF).
    File is saved and a batch record is created for tracking.
    """
    # Validate file size
    content = await file.read()
    if len(content) > settings.max_upload_size_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Maximum: {settings.max_upload_size_mb}MB",
        )

    # Detect file type
    try:
        file_type = UnifiedParser.detect_type(file.filename, file.content_type)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Save file to disk
    batch_id = uuid.uuid4()
    safe_filename = f"{batch_id}_{file.filename}"
    file_path = os.path.join(settings.upload_dir, safe_filename)
    os.makedirs(settings.upload_dir, exist_ok=True)

    with open(file_path, "wb") as f:
        f.write(content)

    # Create upload batch record
    batch = UploadBatch(
        id=batch_id,
        filename=file.filename,
        file_type=file_type,
        file_size_bytes=len(content),
        status="pending",
        uploaded_by=current_user.user_id,
    )
    db.add(batch)
    await db.flush()

    return UploadResponse(
        id=str(batch_id),
        filename=file.filename,
        file_type=file_type,
        file_size_bytes=len(content),
        status="pending",
        record_count=0,
        message="File uploaded successfully. Call POST /api/parse to process.",
    )


@router.post("/parse", response_model=ParseResponse)
async def parse_upload(
    upload_id: str,
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Parse an uploaded file: extract transactions, clean data, build graph.

    This triggers the full pipeline:
    1. File parsing (CSV/Excel/PDF)
    2. Data cleaning & validation
    3. PostgreSQL transaction storage
    4. Neo4j graph construction
    """
    # Find the upload batch
    result = await db.execute(
        select(UploadBatch).where(UploadBatch.id == upload_id)
    )
    batch = result.scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="Upload batch not found")

    if batch.status == "completed":
        raise HTTPException(status_code=400, detail="Upload already processed")

    # Update status
    batch.status = "processing"
    await db.flush()

    try:
        # Read file from disk
        safe_filename = f"{batch.id}_{batch.filename}"
        file_path = os.path.join(settings.upload_dir, safe_filename)

        with open(file_path, "rb") as f:
            content = f.read()

        # Step 1: Parse
        df, file_type = UnifiedParser.parse(content, batch.filename)

        # Step 2: Clean
        df, cleaning_report = DataCleaner.clean(df)

        # Step 3: Store transactions in PostgreSQL
        transactions_created = 0
        for _, row in df.iterrows():
            tx = Transaction(
                sender=_safe_str_value(row.get("sender")) or "Unknown",
                receiver=_safe_str_value(row.get("receiver")) or "Unknown",
                amount=float(row["amount"]),
                currency=_safe_str_value(row.get("currency")) or "INR",
                timestamp=row["timestamp"],
                reference_number=_safe_str_value(row.get("reference_number")),
                bank=_safe_str_value(row.get("bank")),
                mode=_safe_str_value(row.get("mode")),
                description=_safe_str_value(row.get("description")),
                upload_batch_id=batch.id,
            )
            db.add(tx)
            transactions_created += 1

        await db.flush()

        # Step 4: Build Neo4j graph
        graph_result = await GraphBuilder.build_from_dataframe(df, str(batch.id))

        # Update batch
        batch.status = "completed"
        batch.record_count = transactions_created
        batch.duplicates_removed = cleaning_report.duplicates_removed
        batch.invalid_removed = cleaning_report.invalid_removed
        batch.records_cleaned = cleaning_report.records_cleaned
        await db.flush()

        return ParseResponse(
            upload_id=str(batch.id),
            status="completed",
            record_count=transactions_created,
            cleaning_report=cleaning_report.to_dict(),
            message=(
                f"Successfully parsed {transactions_created} transactions. "
                f"Graph: {graph_result.get('nodes_created', 0)} nodes, "
                f"{graph_result.get('relationships_created', 0)} edges created."
            ),
        )

    except Exception as e:
        batch.status = "failed"
        batch.error_message = str(e)[:1000]
        await db.flush()

        raise HTTPException(
            status_code=500,
            detail=f"Parsing failed: {str(e)}",
        )


@router.get("/uploads")
async def list_uploads(
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all file uploads with their processing status."""
    result = await db.execute(
        select(UploadBatch).order_by(UploadBatch.uploaded_at.desc())
    )
    batches = result.scalars().all()

    return [
        UploadListItem(
            id=str(b.id),
            filename=b.filename,
            file_type=b.file_type,
            status=b.status,
            record_count=b.record_count,
            uploaded_at=b.uploaded_at.isoformat(),
            duplicates_removed=b.duplicates_removed or 0,
            invalid_removed=b.invalid_removed or 0,
        )
        for b in batches
    ]


@router.get("/uploads/{upload_id}")
async def get_upload_detail(
    upload_id: str,
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get detailed info about an upload including parsed records."""
    result = await db.execute(
        select(UploadBatch).where(UploadBatch.id == upload_id)
    )
    batch = result.scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="Upload not found")

    # Get associated transactions
    tx_result = await db.execute(
        select(Transaction)
        .where(Transaction.upload_batch_id == upload_id)
        .limit(100)
    )
    transactions = tx_result.scalars().all()

    return {
        "upload": {
            "id": str(batch.id),
            "filename": batch.filename,
            "file_type": batch.file_type,
            "status": batch.status,
            "record_count": batch.record_count,
            "uploaded_at": batch.uploaded_at.isoformat(),
            "error_message": batch.error_message,
            "cleaning_summary": {
                "duplicates_removed": batch.duplicates_removed,
                "invalid_removed": batch.invalid_removed,
                "records_cleaned": batch.records_cleaned,
            },
        },
        "transactions": [
            {
                "id": str(tx.id),
                "sender": tx.sender,
                "receiver": tx.receiver,
                "amount": float(tx.amount),
                "currency": tx.currency,
                "timestamp": tx.timestamp.isoformat() if tx.timestamp else None,
                "reference_number": tx.reference_number,
                "bank": tx.bank,
                "mode": tx.mode,
                "description": tx.description,
            }
            for tx in transactions
        ],
    }


@router.post("/reset")
async def reset_database(
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Clear all transactions, upload batches, and alerts from the database.
    This effectively resets the application state.
    """
    from sqlalchemy import delete
    from app.models.alert import Alert
    
    await db.execute(delete(Transaction))
    await db.execute(delete(Alert))
    await db.execute(delete(UploadBatch))
    await db.flush()
    
    return {"message": "Database reset successfully."}

