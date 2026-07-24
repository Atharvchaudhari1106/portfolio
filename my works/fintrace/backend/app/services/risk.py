"""
FinTrace — Risk Score Engine

Aggregates AML detection results into per-account risk scores.

Scoring Table:
| Rule                    | Points |
|-------------------------|--------|
| Circular Routing        | 35     |
| Mule Account            | 25     |
| Layering                | 20     |
| Structuring             | 15     |
| Blacklist Match         | 50     |
| High Velocity           | 20     |
| Dormant Reactivation    | 15     |

Risk Levels:
  0-30:   LOW    (green)
  31-60:  MEDIUM (yellow)
  61-100: HIGH   (red), capped at 100
"""

from typing import Any, Dict, List
from collections import defaultdict


# ── Score Weights ─────────────────────────────────────

SCORE_WEIGHTS = {
    "circular": 35,
    "mule": 25,
    "layering": 20,
    "structuring": 15,
    "blacklist": 50,
    "velocity": 20,
    "dormant": 15,
}


def get_risk_level(score: int) -> str:
    """Map a numeric risk score to a risk level label."""
    if score <= 30:
        return "low"
    elif score <= 60:
        return "medium"
    else:
        return "high"


def get_risk_color(score: int) -> str:
    """Map a numeric risk score to a color for visualization."""
    if score <= 30:
        return "#22c55e"  # green
    elif score <= 60:
        return "#eab308"  # yellow
    else:
        return "#ef4444"  # red


class RiskScoreEngine:
    """
    Computes per-account risk scores from AML detection results.

    Each detection type adds its weight to every account involved.
    Scores are capped at 100.
    """

    @staticmethod
    def compute_risk_scores(
        detection_results: Dict[str, List[Dict[str, Any]]],
    ) -> Dict[str, Dict[str, Any]]:
        """
        Compute risk scores for all accounts based on detection results.

        Args:
            detection_results: Output from AMLEngine.run_all_detections().

        Returns:
            Dict mapping account_id to risk info:
            {
                "account_id": {
                    "score": int,
                    "level": str,
                    "color": str,
                    "flags": ["circular", "mule"],
                    "breakdown": {"circular": 35, "mule": 25},
                }
            }
        """
        account_scores = defaultdict(lambda: {
            "score": 0,
            "flags": set(),
            "breakdown": defaultdict(int),
        })

        # Process each detection type
        for detection_type, alerts in detection_results.items():
            weight = SCORE_WEIGHTS.get(detection_type, 10)

            for alert in alerts:
                # Extract involved accounts based on alert type
                accounts = RiskScoreEngine._extract_accounts(alert, detection_type)

                for account_id in accounts:
                    acc = account_scores[account_id]
                    acc["flags"].add(detection_type)
                    acc["breakdown"][detection_type] += weight
                    acc["score"] += weight

        # Build final output with capped scores
        result = {}
        for account_id, info in account_scores.items():
            capped_score = min(info["score"], 100)
            result[account_id] = {
                "account_id": account_id,
                "score": capped_score,
                "level": get_risk_level(capped_score),
                "color": get_risk_color(capped_score),
                "flags": sorted(list(info["flags"])),
                "breakdown": dict(info["breakdown"]),
            }

        return result

    @staticmethod
    def _extract_accounts(
        alert: Dict[str, Any],
        detection_type: str,
    ) -> List[str]:
        """Extract all account IDs involved in an alert."""
        accounts = []

        if detection_type == "circular":
            accounts = alert.get("cycle", [])

        elif detection_type == "mule":
            account_id = alert.get("account_id")
            if account_id:
                accounts = [account_id]

        elif detection_type == "layering":
            source = alert.get("source")
            if source:
                accounts.append(source)
            for layer in alert.get("layers", []):
                accounts.extend(layer)
            dest = alert.get("final_destination")
            if dest:
                accounts.append(dest)

        elif detection_type == "structuring":
            sender = alert.get("sender")
            receiver = alert.get("receiver")
            if sender:
                accounts.append(sender)
            if receiver:
                accounts.append(receiver)

        elif detection_type == "velocity":
            accounts = alert.get("chain", [])

        elif detection_type == "dormant":
            account_id = alert.get("account_id")
            if account_id:
                accounts = [account_id]

        elif detection_type == "blacklist":
            account_id = alert.get("account_id")
            if account_id:
                accounts = [account_id]

        return accounts

    @staticmethod
    def get_top_risk_accounts(
        risk_scores: Dict[str, Dict[str, Any]],
        limit: int = 20,
    ) -> List[Dict[str, Any]]:
        """Return the top N accounts by risk score, descending."""
        sorted_accounts = sorted(
            risk_scores.values(),
            key=lambda x: x["score"],
            reverse=True,
        )
        return sorted_accounts[:limit]

    @staticmethod
    def get_risk_distribution(
        risk_scores: Dict[str, Dict[str, Any]],
    ) -> Dict[str, int]:
        """Return count of accounts in each risk level."""
        distribution = {"low": 0, "medium": 0, "high": 0}
        for info in risk_scores.values():
            distribution[info["level"]] += 1
        return distribution
