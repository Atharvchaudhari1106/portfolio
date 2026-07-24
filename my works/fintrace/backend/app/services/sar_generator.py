"""
FinTrace — SAR Generator (Suspicious Activity Report)

Uses local Ollama LLM to generate official-style Suspicious Activity Reports
from detection results and transaction data.
"""

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

import httpx

from app.core.config import settings


# ── SAR System Prompt ─────────────────────────────────

SAR_SYSTEM_PROMPT = """You are an expert Anti-Money Laundering (AML) investigator and compliance officer.

Your task is to analyze suspicious financial transaction data and generate a formal Suspicious Activity Report (SAR).

The report MUST include the following sections:

1. **SUMMARY**: A concise overview of the suspicious activity detected.
2. **ACCOUNTS INVOLVED**: List all accounts with their roles (sender/receiver/intermediary).
3. **SUSPICIOUS PATTERNS DETECTED**: Describe each pattern found (circular routing, mule behavior, layering, structuring, high velocity, dormant reactivation, blacklist match).
4. **EVIDENCE**: Specific transaction details that support the findings.
5. **RISK ASSESSMENT**: Overall risk level (LOW/MEDIUM/HIGH) with justification.
6. **RECOMMENDED ACTIONS**: Specific steps to take (freeze account, KYC verification, escalation, etc.).
7. **LEGAL NOTES**: Relevant regulatory requirements and compliance obligations.

Format the report professionally. Use clear, precise language suitable for regulatory submission.
Include specific amounts, dates, and account identifiers from the data provided.
Do not speculate — base all conclusions on the evidence provided."""


