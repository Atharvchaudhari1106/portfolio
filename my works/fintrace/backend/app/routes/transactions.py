"""
FinTrace — Transaction & Graph Routes

Transaction listing, graph data, and account subgraph endpoints.
"""

from typing import Optional

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import TokenData, get_current_user
from app.database.postgres import get_db
from app.models.transaction import Transaction
from app.services.graph import GraphBuilder


router = APIRouter()


@router.get("/transactions")
async def list_transactions(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    sender: Optional[str] = None,
    receiver: Optional[str] = None,
    min_amount: Optional[float] = None,
    max_amount: Optional[float] = None,
    mode: Optional[str] = None,
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    List all transactions with pagination and filtering.

    Filters: sender, receiver, min_amount, max_amount, mode.
    """
    query = select(Transaction)

    # Apply filters
    if sender:
        query = query.where(Transaction.sender.ilike(f"%{sender}%"))
    if receiver:
        query = query.where(Transaction.receiver.ilike(f"%{receiver}%"))
    if min_amount is not None:
        query = query.where(Transaction.amount >= min_amount)
    if max_amount is not None:
        query = query.where(Transaction.amount <= max_amount)
    if mode:
        query = query.where(Transaction.mode == mode)

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Paginate
    offset = (page - 1) * page_size
    query = query.order_by(Transaction.timestamp.desc()).offset(offset).limit(page_size)

    result = await db.execute(query)
    transactions = result.scalars().all()

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
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
                "risk_score": tx.risk_score,
                "flags": tx.flags or [],
            }
            for tx in transactions
        ],
    }


@router.get("/transactions/{transaction_id}")
async def get_transaction(
    transaction_id: str,
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get details for a single transaction."""
    result = await db.execute(
        select(Transaction).where(Transaction.id == transaction_id)
    )
    tx = result.scalar_one_or_none()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    return {
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
        "risk_score": tx.risk_score,
        "flags": tx.flags or [],
        "upload_batch_id": str(tx.upload_batch_id),
    }


@router.get("/graph")
async def get_graph(
    limit: int = Query(500, ge=1, le=2000),
    skip: int = Query(0, ge=0),
    current_user: TokenData = Depends(get_current_user),
):
    """
    Get the full transaction graph for visualization.

    Returns nodes (accounts) and edges (transactions) suitable
    for rendering with React Flow.
    """
    graph_data = await GraphBuilder.get_full_graph(limit=limit, skip=skip)
    stats = await GraphBuilder.get_graph_stats()

    return {
        "nodes": graph_data["nodes"],
        "edges": graph_data["edges"],
        "stats": stats,
    }


@router.get("/graph/{account_id}")
async def get_account_subgraph(
    account_id: str,
    depth: int = Query(2, ge=1, le=5),
    current_user: TokenData = Depends(get_current_user),
):
    """
    Get a subgraph centered on a specific account.

    Args:
        account_id: The central account.
        depth: Number of hops to traverse (1-5).
    """
    subgraph = await GraphBuilder.get_account_subgraph(account_id, depth)
    account_stats = await GraphBuilder.get_account_stats(account_id)

    return {
        "account": account_stats,
        "nodes": subgraph["nodes"],
        "edges": subgraph["edges"],
    }
