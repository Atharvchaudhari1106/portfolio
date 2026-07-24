"""
FinTrace — AI Chat Investigator

Interactive AI chat for investigating suspicious accounts and transactions.
Uses local Ollama LLM with transaction graph context.
"""

from typing import Any, Dict, List, Optional

import httpx

from app.core.config import settings


INVESTIGATOR_SYSTEM_PROMPT = """You are an AI AML (Anti-Money Laundering) investigation assistant for FinTrace.

You help compliance officers and investigators understand suspicious financial activity.

When answering questions:
1. Be specific — reference actual account IDs, amounts, and dates from the context provided.
2. Explain WHY something is suspicious using AML terminology.
3. Suggest next investigation steps when appropriate.
4. Use clear, professional language.
5. If you don't have enough context to answer, say so explicitly.

AML detection types you understand:
- Circular Routing: Money flows in cycles (A→B→C→A)
- Mule Accounts: Many deposits, quick consolidation, few withdrawals
- Layering: Fan-out through intermediaries to obscure origin
- Structuring (Smurfing): Splitting amounts to stay below reporting thresholds
- High Velocity: Rapid sequential transfers through chain of accounts
- Dormant Reactivation: Long-inactive accounts suddenly transacting large amounts
- Blacklist Match: Accounts matching known watchlists"""


