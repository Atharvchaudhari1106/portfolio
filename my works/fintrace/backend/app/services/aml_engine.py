"""
FinTrace — AML Detection Engine

Implements 7 anti-money laundering detection algorithms:
1. Circular Routing (DFS cycle detection)
2. Mule Account Detection (deposit/withdrawal pattern analysis)
3. Layering Detection (fan-out → fan-in patterns)
4. Structuring / Smurfing (sub-threshold splitting)
5. High Velocity Transfers (rapid sequential chains)
6. Dormant Account Reactivation (long inactivity then sudden activity)
7. Blacklisted Account Matching (cross-reference with watchlists)
"""

from typing import Any, Dict, List, Optional
from datetime import datetime, timedelta
from dataclasses import dataclass, field, asdict
from collections import defaultdict

import networkx as nx
from dateutil import parser as date_parser

# ── Alert Data Classes ────────────────────────────────

@dataclass
class CycleAlert:
    """A detected circular routing pattern."""
    cycle: List[str]
    total_amount: float
    timestamps: List[str]
    risk_score: int = 35
    alert_type: str = "circular"

@dataclass
class MuleAlert:
    """A detected mule account pattern."""
    account_id: str
    deposit_count: int
    deposit_total: float
    withdrawal_count: int
    withdrawal_total: float
    avg_holding_minutes: float
    risk_score: int = 25
    alert_type: str = "mule"

@dataclass
class LayeringChain:
    """A detected layering (fan-out → fan-in) pattern."""
    source: str
    layers: List[List[str]]  # Each layer is a list of accounts
    final_destination: str
    total_amount: float
    risk_score: int = 20
    alert_type: str = "layering"

@dataclass
class StructuringAlert:
    """A detected structuring/smurfing pattern."""
    sender: str
    receiver: str
    transactions: List[Dict[str, Any]]
    total_amount: float
    count: int
    threshold: float
    risk_score: int = 15
    alert_type: str = "structuring"

@dataclass
class VelocityChain:
    """A detected high-velocity transfer chain."""
    chain: List[str]
    total_amount: float
    total_minutes: float
    hop_count: int
    risk_score: int = 20
    alert_type: str = "velocity"

@dataclass
class DormantAlert:
    """A detected dormant account reactivation."""
    account_id: str
    dormancy_days: int
    reactivation_amount: float
    last_active: str
    reactivation_date: str
    risk_score: int = 15
    alert_type: str = "dormant"

@dataclass
class BlacklistMatch:
    """A blacklisted account match."""
    account_id: str
    matched_field: str  # "sender" or "receiver"
    transaction_count: int
    total_amount: float
    risk_score: int = 50
    alert_type: str = "blacklist"


# ── AML Detection Engine ─────────────────────────────

