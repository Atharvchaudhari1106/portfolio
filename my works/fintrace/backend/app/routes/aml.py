"""
FinTrace — AML Detection Routes

Endpoints for running detection algorithms, viewing alerts,
risk scores, and managing blacklists.
"""

import io
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import pandas as pd

from app.core.security import TokenData, UserRole, get_current_user, require_role
from app.database.postgres import get_db
from app.models.alert import Alert
from app.models.blacklist import BlacklistedAccount
from app.services.graph import GraphBuilder
from app.services.aml_engine import AMLEngine
from app.services.risk import RiskScoreEngine


router = APIRouter()


# ── Schemas ───────────────────────────────────────────

class RunDetectionRequest(BaseModel):
    include_blacklist: bool = True


class RunDetectionResponse(BaseModel):
    total_alerts: int
    circular: int
    mule: int
    layering: int
    structuring: int
    velocity: int
    dormant: int
    blacklist: int
    message: str


# ── Run Full Detection ────────────────────────────────

@router.post("/detect", response_model=RunDetectionResponse)
async def run_detection(
    request: RunDetectionRequest = RunDetectionRequest(),
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Run all 7 AML detection algorithms on the current transaction graph.

    This:
    1. Exports all transactions from Neo4j
    2. Runs all detection algorithms
    3. Computes risk scores
    4. Stores alerts in PostgreSQL
    5. Updates account risk scores in Neo4j
    """
    # Load transactions from Neo4j
    transactions = await GraphBuilder.get_all_transactions_for_networkx()

    if not transactions:
        raise HTTPException(
            status_code=400,
            detail="No transactions in the graph. Upload and parse data first.",
        )

    # Load blacklist if requested
    blacklist = []
    if request.include_blacklist:
        bl_result = await db.execute(select(BlacklistedAccount))
        bl_records = bl_result.scalars().all()
        blacklist = [b.account_id for b in bl_records]

    # Initialize AML engine
    engine = AMLEngine()
    engine.load_transactions(transactions)

    # Run all detections
    results = engine.run_all_detections(blacklist=blacklist)

    # Compute risk scores
    risk_scores = RiskScoreEngine.compute_risk_scores(results)

    # Store alerts in PostgreSQL
    from sqlalchemy import delete
    await db.execute(delete(Alert))
    
    total_alerts = 0
    for detection_type, alerts in results.items():
        for alert_data in alerts:
            # Extract accounts involved
            accounts = []
            if "cycle" in alert_data:
                accounts = alert_data["cycle"]
            elif "account_id" in alert_data:
                accounts = [alert_data["account_id"]]
            elif "chain" in alert_data:
                accounts = alert_data["chain"]
            elif "sender" in alert_data:
                accounts = [alert_data.get("sender", ""), alert_data.get("receiver", "")]

            alert = Alert(
                alert_type=detection_type,
                severity=_get_severity(alert_data.get("risk_score", 0)),
                risk_score=alert_data.get("risk_score", 0),
                title=_get_alert_title(detection_type, alert_data),
                description=_get_alert_description(detection_type, alert_data),
                accounts_involved=[a for a in accounts if a],
                evidence=alert_data,
            )
            db.add(alert)
            total_alerts += 1

    await db.flush()

    # Update Neo4j risk scores
    for account_id, risk_info in risk_scores.items():
        await GraphBuilder.update_account_risk(account_id, risk_info["score"])

    return RunDetectionResponse(
        total_alerts=total_alerts,
        circular=len(results.get("circular", [])),
        mule=len(results.get("mule", [])),
        layering=len(results.get("layering", [])),
        structuring=len(results.get("structuring", [])),
        velocity=len(results.get("velocity", [])),
        dormant=len(results.get("dormant", [])),
        blacklist=len(results.get("blacklist", [])),
        message=f"Detection complete. {total_alerts} alerts generated across {len(risk_scores)} accounts.",
    )


# ── Alert Endpoints ───────────────────────────────────

@router.get("/alerts")
async def list_alerts(
    alert_type: Optional[str] = None,
    severity: Optional[str] = None,
    status: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all AML alerts with optional filtering."""
    query = select(Alert)

    if alert_type:
        query = query.where(Alert.alert_type == alert_type)
    if severity:
        query = query.where(Alert.severity == severity)
    if status:
        query = query.where(Alert.status == status)

    query = query.order_by(Alert.created_at.desc())
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)

    result = await db.execute(query)
    alerts = result.scalars().all()

    return [
        {
            "id": str(a.id),
            "alert_type": a.alert_type,
            "severity": a.severity,
            "risk_score": a.risk_score,
            "title": a.title,
            "description": a.description,
            "accounts_involved": a.accounts_involved,
            "status": a.status,
            "created_at": a.created_at.isoformat(),
        }
        for a in alerts
    ]