class AIChatInvestigator:
    """
    Interactive AI assistant for AML investigation.

    Provides natural language Q&A about suspicious accounts,
    transaction patterns, and risk assessments.
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

    def _generate_fallback_chat_response(self, question: str, context: Optional[str]) -> str:
        """Generate a contextual rule-based AML response when Ollama is offline."""
        account_id = "Unknown"
        risk_score = "0"
        risk_level = "low"
        flags = []
        alerts = []
        transactions = []
        
        if context:
            # Parse context lines
            for line in context.splitlines():
                line = line.strip()
                if line.startswith("Account:"):
                    account_id = line.split("Account:")[1].strip()
                elif line.startswith("Risk Score:"):
                    score_part = line.split("Risk Score:")[1].strip()
                    if "/" in score_part:
                        risk_score = score_part.split("/")[0].strip()
                    if "(" in score_part:
                        risk_level = score_part.split("(")[1].replace(")", "").strip().lower()
                elif line.startswith("Flags:"):
                    flags_str = line.split("Flags:")[1].strip()
                    flags = [f.strip() for f in flags_str.split(",") if f.strip()]
                elif line.startswith("  - "):
                    alerts.append(line.replace("  - ", "").strip())
                elif "→" in line and "₹" in line:
                    transactions.append(line.strip())
                    
        q_lower = question.lower()
        
        if any(w in q_lower for w in ["why", "suspicious", "reason", "risk", "flag"]):
            response = [
                f"### AML Risk Assessment for Account '{account_id}'",
                f"Account **{account_id}** is assessed as **{risk_level.upper()}** risk with a score of **{risk_score}/100**.",
                "",
                f"This rating is driven by the following risk indicators: **{', '.join(flags) if flags else 'None'}**."
            ]
            if alerts:
                response.append("\n**Active Alerts Triggered:**")
                for alert in alerts:
                    response.append(f"- {alert}")
            if transactions:
                response.append("\n**Recent Transactions Checked:**")
                for tx in transactions[:5]:
                    response.append(f"- {tx}")
                    
            response.append("\n**Recommended Investigation Steps:**")
            if risk_level == "high":
                response.append("1. 🔴 Immediately freeze account assets to prevent dissipation.")
                response.append("2. 🔴 File an STR (Suspicious Transaction Report) with FIU-IND.")
                response.append("3. 🔴 Perform deep beneficiary tracing on recent transfers.")
            elif risk_level == "medium":
                response.append("1. 🟡 Place under enhanced transaction monitoring.")
                response.append("2. 🟡 Contact the account holder / bank relationship manager for source of funds proof.")
            else:
                response.append("1. 🟢 Continue standard automated transaction monitoring.")
                
            return "\n".join(response)
            
        elif any(w in q_lower for w in ["connection", "who", "trace", "route", "flow", "link"]):
            response = [
                f"### Transaction Connection Analysis for Account '{account_id}'",
                f"Analyzing transactional links for **{account_id}**:"
            ]
            if transactions:
                response.append("\nDetected recent transaction flows:")
                for tx in transactions[:10]:
                    response.append(f"- {tx}")
                response.append("\n**Suggested investigation action:** Check the Counterparty banks and verify if the recipient accounts have any common beneficial owners or registered phone numbers/IP addresses.")
            else:
                response.append("\nNo transaction logs found for this account in the current dataset.")
            return "\n".join(response)
            
        elif "mule" in q_lower:
            return (
                f"### Money Mule Assessment: Account '{account_id}'\n\n"
                f"Mule account indicators typically involve many small incoming transfers (deposits) "
                f"followed by immediate large outgoing transfers (withdrawal/consolidation) in a short window.\n\n"
                f"**Current Status:** Account '{account_id}' has a risk level of **{risk_level.upper()}** "
                f"and is flagged for **{', '.join(flags)}**.\n\n"
                f"If 'mule' is in the flags, this confirms that the deposit/withdrawal ratio and short holding duration "
                f"violated the threshold. Recommended action: perform a video KYC audit on the account owner."
            )
            
        elif "circular" in q_lower or "cycle" in q_lower:
            return (
                f"### Circular Routing Assessment: Account '{account_id}'\n\n"
                f"Circular routing (or round-tripping) is a layering technique where money is passed through "
                f"multiple intermediate accounts only to return to the original sender. This serves no legitimate business "
                f"purpose and is used to fabricate transaction volume or disguise fund origins.\n\n"
                f"**Current Status:** Account '{account_id}' is flagged for **{', '.join(flags)}**.\n\n"
                f"If circular routing was detected, please view the transaction cycles tab for a full map of the flow."
            )
            
        else:
            return (
                f"Hello! I am your FinTrace AML Investigation assistant. I'm currently running in **Rule-Based Fallback Mode** (Ollama offline).\n\n"
                f"Based on the context, here is what I know about the account:\n"
                f"- **Account ID:** {account_id}\n"
                f"- **Risk Level:** {risk_level.upper()} ({risk_score}/100)\n"
                f"- **Flags:** {', '.join(flags) if flags else 'None'}\n\n"
                f"You can ask me specifically about:\n"
                f"1. **'why is this account suspicious'** / **'risk score'**\n"
                f"2. **'connections'** / **'recent transactions'**\n"
                f"3. Specific flags like **'mule'** or **'circular'** routing."
            )

    async def chat(
        self,
        question: str,
        context: Optional[str] = None,
        conversation_history: Optional[List[Dict[str, str]]] = None,
    ) -> str:
        """
        Answer an investigation question using AI.
        """
        ollama_ok = await self.is_ollama_available()
        if not ollama_ok:
            return self._generate_fallback_chat_response(question, context)

        # Build the prompt with context
        prompt_parts = []

        if context:
            prompt_parts.append(f"=== INVESTIGATION CONTEXT ===\n{context}\n")

        if conversation_history:
            prompt_parts.append("=== CONVERSATION HISTORY ===")
            for msg in conversation_history[-10:]:  # Last 10 messages
                role = msg.get("role", "user")
                content = msg.get("content", "")
                prompt_parts.append(f"{role.upper()}: {content}")
            prompt_parts.append("")

        prompt_parts.append(f"INVESTIGATOR: {question}")
        prompt = "\n".join(prompt_parts)

        return await self._query_ollama(prompt)

    async def explain_account(
        self,
        account_id: str,
        risk_data: Dict[str, Any],
        alerts: List[Dict[str, Any]],
        transactions: List[Dict[str, Any]],
    ) -> str:
        """
        Generate a comprehensive explanation for why an account is flagged.
        """
        context = self._build_account_context(
            account_id, risk_data, alerts, transactions
        )
        question = (
            f"Why is account '{account_id}' suspicious? "
            f"Provide a detailed explanation of all risk factors."
        )
        return await self.chat(question, context)

    def _build_account_context(
        self,
        account_id: str,
        risk_data: Dict[str, Any],
        alerts: List[Dict[str, Any]],
        transactions: List[Dict[str, Any]],
    ) -> str:
        """Build investigation context for an account."""
        lines = [
            f"Account: {account_id}",
            f"Risk Score: {risk_data.get('score', 0)}/100 ({risk_data.get('level', 'unknown').upper()})",
            f"Flags: {', '.join(risk_data.get('flags', []))}",
            "",
        ]

        if alerts:
            lines.append(f"Active Alerts ({len(alerts)}):")
            for a in alerts:
                lines.append(f"  - {a.get('alert_type')}: {a.get('description', 'No description')}")

        if transactions:
            lines.append(f"\nRecent Transactions ({len(transactions)}):")
            for tx in transactions[:20]:
                lines.append(
                    f"  {tx.get('sender')} → {tx.get('receiver')}: "
                    f"₹{tx.get('amount', 0):,.2f} ({tx.get('timestamp', '')})"
                )

        return "\n".join(lines)

    async def _query_ollama(self, prompt: str) -> str:
        """Send prompt to Ollama and return the response."""
        try:
            async with httpx.AsyncClient(timeout=90.0) as client:
                response = await client.post(
                    f"{self.base_url}/api/generate",
                    json={
                        "model": self.model,
                        "system": INVESTIGATOR_SYSTEM_PROMPT,
                        "prompt": prompt,
                        "stream": False,
                        "options": {
                            "temperature": 0.5,
                            "top_p": 0.9,
                            "num_predict": 1500,
                        },
                    },
                )
                response.raise_for_status()
                data = response.json()
                return data.get("response", "No response generated.")

        except httpx.ConnectError:
            return (
                "⚠️ Ollama is not running. Start it with `ollama serve` "
                f"and ensure the '{self.model}' model is pulled."
            )
        except Exception as e:
            return f"⚠️ AI chat error: {str(e)}"