class AMLEngine:
    """
    Core AML detection engine.

    Loads transaction data into a NetworkX DiGraph and runs
    all 7 detection algorithms. Returns structured alerts.
    """

    def __init__(self):
        self.graph: Optional[nx.MultiDiGraph] = None
        self.transactions: List[Dict[str, Any]] = []

    def load_transactions(self, transactions: List[Dict[str, Any]]):
        """
        Build a NetworkX MultiDiGraph from transaction records.

        Args:
            transactions: List of dicts with sender, receiver, amount, timestamp.
        """
        self.transactions = transactions
        self.graph = nx.MultiDiGraph()

        for tx in transactions:
            sender = tx["sender"]
            receiver = tx["receiver"]
            amount = float(tx.get("amount", 0))
            timestamp = tx.get("timestamp", "")

            # Parse timestamp if string
            if isinstance(timestamp, str) and timestamp:
                try:
                    timestamp = date_parser.parse(timestamp)
                except (ValueError, TypeError):
                    timestamp = None

            self.graph.add_edge(
                sender,
                receiver,
                amount=amount,
                timestamp=timestamp,
                mode=tx.get("mode", ""),
            )

    # ── Algorithm 1: Circular Routing ─────────────────

    def detect_circular_routes(
        self,
        min_length: int = 2,
        max_length: int = 6,
    ) -> List[CycleAlert]:
        """
        Detect circular money flows: A → B → C → A.

        Uses NetworkX simple_cycles() with length filtering.
        Circular flows are a hallmark of money laundering and wash trading.

        Args:
            min_length: Minimum cycle length (default 3 nodes).
            max_length: Maximum cycle length (default 6 nodes).

        Returns:
            List of CycleAlert for each detected cycle.
        """
        if self.graph is None:
            return []

        # Convert MultiDiGraph to DiGraph for cycle detection
        simple_graph = nx.DiGraph(self.graph)
        alerts = []

        try:
            cycles = list(nx.simple_cycles(simple_graph))
        except Exception:
            return []

        for cycle in cycles:
            if min_length <= len(cycle) <= max_length:
                # Calculate total amount in the cycle
                total_amount = 0
                timestamps = []
                for i in range(len(cycle)):
                    src = cycle[i]
                    dst = cycle[(i + 1) % len(cycle)]
                    edge_data = self.graph.get_edge_data(src, dst)
                    if edge_data:
                        for key, data in edge_data.items():
                            total_amount += data.get("amount", 0)
                            ts = data.get("timestamp")
                            if ts:
                                timestamps.append(
                                    ts.isoformat() if isinstance(ts, datetime) else str(ts)
                                )

                alerts.append(CycleAlert(
                    cycle=cycle,
                    total_amount=round(total_amount, 2),
                    timestamps=sorted(timestamps),
                ))

        return alerts

    # ── Algorithm 2: Mule Account Detection ───────────

    def detect_mule_accounts(
        self,
        min_deposits: int = 2,
        max_holding_minutes: int = 1440,
        consolidation_ratio: float = 0.5,
    ) -> List[MuleAlert]:
        """
        Detect mule accounts: many small deposits → quick consolidation → large withdrawal.

        Indicators:
        - High in-degree (many incoming small payments)
        - Low out-degree (1-2 large outgoing transfers)
        - Short holding time between deposits and withdrawals
        - High consolidation ratio (outgoing ≈ incoming)

        Args:
            min_deposits: Minimum incoming transactions to flag.
            max_holding_minutes: Maximum avg time between deposit and withdrawal.
            consolidation_ratio: Minimum ratio of outgoing/incoming sums.

        Returns:
            List of MuleAlert for flagged accounts.
        """
        if self.graph is None:
            return []

        alerts = []

        for node in self.graph.nodes():
            # Get incoming edges (deposits)
            in_edges = list(self.graph.in_edges(node, data=True))
            out_edges = list(self.graph.out_edges(node, data=True))

            in_count = len(in_edges)
            out_count = len(out_edges)

            if in_count < min_deposits:
                continue

            # Calculate totals
            in_total = sum(d.get("amount", 0) for _, _, d in in_edges)
            out_total = sum(d.get("amount", 0) for _, _, d in out_edges)

            if in_total == 0:
                continue

            # Check consolidation ratio
            ratio = out_total / in_total if in_total > 0 else 0
            if ratio < consolidation_ratio:
                continue

            # Check holding time
            in_times = [
                d["timestamp"] for _, _, d in in_edges
                if isinstance(d.get("timestamp"), datetime)
            ]
            out_times = [
                d["timestamp"] for _, _, d in out_edges
                if isinstance(d.get("timestamp"), datetime)
            ]

            if in_times and out_times:
                avg_in = sum(t.timestamp() for t in in_times) / len(in_times)
                avg_out = sum(t.timestamp() for t in out_times) / len(out_times)
                holding_minutes = (avg_out - avg_in) / 60
            else:
                holding_minutes = float("inf")

            # Flag if many deposits and few withdrawals with short holding
            if out_count <= 3 and (holding_minutes <= max_holding_minutes or holding_minutes == float("inf")):
                alerts.append(MuleAlert(
                    account_id=node,
                    deposit_count=in_count,
                    deposit_total=round(in_total, 2),
                    withdrawal_count=out_count,
                    withdrawal_total=round(out_total, 2),
                    avg_holding_minutes=round(holding_minutes, 2) if holding_minutes != float("inf") else -1,
                ))

        return alerts

    # ── Algorithm 3: Layering Detection ───────────────

    def detect_layering(
        self,
        fan_out_threshold: int = 2,
        depth: int = 3,
    ) -> List[LayeringChain]:
        """
        Detect layering patterns: A → {B, C, D} → {E, F} → Shell.

        Layering is a common AML technique where funds are split across
        multiple intermediaries before being consolidated.

        Args:
            fan_out_threshold: Minimum out-degree to consider as "fan-out".
            depth: Maximum number of layers to trace.

        Returns:
            List of LayeringChain alerts.
        """
        if self.graph is None:
            return []

        alerts = []
        simple_graph = nx.DiGraph(self.graph)

        for node in simple_graph.nodes():
            out_degree = simple_graph.out_degree(node)

            if out_degree < fan_out_threshold:
                continue

            # Trace the layering pattern via BFS
            layers = []
            current_layer = [node]
            visited = {node}

            for d in range(depth):
                next_layer = []
                for account in current_layer:
                    successors = list(simple_graph.successors(account))
                    for s in successors:
                        if s not in visited:
                            next_layer.append(s)
                            visited.add(s)

                if not next_layer:
                    break
                layers.append(next_layer)
                current_layer = next_layer

            # Check for fan-in at the end (convergence)
            if len(layers) >= 2:
                first_layer_size = len(layers[0])
                last_layer_size = len(layers[-1])

                # Fan-out → fan-in pattern
                if first_layer_size >= fan_out_threshold and last_layer_size < first_layer_size:
                    # Calculate total amount
                    total_amount = 0
                    for _, _, d in simple_graph.out_edges(node, data=True):
                        total_amount += d.get("amount", 0)

                    final_dest = layers[-1][0] if layers[-1] else "Unknown"

                    alerts.append(LayeringChain(
                        source=node,
                        layers=layers,
                        final_destination=final_dest,
                        total_amount=round(total_amount, 2),
                    ))

        return alerts

    # ── Algorithm 4: Structuring / Smurfing ───────────

    def detect_structuring(
        self,
        threshold: float = 10000,
        margin_pct: float = 0.05,
        time_window_hours: int = 48,
        min_count: int = 2,
    ) -> List[StructuringAlert]:
        """
        Detect structuring: multiple transactions just below reporting threshold.

        Instead of ₹5,00,000 the criminal sends ₹49,000, ₹49,500, ₹48,900
        to avoid regulatory reporting limits.

        Args:
            threshold: Reporting threshold amount (default ₹50,000).
            margin_pct: How close to threshold to flag (default 5%).
            time_window_hours: Time window to group transactions.
            min_count: Minimum number of sub-threshold transactions.

        Returns:
            List of StructuringAlert.
        """
        # Group transactions by sender-receiver pair
        pair_txns = defaultdict(list)
        for tx in self.transactions:
            key = (tx["sender"], tx["receiver"])
            amount = float(tx.get("amount", 0))
            timestamp = tx.get("timestamp", "")

            if isinstance(timestamp, str) and timestamp:
                try:
                    timestamp = date_parser.parse(timestamp)
                except (ValueError, TypeError):
                    timestamp = None

            pair_txns[key].append({
                "amount": amount,
                "timestamp": timestamp,
            })

        alerts = []
        lower_bound = threshold * (1 - margin_pct)

        for (sender, receiver), txns in pair_txns.items():
            # Filter to sub-threshold transactions
            sub_threshold = [
                t for t in txns
                if lower_bound <= t["amount"] < threshold
            ]

            if len(sub_threshold) < min_count:
                continue

            # Check if they fall within the time window
            timed = [t for t in sub_threshold if isinstance(t.get("timestamp"), datetime)]

            if timed:
                timed.sort(key=lambda x: x["timestamp"])
                window = timedelta(hours=time_window_hours)

                # Sliding window check
                for i in range(len(timed)):
                    window_txns = [
                        t for t in timed[i:]
                        if t["timestamp"] - timed[i]["timestamp"] <= window
                    ]
                    if len(window_txns) >= min_count:
                        total = sum(t["amount"] for t in window_txns)
                        if total >= threshold:
                            alerts.append(StructuringAlert(
                                sender=sender,
                                receiver=receiver,
                                transactions=[
                                    {
                                        "amount": t["amount"],
                                        "timestamp": t["timestamp"].isoformat() if t.get("timestamp") else "",
                                    }
                                    for t in window_txns
                                ],
                                total_amount=round(total, 2),
                                count=len(window_txns),
                                threshold=threshold,
                            ))
                        break  # One alert per pair
            else:
                # No timestamps — just check count and total
                total = sum(t["amount"] for t in sub_threshold)
                if total >= threshold:
                    alerts.append(StructuringAlert(
                        sender=sender,
                        receiver=receiver,
                        transactions=[
                            {"amount": t["amount"], "timestamp": ""} for t in sub_threshold
                        ],
                        total_amount=round(total, 2),
                        count=len(sub_threshold),
                        threshold=threshold,
                    ))

        return alerts

    # ── Algorithm 5: High Velocity Transfers ──────────

    def detect_high_velocity(
        self,
        max_chain_minutes: int = 1440,
        min_hops: int = 2,
    ) -> List[VelocityChain]:
        """
        Detect rapid sequential transfers: A→B→C→D→E within 30 minutes.

        Funds moving through many accounts in rapid succession
        are suspicious — legitimate transfers don't typically chain this fast.

        Args:
            max_chain_minutes: Maximum total time for the chain.
            min_hops: Minimum number of hops.

        Returns:
            List of VelocityChain alerts.
        """
        if self.graph is None:
            return []

        alerts = []
        visited_chains = set()

        # Build time-sorted edge list
        timed_edges = []
        for u, v, data in self.graph.edges(data=True):
            ts = data.get("timestamp")
            if isinstance(ts, datetime):
                timed_edges.append((u, v, ts, data.get("amount", 0)))

        timed_edges.sort(key=lambda x: x[2])

        # For each account, try to build a forward chain
        for node in self.graph.nodes():
            chain = [node]
            total_amount = 0
            start_time = None

            # DFS through time-ordered successors
            current = node
            current_time = None

            for u, v, ts, amount in timed_edges:
                if u == current:
                    if current_time is None or ts >= current_time:
                        if start_time is None:
                            start_time = ts

                        elapsed = (ts - start_time).total_seconds() / 60
                        if elapsed <= max_chain_minutes:
                            chain.append(v)
                            total_amount += amount
                            current = v
                            current_time = ts
                        else:
                            break

            if len(chain) >= min_hops + 1:
                chain_key = "→".join(chain)
                if chain_key not in visited_chains:
                    visited_chains.add(chain_key)
                    end_time = current_time or start_time
                    total_minutes = (
                        (end_time - start_time).total_seconds() / 60
                        if start_time and end_time
                        else 0
                    )
                    alerts.append(VelocityChain(
                        chain=chain,
                        total_amount=round(total_amount, 2),
                        total_minutes=round(total_minutes, 2),
                        hop_count=len(chain) - 1,
                    ))

        return alerts

    # ── Algorithm 6: Dormant Account Reactivation ─────

    def detect_dormant_reactivation(
        self,
        dormancy_days: int = 180,
        reactivation_threshold: float = 1000,
    ) -> List[DormantAlert]:
        """
        Detect accounts inactive for 180+ days that suddenly transact large amounts.

        Dormant accounts reactivated with large transactions are often
        compromised or being used for laundering.

        Args:
            dormancy_days: Minimum inactivity period.
            reactivation_threshold: Minimum amount to flag on reactivation.

        Returns:
            List of DormantAlert.
        """
        # Group transactions by account with timestamps
        account_txns = defaultdict(list)
        for tx in self.transactions:
            ts = tx.get("timestamp", "")
            if isinstance(ts, str) and ts:
                try:
                    ts = date_parser.parse(ts)
                except (ValueError, TypeError):
                    continue
            elif not isinstance(ts, datetime):
                continue

            amount = float(tx.get("amount", 0))
            account_txns[tx["sender"]].append({"timestamp": ts, "amount": amount, "role": "sender"})
            account_txns[tx["receiver"]].append({"timestamp": ts, "amount": amount, "role": "receiver"})

        alerts = []

        for account_id, txns in account_txns.items():
            if len(txns) < 2:
                continue

            txns.sort(key=lambda x: x["timestamp"])

            # Check for dormancy gaps
            for i in range(1, len(txns)):
                gap = (txns[i]["timestamp"] - txns[i - 1]["timestamp"]).days

                if gap >= dormancy_days and txns[i]["amount"] >= reactivation_threshold:
                    alerts.append(DormantAlert(
                        account_id=account_id,
                        dormancy_days=gap,
                        reactivation_amount=round(txns[i]["amount"], 2),
                        last_active=txns[i - 1]["timestamp"].isoformat(),
                        reactivation_date=txns[i]["timestamp"].isoformat(),
                    ))
                    break  # One alert per account

        return alerts

    # ── Algorithm 7: Blacklisted Account Matching ─────

    def match_blacklisted_accounts(
        self,
        blacklist: List[str],
    ) -> List[BlacklistMatch]:
        """
        Cross-reference all senders/receivers against a blacklist.

        Args:
            blacklist: List of blacklisted account IDs.

        Returns:
            List of BlacklistMatch for matched accounts.
        """
        if not blacklist:
            return []

        blacklist_set = set(b.strip().lower() for b in blacklist)
        matches = defaultdict(lambda: {"sender_count": 0, "receiver_count": 0, "total": 0})

        for tx in self.transactions:
            sender = str(tx.get("sender", "")).strip().lower()
            receiver = str(tx.get("receiver", "")).strip().lower()
            amount = float(tx.get("amount", 0))

            if sender in blacklist_set:
                matches[sender]["sender_count"] += 1
                matches[sender]["total"] += amount

            if receiver in blacklist_set:
                matches[receiver]["receiver_count"] += 1
                matches[receiver]["total"] += amount

        alerts = []
        for account_id, info in matches.items():
            field = "sender" if info["sender_count"] > 0 else "receiver"
            total_count = info["sender_count"] + info["receiver_count"]
            alerts.append(BlacklistMatch(
                account_id=account_id,
                matched_field=field,
                transaction_count=total_count,
                total_amount=round(info["total"], 2),
            ))

        return alerts

    # ── Run All Detections ────────────────────────────

    def run_all_detections(
        self,
        blacklist: Optional[List[str]] = None,
    ) -> Dict[str, List]:
        """
        Run all 7 detection algorithms and return consolidated results.

        Args:
            blacklist: Optional list of blacklisted account IDs.

        Returns:
            Dict mapping detection type to list of alerts.
        """
        results = {
            "circular": [asdict(a) for a in self.detect_circular_routes()],
            "mule": [asdict(a) for a in self.detect_mule_accounts()],
            "layering": [asdict(a) for a in self.detect_layering()],
            "structuring": [asdict(a) for a in self.detect_structuring()],
            "velocity": [asdict(a) for a in self.detect_high_velocity()],
            "dormant": [asdict(a) for a in self.detect_dormant_reactivation()],
            "blacklist": [asdict(a) for a in self.match_blacklisted_accounts(blacklist or [])],
        }
        return results