@router.get("/cycles")
async def get_cycles(
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all detected circular routing patterns."""
    return await _get_alerts_by_type(db, "circular")


@router.get("/mules")
async def get_mules(
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all detected mule accounts."""
    return await _get_alerts_by_type(db, "mule")


@router.get("/layering")
async def get_layering(
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all detected layering chains."""
    return await _get_alerts_by_type(db, "layering")


@router.get("/structuring")
async def get_structuring(
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all detected structuring/smurfing patterns."""
    return await _get_alerts_by_type(db, "structuring")


@router.get("/velocity")
async def get_velocity(
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all detected high-velocity transfer chains."""
    return await _get_alerts_by_type(db, "velocity")


@router.get("/dormant")
async def get_dormant(
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all detected dormant account reactivations."""
    return await _get_alerts_by_type(db, "dormant")


@router.get("/blacklist-matches")
async def get_blacklist_matches(
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all detected blacklist matches."""
    return await _get_alerts_by_type(db, "blacklist")


# ── Risk Score Endpoints ──────────────────────────────

@router.get("/risk")
async def get_all_risk_scores(
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get risk scores for all accounts."""
    # Get all alerts and compute risk
    result = await db.execute(select(Alert))
    alerts = result.scalars().all()

    # Group alerts by detection type
    detection_results = {}
    for alert in alerts:
        if alert.alert_type not in detection_results:
            detection_results[alert.alert_type] = []
        detection_results[alert.alert_type].append(alert.evidence or {})

    risk_scores = RiskScoreEngine.compute_risk_scores(detection_results)
    top_accounts = RiskScoreEngine.get_top_risk_accounts(risk_scores)
    distribution = RiskScoreEngine.get_risk_distribution(risk_scores)

    return {
        "accounts": top_accounts,
        "distribution": distribution,
        "total_accounts": len(risk_scores),
    }


@router.get("/risk/{account_id}")
async def get_account_risk(
    account_id: str,
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get detailed risk breakdown for a single account."""
    from app.core.config import settings
    if settings.use_sqlite:
        result = await db.execute(
            select(Alert).where(Alert.accounts_involved.like(f'%"{account_id}"%'))
        )
    else:
        result = await db.execute(
            select(Alert).where(Alert.accounts_involved.any(account_id))
        )
    alerts = result.scalars().all()

    # Compute risk for this account
    detection_results = {}
    for alert in alerts:
        if alert.alert_type not in detection_results:
            detection_results[alert.alert_type] = []
        detection_results[alert.alert_type].append(alert.evidence or {})

    risk_scores = RiskScoreEngine.compute_risk_scores(detection_results)
    account_risk = risk_scores.get(account_id, {
        "account_id": account_id,
        "score": 0,
        "level": "low",
        "color": "#22c55e",
        "flags": [],
        "breakdown": {},
    })

    return {
        "risk": account_risk,
        "alerts": [
            {
                "id": str(a.id),
                "alert_type": a.alert_type,
                "severity": a.severity,
                "title": a.title,
                "description": a.description,
            }
            for a in alerts
        ],
    }


# ── Blacklist Management ─────────────────────────────

@router.post("/blacklist/upload")
async def upload_blacklist(
    file: UploadFile = File(...),
    current_user: TokenData = Depends(require_role([UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload a blacklist CSV file (admin only).
    Expected columns: account_id, name (optional), reason (optional), source (optional)
    """
    content = await file.read()
    text = content.decode("utf-8", errors="replace")

    df = pd.read_csv(io.StringIO(text), dtype=str)

    if "account_id" not in df.columns:
        raise HTTPException(
            status_code=400,
            detail="CSV must have an 'account_id' column",
        )

    count = 0
    for _, row in df.iterrows():
        account_id = str(row["account_id"]).strip()
        if not account_id:
            continue

        # Check if already exists
        existing = await db.execute(
            select(BlacklistedAccount).where(
                BlacklistedAccount.account_id == account_id
            )
        )
        if existing.scalar_one_or_none():
            continue

        entry = BlacklistedAccount(
            account_id=account_id,
            name=str(row.get("name", "")) or None,
            reason=str(row.get("reason", "")) or None,
            source=str(row.get("source", "")) or None,
        )
        db.add(entry)
        count += 1

    await db.flush()

    return {
        "message": f"Blacklist updated: {count} new entries added",
        "new_entries": count,
    }


@router.get("/blacklist")
async def list_blacklist(
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all blacklisted accounts."""
    result = await db.execute(
        select(BlacklistedAccount).order_by(BlacklistedAccount.added_at.desc())
    )
    entries = result.scalars().all()

    return [
        {
            "id": str(e.id),
            "account_id": e.account_id,
            "name": e.name,
            "reason": e.reason,
            "source": e.source,
            "added_at": e.added_at.isoformat(),
        }
        for e in entries
    ]


# ── Helpers ───────────────────────────────────────────

async def _get_alerts_by_type(db: AsyncSession, alert_type: str) -> list:
    """Helper to fetch alerts by type."""
    result = await db.execute(
        select(Alert)
        .where(Alert.alert_type == alert_type)
        .order_by(Alert.created_at.desc())
    )
    alerts = result.scalars().all()
    return [
        {
            "id": str(a.id),
            "alert_type": a.alert_type,
            "severity": a.severity,
            "risk_score": a.risk_score,
            "title": a.title,
            "description": a.description,
            "accounts_involved": a.accounts_involved,
            "evidence": a.evidence,
            "status": a.status,
            "created_at": a.created_at.isoformat(),
        }
        for a in alerts
    ]


def _get_severity(risk_score: int) -> str:
    if risk_score >= 35:
        return "high"
    elif risk_score >= 20:
        return "medium"
    return "low"


def _get_alert_title(detection_type: str, data: dict) -> str:
    titles = {
        "circular": "Circular Routing: " + " → ".join(data.get("cycle", [])[:4]),
        "mule": f"Mule Account: {data.get('account_id', 'Unknown')}",
        "layering": f"Layering from {data.get('source', 'Unknown')}",
        "structuring": f"Structuring: {data.get('sender', '?')} → {data.get('receiver', '?')}",
        "velocity": f"High Velocity: {data.get('hop_count', 0)} hops in {data.get('total_minutes', 0):.0f}min",
        "dormant": f"Dormant Reactivation: {data.get('account_id', 'Unknown')}",
        "blacklist": f"Blacklist Match: {data.get('account_id', 'Unknown')}",
    }
    return titles.get(detection_type, f"Alert: {detection_type}")


def _get_alert_description(detection_type: str, data: dict) -> str:
    descs = {
        "circular": f"Money cycle detected: {' → '.join(data.get('cycle', []))}. Total: ₹{data.get('total_amount', 0):,.2f}",
        "mule": f"Account received {data.get('deposit_count', 0)} deposits (₹{data.get('deposit_total', 0):,.2f}) and made {data.get('withdrawal_count', 0)} withdrawal(s)",
        "layering": f"Fan-out pattern from {data.get('source', '?')} through {len(data.get('layers', []))} layers to {data.get('final_destination', '?')}",
        "structuring": f"{data.get('count', 0)} sub-threshold transactions totaling ₹{data.get('total_amount', 0):,.2f}",
        "velocity": f"Chain of {data.get('hop_count', 0)} transfers completed in {data.get('total_minutes', 0):.1f} minutes",
        "dormant": f"Account inactive for {data.get('dormancy_days', 0)} days, then transacted ₹{data.get('reactivation_amount', 0):,.2f}",
        "blacklist": f"Matched blacklisted entity in {data.get('transaction_count', 0)} transactions (₹{data.get('total_amount', 0):,.2f})",
    }
    return descs.get(detection_type, f"Detection: {detection_type}")
