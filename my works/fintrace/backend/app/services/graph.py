"""
FinTrace — Neo4j Graph Builder Service

Builds and queries the transaction graph in Neo4j.
Each account becomes a node, each transaction becomes an edge.
Provides database-backed local fallbacks when Neo4j is unavailable.
"""

from typing import Any, Dict, List, Optional
from datetime import datetime
from collections import defaultdict

import pandas as pd

from app.database.neo4j_driver import Neo4jDriver


class GraphBuilder:
    """
    Builds the transaction graph in Neo4j from cleaned DataFrames.

    Graph schema:
        (Account {account_id, name, bank, total_in, total_out, tx_count, risk_score})
        -[:TRANSFERRED {amount, timestamp, reference, mode, description, tx_id}]->
        (Account)
    """

    @staticmethod
    async def build_from_dataframe(df: pd.DataFrame, batch_id: str) -> Dict[str, int]:
        """
        Upsert accounts and transactions from a DataFrame into Neo4j.

        Uses UNWIND for batch performance. Idempotent — re-running
        on the same data won't create duplicates.

        Args:
            df: Cleaned transaction DataFrame.
            batch_id: Upload batch UUID string for tracking.

        Returns:
            Summary dict with counts of nodes/edges created.
        """
        if not Neo4jDriver.is_available():
            return {"nodes_created": 0, "relationships_created": 0}

        # Prepare transaction records for Cypher UNWIND
        records = []
        for _, row in df.iterrows():
            records.append({
                "sender": str(row["sender"]),
                "receiver": str(row["receiver"]),
                "amount": float(row["amount"]),
                "timestamp": (
                    row["timestamp"].isoformat()
                    if isinstance(row["timestamp"], datetime)
                    else str(row["timestamp"])
                ),
                "reference": str(row.get("reference_number", "") or ""),
                "mode": str(row.get("mode", "") or ""),
                "description": str(row.get("description", "") or ""),
                "bank": str(row.get("bank", "") or ""),
                "currency": str(row.get("currency", "INR")),
                "batch_id": batch_id,
            })

        if not records:
            return {"nodes_created": 0, "relationships_created": 0}

        # Batch upsert via Cypher UNWIND
        cypher = """
        UNWIND $records AS tx
        
        MERGE (sender:Account {account_id: tx.sender})
        ON CREATE SET 
            sender.name = tx.sender,
            sender.bank = tx.bank,
            sender.total_in = 0,
            sender.total_out = 0,
            sender.tx_count = 0,
            sender.risk_score = 0,
            sender.created_at = datetime()
        SET sender.total_out = sender.total_out + tx.amount,
            sender.tx_count = sender.tx_count + 1
        
        MERGE (receiver:Account {account_id: tx.receiver})
        ON CREATE SET
            receiver.name = tx.receiver,
            receiver.bank = tx.bank,
            receiver.total_in = 0,
            receiver.total_out = 0,
            receiver.tx_count = 0,
            receiver.risk_score = 0,
            receiver.created_at = datetime()
        SET receiver.total_in = receiver.total_in + tx.amount,
            receiver.tx_count = receiver.tx_count + 1
        
        CREATE (sender)-[:TRANSFERRED {
            amount: tx.amount,
            timestamp: tx.timestamp,
            reference: tx.reference,
            mode: tx.mode,
            description: tx.description,
            currency: tx.currency,
            batch_id: tx.batch_id
        }]->(receiver)
        """

        result = await Neo4jDriver.run_write(cypher, {"records": records})
        return result

    @staticmethod
    async def get_full_graph(
        limit: int = 500,
        skip: int = 0,
    ) -> Dict[str, Any]:
        """
        Retrieve the full transaction graph (paginated).

        Returns:
            Dict with 'nodes' and 'edges' lists for frontend visualization.
        """
        if Neo4jDriver.is_available():
            # Get nodes
            nodes_query = """
            MATCH (a:Account)
            RETURN a.account_id AS id,
                   a.name AS name,
                   a.bank AS bank,
                   a.total_in AS total_in,
                   a.total_out AS total_out,
                   a.tx_count AS tx_count,
                   a.risk_score AS risk_score
            ORDER BY a.tx_count DESC
            SKIP $skip LIMIT $limit
            """
            nodes = await Neo4jDriver.run_query(
                nodes_query, {"skip": skip, "limit": limit}
            )

            # Get edges between these nodes
            node_ids = [n["id"] for n in nodes]
            edges_query = """
            MATCH (a:Account)-[r:TRANSFERRED]->(b:Account)
            WHERE a.account_id IN $ids AND b.account_id IN $ids
            RETURN a.account_id AS source,
                   b.account_id AS target,
                   r.amount AS amount,
                   r.timestamp AS timestamp,
                   r.reference AS reference,
                   r.mode AS mode,
                   r.description AS description,
                   r.currency AS currency
            """
            edges = await Neo4jDriver.run_query(edges_query, {"ids": node_ids})
            return {"nodes": nodes, "edges": edges}

        # SQLite/PostgreSQL Fallback
        from app.database.postgres import async_session
        from sqlalchemy import select
        from app.models.transaction import Transaction
        from app.models.alert import Alert

        async with async_session() as db:
            result = await db.execute(
                select(Transaction).order_by(Transaction.timestamp.desc())
            )
            transactions = result.scalars().all()

            alert_result = await db.execute(select(Alert))
            alerts = alert_result.scalars().all()

            risk_scores = {}
            for a in alerts:
                for acc in a.accounts_involved:
                    risk_scores[acc] = max(risk_scores.get(acc, 0), a.risk_score)

            accounts = {}
            edges = []

            for tx in transactions:
                # Add sender node
                if tx.sender not in accounts:
                    accounts[tx.sender] = {
                        "id": tx.sender,
                        "name": tx.sender,
                        "bank": tx.bank or "Unknown",
                        "total_in": 0.0,
                        "total_out": 0.0,
                        "tx_count": 0,
                        "risk_score": risk_scores.get(tx.sender, 0),
                    }
                accounts[tx.sender]["total_out"] += float(tx.amount)
                accounts[tx.sender]["tx_count"] += 1

                # Add receiver node
                if tx.receiver not in accounts:
                    accounts[tx.receiver] = {
                        "id": tx.receiver,
                        "name": tx.receiver,
                        "bank": tx.bank or "Unknown",
                        "total_in": 0.0,
                        "total_out": 0.0,
                        "tx_count": 0,
                        "risk_score": risk_scores.get(tx.receiver, 0),
                    }
                accounts[tx.receiver]["total_in"] += float(tx.amount)
                accounts[tx.receiver]["tx_count"] += 1

                # Add edge
                edges.append({
                    "source": tx.sender,
                    "target": tx.receiver,
                    "amount": float(tx.amount),
                    "timestamp": tx.timestamp.isoformat() if tx.timestamp else "",
                    "reference": tx.reference_number or "",
                    "mode": tx.mode or "",
                    "description": tx.description or "",
                    "currency": tx.currency or "INR",
                })

            # Sort nodes by activity, paginate
            nodes_list = sorted(accounts.values(), key=lambda x: x["tx_count"], reverse=True)
            paginated_nodes = nodes_list[skip : skip + limit]
            paginated_node_ids = {n["id"] for n in paginated_nodes}

            # Filter edges between selected nodes
            filtered_edges = [
                e for e in edges
                if e["source"] in paginated_node_ids and e["target"] in paginated_node_ids
            ]

            return {"nodes": paginated_nodes, "edges": filtered_edges}

    @staticmethod
    async def get_account_subgraph(
        account_id: str,
        depth: int = 2,
    ) -> Dict[str, Any]:
        """
        Get a subgraph centered on a specific account, N hops deep.
        """
        if Neo4jDriver.is_available():
            query = """
            MATCH path = (center:Account {account_id: $account_id})-[:TRANSFERRED*1..%d]-(connected)
            WITH nodes(path) AS ns, relationships(path) AS rs
            UNWIND ns AS n
            WITH COLLECT(DISTINCT n) AS all_nodes, rs
            UNWIND all_nodes AS node
            WITH COLLECT(DISTINCT {
                id: node.account_id,
                name: node.name,
                bank: node.bank,
                total_in: node.total_in,
                total_out: node.total_out,
                tx_count: node.tx_count,
                risk_score: node.risk_score
            }) AS nodes, rs
            UNWIND rs AS rel_list
            UNWIND rel_list AS rel
            RETURN nodes,
                   COLLECT(DISTINCT {
                       source: startNode(rel).account_id,
                       target: endNode(rel).account_id,
                       amount: rel.amount,
                       timestamp: rel.timestamp,
                       reference: rel.reference,
                       mode: rel.mode
                   }) AS edges
            """ % depth

            results = await Neo4jDriver.run_query(query, {"account_id": account_id})

            if not results:
                return {"nodes": [], "edges": []}

            return {
                "nodes": results[0].get("nodes", []),
                "edges": results[0].get("edges", []),
            }

        # SQLite/PostgreSQL Fallback BFS in Python
        from app.database.postgres import async_session
        from sqlalchemy import select
        from app.models.transaction import Transaction
        from app.models.alert import Alert

        async with async_session() as db:
            result = await db.execute(select(Transaction))
            transactions = result.scalars().all()

            alert_result = await db.execute(select(Alert))
            alerts = alert_result.scalars().all()

            risk_scores = {}
            for a in alerts:
                for acc in a.accounts_involved:
                    risk_scores[acc] = max(risk_scores.get(acc, 0), a.risk_score)

            adj = defaultdict(list)
            for tx in transactions:
                adj[tx.sender].append(tx)
                adj[tx.receiver].append(tx)

            visited = {account_id}
            queue = [(account_id, 0)]
            subgraph_txs = set()

            idx = 0
            while idx < len(queue):
                node, curr_depth = queue[idx]
                idx += 1
                if curr_depth >= depth:
                    continue

                for tx in adj[node]:
                    subgraph_txs.add(tx)
                    neighbor = tx.receiver if tx.sender == node else tx.sender
                    if neighbor not in visited:
                        visited.add(neighbor)
                        queue.append((neighbor, curr_depth + 1))

            accounts = {}
            for tx in subgraph_txs:
                if tx.sender not in accounts:
                    accounts[tx.sender] = {
                        "id": tx.sender,
                        "name": tx.sender,
                        "bank": tx.bank or "Unknown",
                        "total_in": 0.0,
                        "total_out": 0.0,
                        "tx_count": 0,
                        "risk_score": risk_scores.get(tx.sender, 0),
                    }
                accounts[tx.sender]["total_out"] += float(tx.amount)
                accounts[tx.sender]["tx_count"] += 1

                if tx.receiver not in accounts:
                    accounts[tx.receiver] = {
                        "id": tx.receiver,
                        "name": tx.receiver,
                        "bank": tx.bank or "Unknown",
                        "total_in": 0.0,
                        "total_out": 0.0,
                        "tx_count": 0,
                        "risk_score": risk_scores.get(tx.receiver, 0),
                    }
                accounts[tx.receiver]["total_in"] += float(tx.amount)
                accounts[tx.receiver]["tx_count"] += 1

            edges = [
                {
                    "source": tx.sender,
                    "target": tx.receiver,
                    "amount": float(tx.amount),
                    "timestamp": tx.timestamp.isoformat() if tx.timestamp else "",
                    "reference": tx.reference_number or "",
                    "mode": tx.mode or "",
                }
                for tx in subgraph_txs
            ]

            return {
                "nodes": list(accounts.values()),
                "edges": edges,
            }

    @staticmethod
    async def get_account_stats(account_id: str) -> Optional[Dict[str, Any]]:
        """Get detailed statistics for a single account."""
        if Neo4jDriver.is_available():
            query = """
            MATCH (a:Account {account_id: $account_id})
            OPTIONAL MATCH (a)-[out:TRANSFERRED]->()
            OPTIONAL MATCH ()-[inc:TRANSFERRED]->(a)
            RETURN a.account_id AS id,
                   a.name AS name,
                   a.bank AS bank,
                   a.risk_score AS risk_score,
                   COUNT(DISTINCT out) AS out_degree,
                   COUNT(DISTINCT inc) AS in_degree,
                   COALESCE(SUM(out.amount), 0) AS total_sent,
                   COALESCE(SUM(inc.amount), 0) AS total_received
            """
            results = await Neo4jDriver.run_query(query, {"account_id": account_id})
            return results[0] if results else None

        # SQLite/PostgreSQL Fallback
        from app.database.postgres import async_session
        from sqlalchemy import select, func, or_
        from app.models.transaction import Transaction
        from app.models.alert import Alert

        async with async_session() as db:
            tx_check_result = await db.execute(
                select(Transaction).where(
                    or_(Transaction.sender == account_id, Transaction.receiver == account_id)
                ).limit(1)
            )
            if not tx_check_result.scalar_one_or_none():
                return None

            out_result = await db.execute(
                select(func.count(Transaction.id), func.sum(Transaction.amount))
                .where(Transaction.sender == account_id)
            )
            out_row = out_result.first()
            out_degree = out_row[0] or 0
            total_sent = float(out_row[1] or 0)

            inc_result = await db.execute(
                select(func.count(Transaction.id), func.sum(Transaction.amount))
                .where(Transaction.receiver == account_id)
            )
            inc_row = inc_result.first()
            in_degree = inc_row[0] or 0
            total_received = float(inc_row[1] or 0)

            alert_result = await db.execute(select(Alert))
            alerts = alert_result.scalars().all()
            risk_score = 0
            for a in alerts:
                if account_id in a.accounts_involved:
                    risk_score = max(risk_score, a.risk_score)

            bank_result = await db.execute(
                select(Transaction.bank).where(
                    or_(Transaction.sender == account_id, Transaction.receiver == account_id)
                ).limit(1)
            )
            bank = bank_result.scalar() or "Unknown"

            return {
                "id": account_id,
                "name": account_id,
                "bank": bank,
                "risk_score": risk_score,
                "out_degree": out_degree,
                "in_degree": in_degree,
                "total_sent": total_sent,
                "total_received": total_received,
            }

    @staticmethod
    async def get_graph_stats() -> Dict[str, Any]:
        """Get high-level graph statistics."""
        if Neo4jDriver.is_available():
            query = """
            MATCH (a:Account)
            OPTIONAL MATCH ()-[r:TRANSFERRED]->()
            RETURN COUNT(DISTINCT a) AS total_accounts,
                   COUNT(DISTINCT r) AS total_transfers
            """
            results = await Neo4jDriver.run_query(query)
            return results[0] if results else {"total_accounts": 0, "total_transfers": 0}

        # SQLite/PostgreSQL Fallback
        from app.database.postgres import async_session
        from sqlalchemy import select, func, union
        from app.models.transaction import Transaction

        async with async_session() as db:
            tx_count_result = await db.execute(select(func.count(Transaction.id)))
            total_transfers = tx_count_result.scalar() or 0

            senders_q = select(Transaction.sender)
            receivers_q = select(Transaction.receiver)
            union_q = union(senders_q, receivers_q).subquery()
            count_q = select(func.count()).select_from(union_q)
            acc_count_result = await db.execute(count_q)
            total_accounts = acc_count_result.scalar() or 0

            return {
                "total_accounts": total_accounts,
                "total_transfers": total_transfers,
            }

    @staticmethod
    async def update_account_risk(account_id: str, risk_score: int) -> None:
        """Update the risk score for an account node."""
        if Neo4jDriver.is_available():
            query = """
            MATCH (a:Account {account_id: $account_id})
            SET a.risk_score = $risk_score
            """
            await Neo4jDriver.run_write(
                query, {"account_id": account_id, "risk_score": risk_score}
            )

    @staticmethod
    async def get_all_transactions_for_networkx() -> List[Dict[str, Any]]:
        """
        Export all transactions for NetworkX analysis.
        """
        if Neo4jDriver.is_available():
            query = """
            MATCH (a:Account)-[r:TRANSFERRED]->(b:Account)
            RETURN a.account_id AS sender,
                   b.account_id AS receiver,
                   r.amount AS amount,
                   r.timestamp AS timestamp,
                   r.mode AS mode
            """
            return await Neo4jDriver.run_query(query)

        # SQLite/PostgreSQL Fallback
        from app.database.postgres import async_session
        from sqlalchemy import select
        from app.models.transaction import Transaction

        async with async_session() as db:
            result = await db.execute(select(Transaction))
            txs = result.scalars().all()
            return [
                {
                    "sender": tx.sender,
                    "receiver": tx.receiver,
                    "amount": float(tx.amount),
                    "timestamp": tx.timestamp.isoformat() if tx.timestamp else "",
                    "mode": tx.mode or "",
                }
                for tx in txs
            ]
