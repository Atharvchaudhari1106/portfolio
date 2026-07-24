"""
FinTrace — AI Explainability Service

Provides human-readable explanations for why specific
transactions or accounts were flagged. Does not require LLM —
uses rule-based explanations with confidence scoring.
"""

from typing import Any, Dict, List, Optional


# ── Explanation Templates ─────────────────────────────

EXPLANATIONS = {
    "circular": {
        "title": "Circular Routing Detected",
        "description": (
            "Money flows in a cycle: {chain}. "
            "Total amount in cycle: ₹{amount:,.2f}. "
            "Circular routing is a common technique in money laundering and wash trading, "
            "where funds are moved through intermediaries and returned to the origin."
        ),
        "confidence": 0.85,
    },
    "mule": {
        "title": "Mule Account Behavior",
        "description": (
            "Account '{account}' received {deposit_count} deposits totaling ₹{deposit_total:,.2f}, "
            "then consolidated and transferred ₹{withdrawal_total:,.2f} via {withdrawal_count} transaction(s). "
            "Average holding time: {holding_time}. "
            "This pattern is characteristic of money mule activity — accounts used to move illicit funds."
        ),
        "confidence": 0.78,
    },
    "layering": {
        "title": "Layering Pattern Detected",
        "description": (
            "Funds from '{source}' were split across {layer_count} layers of intermediaries "
            "before converging at '{destination}'. Total amount: ₹{amount:,.2f}. "
            "Layering obscures the audit trail by routing money through complex networks."
        ),
        "confidence": 0.80,
    },
    "structuring": {
        "title": "Structuring (Smurfing) Detected",
        "description": (
            "{count} transactions from '{sender}' to '{receiver}' totaling ₹{total:,.2f}, "
            "each individually below the ₹{threshold:,.0f} reporting threshold. "
            "Structuring is used to evade regulatory reporting requirements."
        ),
        "confidence": 0.90,
    },
    "velocity": {
        "title": "High Velocity Transfer Chain",
        "description": (
            "Funds moved through {hop_count} accounts ({chain}) "
            "in just {minutes:.1f} minutes. Total: ₹{amount:,.2f}. "
            "Rapid sequential transfers suggest automated or coordinated fund movement."
        ),
        "confidence": 0.75,
    },
    "dormant": {
        "title": "Dormant Account Reactivation",
        "description": (
            "Account '{account}' was inactive for {dormancy_days} days "
            "(last active: {last_active}), then suddenly transacted ₹{amount:,.2f} on {reactivation_date}. "
            "Dormant account reactivation with large transactions may indicate account compromise."
        ),
        "confidence": 0.70,
    },
    "blacklist": {
        "title": "Blacklisted Account Match",
        "description": (
            "Account '{account}' matches a known blacklisted entity. "
            "Found in {count} transaction(s) totaling ₹{amount:,.2f} as {role}. "
            "Immediate review and potential freeze recommended."
        ),
        "confidence": 0.95,
    },
}