class SARGenerator:
    """
    Generates Suspicious Activity Reports using local Ollama LLM.

    Flow:
    1. Collect all alerts and risk data for target account(s)
    2. Build structured context with transaction details
    3. Send to Ollama with compliance-focused system prompt
    4. Parse and return the SAR text
    """

    def __init__(self):
        self.base_url = settings.ollama_base_url
        self.model = settings.ollama_model

    async def is_ollama_available(self) -> bool:
        """Check if local Ollama server is running and responsive."""
        try:
            async with httpx.AsyncClient(timeout=1.5) as client:
                response = await client.get(self.base_url)
                return response.status_code == 200
        except Exception:
            return False

    def _generate_fallback_sar_text(
        self,
        account_id: str,
        risk_data: Dict[str, Any],
        alerts: List[Dict[str, Any]],
        transactions: List[Dict[str, Any]],
    ) -> str:
        """Generate a structured, professional SAR report in Python as a fallback."""
        report = []
        report.append("================================================================================")
        report.append("                  FINANCIAL INTELLIGENCE UNIT - SUSPICIOUS ACTIVITY REPORT       ")
        report.append("================================================================================")
        report.append(f"REPORT REFERENCE: SAR-{uuid.uuid4().hex[:8].upper()}")
        report.append(f"DATE OF REPORT:   {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report.append("CLASSIFICATION:   CONFIDENTIAL / LAW ENFORCEMENT ONLY")
        report.append("--------------------------------------------------------------------------------")
        report.append("\nSECTION I: SUBJECT OF REPORT")
        report.append(f"  Primary Account under investigation: {account_id}")
        report.append(f"  Assessed Risk Score:                 {risk_data.get('score', 0)}/100")
        report.append(f"  Assessed Risk Level:                 {risk_data.get('level', 'unknown').upper()}")
        report.append(f"  Triggered Indicators:                {', '.join(risk_data.get('flags', []))}")
        
        report.append("\nSECTION II: SUMMARY OF SUSPICIOUS ACTIVITY")
        report.append(f"  FinTrace AML detection algorithms flagged account '{account_id}' based on {len(alerts)} suspicious pattern(s).")
        
        report.append("\n  Detailed Indicator Breakdown:")
        for idx, alert in enumerate(alerts, 1):
            alert_type = alert.get("alert_type", "unknown")
            desc = alert.get("description", "No detailed description provided.")
            report.append(f"    Indicator #{idx} [{alert_type.upper()}]:")
            report.append(f"      - {desc}")
            
        report.append("\nSECTION III: FINANCIAL TRANSACTIONS UNDER REVIEW")
        report.append(f"  Total analyzed transactions involving subject account: {len(transactions)}")
        
        if transactions:
            total_sent = sum(tx.get("amount", 0) for tx in transactions if tx.get("sender") == account_id)
            total_received = sum(tx.get("amount", 0) for tx in transactions if tx.get("receiver") == account_id)
            report.append(f"    - Total Funds Sent:     ₹{total_sent:,.2f}")
            report.append(f"    - Total Funds Received: ₹{total_received:,.2f}")
            report.append("\n    Key Transaction Log (Sample):")
            for tx in transactions[:15]:
                flow = f"{tx.get('sender')} --> {tx.get('receiver')}"
                report.append(f"      * {tx.get('timestamp')}: {flow} | ₹{tx.get('amount', 0):,.2f} | Mode: {tx.get('mode', 'N/A')}")
        else:
            report.append("    No transactions found for the specified account in this batch.")
            
        report.append("\nSECTION IV: COMPLIANCE ASSESSMENT & RECOMMENDATIONS")
        score = risk_data.get("score", 0)
        if score >= 60:
            report.append("  [CRITICAL ALERT] Immediate regulatory escalation advised.")
            report.append("  1. Recommend immediate temporary administrative freeze on account funds.")
            report.append("  2. File an official Suspicious Transaction Report (STR) with FIU-IND / relevant authorities.")
            report.append("  3. Block outgoing transactions from this account to prevent capital flight.")
        elif score >= 30:
            report.append("  [WARNING] Enhanced due diligence (EDD) advised.")
            report.append("  1. Request updated Know Your Customer (KYC) documentation including source of funds.")
            report.append("  2. Monitor transactional activity for subsequent 30-day window.")
        else:
            report.append("  [INFO] Routine monitoring advised.")
            report.append("  1. Continue regular transaction auditing under standard surveillance rules.")
            
        report.append("\n================================================================================")
        report.append("  Generated by FinTrace AML Platform (Rule-Based Fallback Mode — LLM Offline)   ")
        report.append("================================================================================")
        return "\n".join(report)

    def _generate_fallback_chain_sar_text(
        self,
        chain: List[str],
        alerts: List[Dict[str, Any]],
        transactions: List[Dict[str, Any]],
    ) -> str:
        """Generate a structured multi-account chain SAR report in Python as a fallback."""
        report = []
        report.append("================================================================================")
        report.append("             FINANCIAL INTELLIGENCE UNIT - MULTI-ACCOUNT CHAIN SAR              ")
        report.append("================================================================================")
        report.append(f"REPORT REFERENCE: SAR-CHAIN-{uuid.uuid4().hex[:8].upper()}")
        report.append(f"DATE OF REPORT:   {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report.append("CLASSIFICATION:   CONFIDENTIAL / LAW ENFORCEMENT ONLY")
        report.append("--------------------------------------------------------------------------------")
        report.append("\nSECTION I: CHAIN OVERVIEW")
        report.append(f"  Suspicious Chain Flow:  {' --> '.join(chain)}")
        report.append(f"  Total Accounts Involved: {len(chain)}")
        
        report.append("\nSECTION II: DETECTED CORRELATIONS")
        report.append(f"  The following {len(alerts)} alerts were triggered across the accounts in this chain:")
        for idx, alert in enumerate(alerts, 1):
            report.append(f"    - Alert #{idx} [{alert.get('alert_type', 'unknown').upper()}]: Risk Score {alert.get('risk_score', 0)}")
            
        report.append("\nSECTION III: CHAIN TRANSACTION METRICS")
        report.append(f"  Total transactions analyzed within the chain network: {len(transactions)}")
        
        if transactions:
            total_amount = sum(tx.get("amount", 0) for tx in transactions)
            report.append(f"    - Aggregate Transaction Volume: ₹{total_amount:,.2f}")
            report.append("\n    Key Transaction Flow log:")
            for tx in transactions[:15]:
                report.append(f"      * {tx.get('timestamp', 'N/A')}: {tx.get('sender')} --> {tx.get('receiver')} | ₹{tx.get('amount', 0):,.2f}")
        else:
            report.append("    No transactions captured between these accounts in this batch.")
            
        report.append("\nSECTION IV: RECOMMENDATIONS")
        report.append("  1. Escalate all entities in the chain to senior compliance officers.")
        report.append("  2. Review the connections of the end-point receivers to find final beneficiaries.")
        report.append("  3. File cross-referenced STR reports linking all subject accounts.")
        
        report.append("\n================================================================================")
        report.append("  Generated by FinTrace AML Platform (Rule-Based Fallback Mode — LLM Offline)   ")
        report.append("================================================================================")
        return "\n".join(report)

    async def generate_sar(
        self,
        account_id: str,
        risk_data: Dict[str, Any],
        alerts: List[Dict[str, Any]],
        transactions: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """
        Generate a SAR for a specific account.
        """
        ollama_ok = await self.is_ollama_available()
        if not ollama_ok:
            report = self._generate_fallback_sar_text(account_id, risk_data, alerts, transactions)
            return {
                "account_id": account_id,
                "report": report,
                "risk_level": risk_data.get("level", "unknown"),
                "risk_score": risk_data.get("score", 0),
                "flags": risk_data.get("flags", []),
                "model_used": "rule-based-fallback (Ollama offline)",
            }

        context = self._build_context(account_id, risk_data, alerts, transactions)
        prompt = f"""Analyze the following suspicious account data and generate a Suspicious Activity Report:

{context}

Generate a complete, formal SAR based on this evidence."""

        report = await self._query_ollama(prompt)

        return {
            "account_id": account_id,
            "report": report,
            "risk_level": risk_data.get("level", "unknown"),
            "risk_score": risk_data.get("score", 0),
            "flags": risk_data.get("flags", []),
            "model_used": self.model,
        }

    async def generate_chain_sar(
        self,
        chain: List[str],
        alerts: List[Dict[str, Any]],
        transactions: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """
        Generate a SAR for an entire suspicious chain of accounts.
        """
        ollama_ok = await self.is_ollama_available()
        if not ollama_ok:
            report = self._generate_fallback_chain_sar_text(chain, alerts, transactions)
            return {
                "chain": chain,
                "report": report,
                "account_count": len(chain),
                "model_used": "rule-based-fallback (Ollama offline)",
            }

        context = self._build_chain_context(chain, alerts, transactions)
        prompt = f"""Analyze the following suspicious transaction chain and generate a Suspicious Activity Report:

{context}

This chain involves {len(chain)} connected accounts. Generate a complete, formal SAR."""

        report = await self._query_ollama(prompt)

        return {
            "chain": chain,
            "report": report,
            "account_count": len(chain),
            "model_used": self.model,
        }

    def _build_context(
        self,
        account_id: str,
        risk_data: Dict[str, Any],
        alerts: List[Dict[str, Any]],
        transactions: List[Dict[str, Any]],
    ) -> str:
        """Build structured context text from account data."""
        lines = [
            f"=== ACCOUNT UNDER INVESTIGATION ===",
            f"Account ID: {account_id}",
            f"Risk Score: {risk_data.get('score', 0)}/100",
            f"Risk Level: {risk_data.get('level', 'unknown').upper()}",
            f"Detection Flags: {', '.join(risk_data.get('flags', []))}",
            "",
            f"=== RISK BREAKDOWN ===",
        ]

        breakdown = risk_data.get("breakdown", {})
        for rule, points in breakdown.items():
            lines.append(f"  {rule}: +{points} points")

        lines.append("")
        lines.append(f"=== ALERTS ({len(alerts)}) ===")
        for i, alert in enumerate(alerts, 1):
            lines.append(f"\nAlert #{i}:")
            lines.append(f"  Type: {alert.get('alert_type', 'unknown')}")
            lines.append(f"  Risk Score: {alert.get('risk_score', 0)}")
            if "accounts_involved" in alert:
                lines.append(f"  Accounts: {', '.join(alert['accounts_involved'])}")
            if "description" in alert:
                lines.append(f"  Description: {alert['description']}")

        lines.append("")
        lines.append(f"=== TRANSACTIONS ({len(transactions)}) ===")
        for tx in transactions[:50]:  # Limit to 50 for context window
            lines.append(
                f"  {tx.get('sender', '?')} → {tx.get('receiver', '?')}: "
                f"₹{tx.get('amount', 0):,.2f} | {tx.get('timestamp', 'unknown')} | "
                f"{tx.get('mode', 'unknown')}"
            )

        return "\n".join(lines)

    def _build_chain_context(
        self,
        chain: List[str],
        alerts: List[Dict[str, Any]],
        transactions: List[Dict[str, Any]],
    ) -> str:
        """Build context for a chain-level SAR."""
        lines = [
            f"=== SUSPICIOUS CHAIN ===",
            f"Chain: {' → '.join(chain)}",
            f"Number of accounts: {len(chain)}",
            "",
            f"=== RELATED ALERTS ({len(alerts)}) ===",
        ]

        for i, alert in enumerate(alerts, 1):
            lines.append(f"  Alert #{i}: {alert.get('alert_type', 'unknown')} "
                         f"(score: {alert.get('risk_score', 0)})")

        lines.append("")
        lines.append(f"=== CHAIN TRANSACTIONS ({len(transactions)}) ===")
        for tx in transactions[:50]:
            lines.append(
                f"  {tx.get('sender', '?')} → {tx.get('receiver', '?')}: "
                f"₹{tx.get('amount', 0):,.2f} | {tx.get('timestamp', 'unknown')}"
            )

        return "\n".join(lines)

    async def _query_ollama(self, prompt: str) -> str:
        """
        Send a prompt to the local Ollama LLM and return the response.

        Uses the /api/generate endpoint for single-turn generation.
        """
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(
                    f"{self.base_url}/api/generate",
                    json={
                        "model": self.model,
                        "system": SAR_SYSTEM_PROMPT,
                        "prompt": prompt,
                        "stream": False,
                        "options": {
                            "temperature": 0.3,  # Low temp for factual, formal output
                            "top_p": 0.9,
                            "num_predict": 2000,
                        },
                    },
                )
                response.raise_for_status()
                data = response.json()
                return data.get("response", "Error: No response from LLM")

        except httpx.ConnectError:
            return (
                "⚠️ Ollama is not running. Please start Ollama with:\n"
                f"  ollama serve\n"
                f"  ollama pull {self.model}\n\n"
                "Then retry SAR generation."
            )
        except httpx.HTTPStatusError as e:
            return f"⚠️ Ollama API error: {e.response.status_code} — {e.response.text}"
        except Exception as e:
            return f"⚠️ SAR generation failed: {str(e)}"
