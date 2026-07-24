"""
FinTrace — Neo4j Graph Database Driver

Async Neo4j driver singleton with query helpers.
Gracefully degrades when Neo4j is unavailable (local dev without Docker).
"""

from typing import Any, Dict, List, Optional
from neo4j import AsyncGraphDatabase, AsyncDriver

from app.core.config import settings


class Neo4jDriver:
    """Singleton async Neo4j driver with convenience query methods."""

    _driver: Optional[AsyncDriver] = None
    _available: bool = False

    @classmethod
    async def connect(cls):
        """Initialize the Neo4j connection pool. Non-fatal if unavailable."""
        if not settings.use_neo4j:
            print("  [WARN] Neo4j disabled (use_neo4j=False). Using in-memory graph only.")
            cls._available = False
            return

        try:
            cls._driver = AsyncGraphDatabase.driver(
                settings.neo4j_uri,
                auth=(settings.neo4j_user, settings.neo4j_password),
                max_connection_pool_size=50,
            )
            await cls._driver.verify_connectivity()
            cls._available = True
        except Exception as e:
            print(f"  [WARN] Neo4j unavailable: {e}")
            print("    -> Running without Neo4j. Graph features use in-memory fallback.")
            cls._driver = None
            cls._available = False

    @classmethod
    async def close(cls):
        """Close the Neo4j connection pool."""
        if cls._driver is not None:
            await cls._driver.close()
            cls._driver = None
            cls._available = False

    @classmethod
    def is_available(cls) -> bool:
        """Check if Neo4j is connected and available."""
        return cls._available and cls._driver is not None

    @classmethod
    def get_driver(cls) -> AsyncDriver:
        """Return the active driver instance."""
        if cls._driver is None:
            raise RuntimeError("Neo4j driver not initialized. Call connect() first.")
        return cls._driver

    @classmethod
    async def run_query(
        cls,
        query: str,
        parameters: Optional[Dict[str, Any]] = None,
        database: str = "neo4j",
    ) -> List[Dict[str, Any]]:
        """
        Execute a read query and return all records as dicts.
        Returns empty list if Neo4j is unavailable.
        """
        if not cls.is_available():
            return []

        driver = cls.get_driver()
        async with driver.session(database=database) as session:
            result = await session.run(query, parameters or {})
            records = await result.data()
            return records

    @classmethod
    async def run_write(
        cls,
        query: str,
        parameters: Optional[Dict[str, Any]] = None,
        database: str = "neo4j",
    ) -> Dict[str, Any]:
        """
        Execute a write query and return summary counters.
        Returns empty counters if Neo4j is unavailable.
        """
        if not cls.is_available():
            return {
                "nodes_created": 0,
                "nodes_deleted": 0,
                "relationships_created": 0,
                "relationships_deleted": 0,
                "properties_set": 0,
            }

        driver = cls.get_driver()
        async with driver.session(database=database) as session:

            async def _write_tx(tx):
                result = await tx.run(query, parameters or {})
                summary = await result.consume()
                return {
                    "nodes_created": summary.counters.nodes_created,
                    "nodes_deleted": summary.counters.nodes_deleted,
                    "relationships_created": summary.counters.relationships_created,
                    "relationships_deleted": summary.counters.relationships_deleted,
                    "properties_set": summary.counters.properties_set,
                }

            return await session.execute_write(_write_tx)

    @classmethod
    async def setup_constraints(cls):
        """Create indexes and constraints for the transaction graph."""
        if not cls.is_available():
            return

        constraints = [
            "CREATE CONSTRAINT account_id_unique IF NOT EXISTS "
            "FOR (a:Account) REQUIRE a.account_id IS UNIQUE",
            "CREATE INDEX account_name_idx IF NOT EXISTS "
            "FOR (a:Account) ON (a.name)",
            "CREATE INDEX transfer_timestamp_idx IF NOT EXISTS "
            "FOR ()-[r:TRANSFERRED]-() ON (r.timestamp)",
        ]
        for cypher in constraints:
            try:
                await cls.run_write(cypher)
            except Exception:
                pass


# ── FastAPI Dependency ────────────────────────────────

async def get_neo4j() -> type[Neo4jDriver]:
    """FastAPI dependency: return the Neo4j driver singleton."""
    return Neo4jDriver