class AIExplainer:
    """
    Provides rule-based explainability for flagged transactions and accounts.

    For each alert type, generates:
    - Why it was flagged
    - Confidence score
    - Supporting evidence
    - Detection rule that triggered it
    """

    @staticmethod
    def explain_alert(
        alert_type: str,
        alert_data: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Generate an explanation for a single alert.

        Args:
            alert_type: Type of alert (circular/mule/layering/etc.).
            alert_data: Alert details dict.

        Returns:
            Explanation dict with title, description, confidence, evidence.
        """
        template = EXPLANATIONS.get(alert_type)
        if not template:
            return {
                "title": f"Unknown Alert Type: {alert_type}",
                "description": "No explanation template available.",
                "confidence": 0.0,
                "evidence": alert_data,
                "rule": alert_type,
            }

        # Format the description with alert data
        try:
            description = template["description"].format(
                **AIExplainer._prepare_format_args(alert_type, alert_data)
            )
        except (KeyError, ValueError):
            description = template["description"]

        return {
            "title": template["title"],
            "description": description,
            "confidence": template["confidence"],
            "evidence": AIExplainer._extract_evidence(alert_type, alert_data),
            "rule": alert_type,
            "risk_score": alert_data.get("risk_score", 0),
        }

    @staticmethod
    def explain_account_risk(
        account_id: str,
        risk_data: Dict[str, Any],
        alerts: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """
        Generate a comprehensive risk explanation for an account.

        Args:
            account_id: Account identifier.
            risk_data: Risk score and breakdown.
            alerts: All alerts for this account.

        Returns:
            Comprehensive explanation dict.
        """
        explanations = []
        for alert in alerts:
            alert_type = alert.get("alert_type", "unknown")
            explanations.append(AIExplainer.explain_alert(alert_type, alert))

        # Overall risk summary
        score = risk_data.get("score", 0)
        level = risk_data.get("level", "unknown")
        flags = risk_data.get("flags", [])

        summary = (
            f"Account '{account_id}' has a risk score of {score}/100 ({level.upper()}). "
            f"It has been flagged for: {', '.join(flags)}. "
        )

        if score >= 61:
            summary += "Immediate investigation and potential account freeze recommended."
        elif score >= 31:
            summary += "Enhanced monitoring and KYC verification recommended."
        else:
            summary += "Continue standard monitoring."

        return {
            "account_id": account_id,
            "summary": summary,
            "risk_score": score,
            "risk_level": level,
            "flags": flags,
            "explanations": explanations,
            "recommended_actions": AIExplainer._get_recommendations(level, flags),
        }

    @staticmethod
    def _prepare_format_args(
        alert_type: str,
        alert_data: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Prepare template formatting arguments from alert data."""
        args = {}

        if alert_type == "circular":
            cycle = alert_data.get("cycle", [])
            args["chain"] = " → ".join(cycle) + " → " + cycle[0] if cycle else "Unknown"
            args["amount"] = alert_data.get("total_amount", 0)

        elif alert_type == "mule":
            args["account"] = alert_data.get("account_id", "Unknown")
            args["deposit_count"] = alert_data.get("deposit_count", 0)
            args["deposit_total"] = alert_data.get("deposit_total", 0)
            args["withdrawal_count"] = alert_data.get("withdrawal_count", 0)
            args["withdrawal_total"] = alert_data.get("withdrawal_total", 0)
            holding = alert_data.get("avg_holding_minutes", -1)
            args["holding_time"] = f"{holding:.0f} minutes" if holding >= 0 else "Unknown"

        elif alert_type == "layering":
            args["source"] = alert_data.get("source", "Unknown")
            args["destination"] = alert_data.get("final_destination", "Unknown")
            args["layer_count"] = len(alert_data.get("layers", []))
            args["amount"] = alert_data.get("total_amount", 0)

        elif alert_type == "structuring":
            args["sender"] = alert_data.get("sender", "Unknown")
            args["receiver"] = alert_data.get("receiver", "Unknown")
            args["count"] = alert_data.get("count", 0)
            args["total"] = alert_data.get("total_amount", 0)
            args["threshold"] = alert_data.get("threshold", 50000)

        elif alert_type == "velocity":
            chain = alert_data.get("chain", [])
            args["chain"] = " → ".join(chain)
            args["hop_count"] = alert_data.get("hop_count", 0)
            args["minutes"] = alert_data.get("total_minutes", 0)
            args["amount"] = alert_data.get("total_amount", 0)

        elif alert_type == "dormant":
            args["account"] = alert_data.get("account_id", "Unknown")
            args["dormancy_days"] = alert_data.get("dormancy_days", 0)
            args["last_active"] = alert_data.get("last_active", "Unknown")
            args["amount"] = alert_data.get("reactivation_amount", 0)
            args["reactivation_date"] = alert_data.get("reactivation_date", "Unknown")

        elif alert_type == "blacklist":
            args["account"] = alert_data.get("account_id", "Unknown")
            args["count"] = alert_data.get("transaction_count", 0)
            args["amount"] = alert_data.get("total_amount", 0)
            args["role"] = alert_data.get("matched_field", "participant")

        return args

    @staticmethod
    def _extract_evidence(
        alert_type: str,
        alert_data: Dict[str, Any],
    ) -> List[str]:
        """Extract human-readable evidence points from alert data."""
        evidence = []

        if alert_type == "circular":
            cycle = alert_data.get("cycle", [])
            evidence.append(f"Cycle path: {' → '.join(cycle)}")
            evidence.append(f"Total cycled amount: ₹{alert_data.get('total_amount', 0):,.2f}")

        elif alert_type == "mule":
            evidence.append(f"Received {alert_data.get('deposit_count', 0)} deposits")
            evidence.append(f"Made {alert_data.get('withdrawal_count', 0)} withdrawal(s)")
            evidence.append(f"Deposit total: ₹{alert_data.get('deposit_total', 0):,.2f}")
            evidence.append(f"Withdrawal total: ₹{alert_data.get('withdrawal_total', 0):,.2f}")

        elif alert_type == "structuring":
            evidence.append(f"{alert_data.get('count', 0)} sub-threshold transactions")
            evidence.append(f"Aggregated total: ₹{alert_data.get('total_amount', 0):,.2f}")
            evidence.append(f"Reporting threshold: ₹{alert_data.get('threshold', 50000):,.0f}")

        return evidence

    @staticmethod
    def _get_recommendations(
        risk_level: str,
        flags: List[str],
    ) -> List[str]:
        """Generate recommended actions based on risk level and flags."""
        actions = []

        if risk_level == "high":
            actions.append("🔴 Immediately freeze account pending investigation")
            actions.append("🔴 File Suspicious Transaction Report (STR) with FIU-IND")
            actions.append("🔴 Escalate to senior AML compliance officer")

        if risk_level == "medium":
            actions.append("🟡 Place account under enhanced monitoring")
            actions.append("🟡 Request updated KYC documentation")

        if "blacklist" in flags:
            actions.append("⚫ Cross-reference with law enforcement databases")
            actions.append("⚫ Notify the Financial Intelligence Unit")

        if "circular" in flags:
            actions.append("🔄 Investigate all accounts in the circular chain")

        if "mule" in flags:
            actions.append("👤 Verify account holder identity (video KYC)")

        if risk_level == "low":
            actions.append("🟢 Continue standard transaction monitoring")

        return actions
