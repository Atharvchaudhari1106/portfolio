"""
FinTrace — Dashboard & Analytics Routes

Dashboard summary statistics and analytics data for charts.
"""

from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import TokenData, get_current_user
from app.database.postgres import get_db
from app.models.transaction import Transaction
from app.models.alert import Alert
from app.models.upload import UploadBatch
from app.services.graph import GraphBuilder


router = APIRouter()


@router.get("/dashboard")
async def get_dashboard(
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Dashboard summary statistics.

    Returns card data:
    - Total Transactions
    - Total Amount
    - Flagged Accounts
    - Alert counts by type
    - Risk distribution
    """
    # Transaction stats
    tx_count_result = await db.execute(select(func.count(Transaction.id)))
    total_transactions = tx_count_result.scalar() or 0

    tx_sum_result = await db.execute(select(func.sum(Transaction.amount)))
    total_amount = float(tx_sum_result.scalar() or 0)

    # Alert stats
    alert_count_result = await db.execute(select(func.count(Alert.id)))
    total_alerts = alert_count_result.scalar() or 0

    # Alert breakdown by type
    alert_type_query = select(
        Alert.alert_type,
        func.count(Alert.id).label("count"),
    ).group_by(Alert.alert_type)
    alert_type_result = await db.execute(alert_type_query)
    alert_breakdown = {row.alert_type: row.count for row in alert_type_result}

    # Alert breakdown by severity
    severity_query = select(
        Alert.severity,
        func.count(Alert.id).label("count"),
    ).group_by(Alert.severity)
    severity_result = await db.execute(severity_query)
    severity_breakdown = {row.severity: row.count for row in severity_result}

    # Unique flagged accounts
    from app.core.config import settings
    if settings.use_sqlite:
        try:
            alert_res = await db.execute(select(Alert.accounts_involved))
            all_involved = alert_res.scalars().all()
            unique_involved = set()
            for accs in all_involved:
                unique_involved.update(accs)
            flagged_accounts = len(unique_involved)
        except Exception:
            flagged_accounts = total_alerts
    else:
        flagged_query = select(func.count(func.distinct(
            func.unnest(Alert.accounts_involved)
        )))
        try:
            flagged_result = await db.execute(flagged_query)
            flagged_accounts = flagged_result.scalar() or 0
        except Exception:
            flagged_accounts = total_alerts  # Fallback

    # Graph stats
    graph_stats = await GraphBuilder.get_graph_stats()

    # Upload stats
    upload_count_result = await db.execute(
        select(func.count(UploadBatch.id)).where(UploadBatch.status == "completed")
    )
    total_uploads = upload_count_result.scalar() or 0

    return {
        "cards": {
            "total_transactions": total_transactions,
            "total_amount": round(total_amount, 2),
            "total_amount_formatted": f"₹{total_amount:,.2f}",
            "flagged_accounts": flagged_accounts,
            "total_alerts": total_alerts,
            "total_uploads": total_uploads,
            "graph_nodes": graph_stats.get("total_accounts", 0),
            "graph_edges": graph_stats.get("total_transfers", 0),
        },
        "alert_breakdown": alert_breakdown,
        "severity_breakdown": severity_breakdown,
    }


@router.get("/analytics")
async def get_analytics(
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Analytics data for charts and visualizations.

    Returns:
    - Transaction volume over time
    - Amount distribution
    - Alert trends
    - Top senders/receivers by volume
    """
    # Transaction volume by day
    from app.core.config import settings
    if settings.use_sqlite:
        volume_query = select(
            func.strftime("%Y-%m-%d", Transaction.timestamp).label("date"),
            func.count(Transaction.id).label("count"),
            func.sum(Transaction.amount).label("total_amount"),
        ).group_by("date").order_by("date")
    else:
        volume_query = select(
            func.date_trunc("day", Transaction.timestamp).label("date"),
            func.count(Transaction.id).label("count"),
            func.sum(Transaction.amount).label("total_amount"),
        ).group_by("date").order_by("date")

    volume_result = await db.execute(volume_query)
    volume_data = [
        {
            "date": row.date.isoformat() if hasattr(row.date, "isoformat") else str(row.date or ""),
            "count": row.count,
            "total_amount": float(row.total_amount or 0),
        }
        for row in volume_result
    ]

    # Transaction mode distribution
    mode_query = select(
        Transaction.mode,
        func.count(Transaction.id).label("count"),
        func.sum(Transaction.amount).label("total"),
    ).group_by(Transaction.mode)

    mode_result = await db.execute(mode_query)
    mode_data = [
        {
            "mode": row.mode or "Unknown",
            "count": row.count,
            "total": float(row.total or 0),
        }
        for row in mode_result
    ]

    # Top senders by total amount
    top_senders_query = select(
        Transaction.sender,
        func.count(Transaction.id).label("tx_count"),
        func.sum(Transaction.amount).label("total_amount"),
    ).group_by(Transaction.sender).order_by(func.sum(Transaction.amount).desc()).limit(10)

    top_senders_result = await db.execute(top_senders_query)
    top_senders = [
        {
            "account": row.sender,
            "tx_count": row.tx_count,
            "total_amount": float(row.total_amount or 0),
        }
        for row in top_senders_result
    ]

    # Top receivers
    top_receivers_query = select(
        Transaction.receiver,
        func.count(Transaction.id).label("tx_count"),
        func.sum(Transaction.amount).label("total_amount"),
    ).group_by(Transaction.receiver).order_by(func.sum(Transaction.amount).desc()).limit(10)

    top_receivers_result = await db.execute(top_receivers_query)
    top_receivers = [
        {
            "account": row.receiver,
            "tx_count": row.tx_count,
            "total_amount": float(row.total_amount or 0),
        }
        for row in top_receivers_result
    ]

    # Alert trend by day
    if settings.use_sqlite:
        alert_trend_query = select(
            func.strftime("%Y-%m-%d", Alert.created_at).label("date"),
            Alert.alert_type,
            func.count(Alert.id).label("count"),
        ).group_by("date", Alert.alert_type).order_by("date")
    else:
        alert_trend_query = select(
            func.date_trunc("day", Alert.created_at).label("date"),
            Alert.alert_type,
            func.count(Alert.id).label("count"),
        ).group_by("date", Alert.alert_type).order_by("date")

    alert_trend_result = await db.execute(alert_trend_query)
    alert_trend = [
        {
            "date": row.date.isoformat() if hasattr(row.date, "isoformat") else str(row.date or ""),
            "type": row.alert_type,
            "count": row.count,
        }
        for row in alert_trend_result
    ]

    return {
        "volume_over_time": volume_data,
        "mode_distribution": mode_data,
        "top_senders": top_senders,
        "top_receivers": top_receivers,
        "alert_trend": alert_trend,
    }
