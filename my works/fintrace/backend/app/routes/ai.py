"""
FinTrace — AI & SAR Routes

SAR generation, AI chat, explainability, and risk prediction endpoints.
"""

import json
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, ConfigDict

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import TokenData, get_current_user
from app.database.postgres import get_db
from app.models.alert import Alert
from app.models.transaction import Transaction
from app.services.sar_generator import SARGenerator
from app.services.ai_chat import AIChatInvestigator
from app.services.ai_explainer import AIExplainer
from app.services.risk import RiskScoreEngine
from app.services.pdf_exporter import PDFExporter


router = APIRouter()
sar_generator = SARGenerator()
chat_investigator = AIChatInvestigator()


# ── Schemas ───────────────────────────────────────────

class SARRequest(BaseModel):
    account_id: Optional[str] = None
    chain: Optional[List[str]] = None


class SARPdfExportRequest(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    account_id: Optional[str] = None
    chain: Optional[List[str]] = None
    report: Optional[str] = None
    risk_level: Optional[str] = None
    risk_score: Optional[float] = None
    flags: Optional[List[str]] = None
    model_used: Optional[str] = None


class ChatRequest(BaseModel):
    question: str
    context: Optional[str] = None
    conversation_history: Optional[List[dict]] = None


# ── SAR Generation ────────────────────────────────────

@router.post("/generate-sar")
async def generate_sar(
    request: SARRequest,
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Generate a Suspicious Activity Report using local Ollama LLM.

    Provide either an account_id (single account SAR) or a chain
    of account IDs (chain-level SAR).
    """
    if not request.account_id and not request.chain:
        raise HTTPException(
            status_code=400,
            detail="Provide either 'account_id' or 'chain'",
        )

    if request.account_id:
        # Single account SAR
        account_id = request.account_id

        # Get alerts for this account (accounts_involved is stored as JSON text)
        alert_result = await db.execute(
            select(Alert).where(Alert.accounts_involved.like(f'%"{account_id}"%'))
        )
        alerts = alert_result.scalars().all()

        alert_dicts = [
            {
                "alert_type": a.alert_type,
                "severity": a.severity,
                "risk_score": a.risk_score,
                "description": a.description,
                "accounts_involved": a.accounts_involved,
            }
            for a in alerts
        ]

        # Get transactions
        tx_result = await db.execute(
            select(Transaction).where(
                (Transaction.sender == account_id) | (Transaction.receiver == account_id)
            ).limit(50)
        )
        transactions = tx_result.scalars().all()
        tx_dicts = [
            {
                "sender": tx.sender,
                "receiver": tx.receiver,
                "amount": float(tx.amount),
                "timestamp": tx.timestamp.isoformat() if tx.timestamp else "",
                "mode": tx.mode or "",
            }
            for tx in transactions
        ]

        # Compute risk
        detection_results = {}
        for a in alerts:
            if a.alert_type not in detection_results:
                detection_results[a.alert_type] = []
            detection_results[a.alert_type].append(a.evidence or {})

        risk_scores = RiskScoreEngine.compute_risk_scores(detection_results)
        risk_data = risk_scores.get(account_id, {
            "score": 0, "level": "low", "flags": [], "breakdown": {},
        })

        # Generate SAR
        sar = await sar_generator.generate_sar(
            account_id=account_id,
            risk_data=risk_data,
            alerts=alert_dicts,
            transactions=tx_dicts,
        )
        return sar

    else:
        # Chain SAR
        chain = request.chain

        # Get alerts for any account in the chain
        alert_result = await db.execute(select(Alert))
        all_alerts = alert_result.scalars().all()
        chain_set = set(chain)
        alerts = [
            a for a in all_alerts
            if any(acc in chain_set for acc in (a.accounts_involved or []))
        ]
        alert_dicts = [
            {
                "alert_type": a.alert_type,
                "severity": a.severity,
                "risk_score": a.risk_score,
                "description": a.description,
            }
            for a in alerts
        ]

        # Get chain transactions
        tx_result = await db.execute(
            select(Transaction).where(
                Transaction.sender.in_(chain) | Transaction.receiver.in_(chain)
            ).limit(100)
        )
        transactions = tx_result.scalars().all()
        tx_dicts = [
            {
                "sender": tx.sender,
                "receiver": tx.receiver,
                "amount": float(tx.amount),
                "timestamp": tx.timestamp.isoformat() if tx.timestamp else "",
            }
            for tx in transactions
        ]

        sar = await sar_generator.generate_chain_sar(
            chain=chain,
            alerts=alert_dicts,
            transactions=tx_dicts,
        )
        return sar


@router.post("/export-sar-pdf")
async def export_sar_pdf(
    request: SARPdfExportRequest,
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Generate and download an official Suspicious Activity Report (SAR) in PDF format.
    """
    if request.report:
        sar_dict = request.model_dump()
    else:
        sar_req = SARRequest(account_id=request.account_id, chain=request.chain)
        sar_dict = await generate_sar(sar_req, current_user, db)

    pdf_bytes = PDFExporter.generate_sar_pdf(sar_dict)

    filename_target = sar_dict.get("account_id") or (
        "_".join(sar_dict.get("chain", [])) if sar_dict.get("chain") else "REPORT"
    )
    filename = f"SAR_{filename_target}_{datetime.now().strftime('%Y%m%d')}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


# ── AI Chat Investigator ─────────────────────────────


@router.post("/chat")
async def ai_chat(
    request: ChatRequest,
    current_user: TokenData = Depends(get_current_user),
):
    """
    Interactive AI chat for AML investigation.

    Ask questions like:
    - "Why is Account A suspicious?"
    - "What connections does Account B have?"
    - "Explain the risk for this chain"
    """
    response = await chat_investigator.chat(
        question=request.question,
        context=request.context,
        conversation_history=request.conversation_history,
    )
    return {
        "question": request.question,
        "answer": response,
        "model": chat_investigator.model,
    }


# ── Explainability ────────────────────────────────────

@router.get("/explain/account/{account_id}")
async def explain_account(
    account_id: str,
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get a detailed explanation of why an account is flagged.
    Returns rule-based explanations with confidence scores.
    """
    # Get alerts
    result = await db.execute(
        select(Alert).where(Alert.accounts_involved.like(f'%"{account_id}"%'))
    )
    alerts = result.scalars().all()


    if not alerts:
        return {
            "account_id": account_id,
            "summary": f"Account '{account_id}' has no active alerts.",
            "risk_score": 0,
            "risk_level": "low",
            "explanations": [],
        }

    # Compute risk
    detection_results = {}
    for a in alerts:
        if a.alert_type not in detection_results:
            detection_results[a.alert_type] = []
        detection_results[a.alert_type].append(a.evidence or {})

    risk_scores = RiskScoreEngine.compute_risk_scores(detection_results)
    risk_data = risk_scores.get(account_id, {
        "score": 0, "level": "low", "flags": [], "breakdown": {},
    })

    alert_dicts = [
        {
            "alert_type": a.alert_type,
            "description": a.description,
            **(a.evidence or {}),
        }
        for a in alerts
    ]

    return AIExplainer.explain_account_risk(account_id, risk_data, alert_dicts)


@router.get("/explain/alert/{alert_id}")
async def explain_alert(
    alert_id: str,
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a detailed explanation for a specific alert."""
    result = await db.execute(select(Alert).where(Alert.id == alert_id))
    alert = result.scalar_one_or_none()

    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    return AIExplainer.explain_alert(alert.alert_type, alert.evidence or {})
