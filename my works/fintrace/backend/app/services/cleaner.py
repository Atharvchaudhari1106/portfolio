"""
FinTrace — Data Cleaning & Validation Service

Deduplication, validation, and standardization of parsed transaction data.
"""

import re
import hashlib
from typing import Dict, Any
from datetime import datetime

import pandas as pd
from dateutil import parser as date_parser


class CleaningReport:
    """Tracks cleaning operations and their results."""

    def __init__(self):
        self.original_count: int = 0
        self.duplicates_removed: int = 0
        self.invalid_removed: int = 0
        self.records_cleaned: int = 0
        self.warnings: list = []
        self.final_count: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "original_count": self.original_count,
            "duplicates_removed": self.duplicates_removed,
            "invalid_removed": self.invalid_removed,
            "records_cleaned": self.records_cleaned,
            "warnings": self.warnings,
            "final_count": self.final_count,
        }


class DataCleaner:
    """
    Cleans and validates transaction DataFrames.

    Pipeline:
    1. Remove exact duplicates
    2. Remove invalid records (missing required fields, invalid amounts)
    3. Standardize dates to ISO 8601
    4. Standardize amounts to 2 decimal places
    5. Standardize currency codes
    6. Normalize names (title case, trim whitespace)
    7. Generate transaction hash for dedup
    """

    @staticmethod
    def clean(df: pd.DataFrame) -> tuple[pd.DataFrame, CleaningReport]:
        """
        Run the full cleaning pipeline on a transaction DataFrame.

        Args:
            df: Raw parsed DataFrame with standard column names.

        Returns:
            Tuple of (cleaned DataFrame, CleaningReport).
        """
        report = CleaningReport()
        report.original_count = len(df)

        # Step 1: Remove exact duplicate rows
        before = len(df)
        df = df.drop_duplicates()
        report.duplicates_removed += before - len(df)

        # Step 2: Remove rows with missing required fields
        required = ["sender", "receiver", "amount", "timestamp"]
        before = len(df)
        df = df.dropna(subset=required)
        removed = before - len(df)
        report.invalid_removed += removed
        if removed > 0:
            report.warnings.append(
                f"Removed {removed} records with missing required fields"
            )

        # Step 3: Standardize amounts
        df, amount_report = DataCleaner._clean_amounts(df)
        report.invalid_removed += amount_report["invalid"]
        report.records_cleaned += amount_report["cleaned"]
        report.warnings.extend(amount_report["warnings"])

        # Step 4: Standardize dates
        df, date_report = DataCleaner._clean_dates(df)
        report.invalid_removed += date_report["invalid"]
        report.records_cleaned += date_report["cleaned"]
        report.warnings.extend(date_report["warnings"])

        # Step 5: Standardize currency
        df = DataCleaner._clean_currency(df)

        # Step 6: Normalize names
        df = DataCleaner._clean_names(df)

        # Step 7: Hash-based deduplication (sender+receiver+amount+timestamp)
        before = len(df)
        df = DataCleaner._deduplicate_by_hash(df)
        hash_dupes = before - len(df)
        report.duplicates_removed += hash_dupes
        if hash_dupes > 0:
            report.warnings.append(
                f"Removed {hash_dupes} semantic duplicates "
                "(same sender+receiver+amount+timestamp)"
            )

        # Step 8: Clean descriptions / modes
        df = DataCleaner._clean_metadata(df)

        # Reset index
        df = df.reset_index(drop=True)
        report.final_count = len(df)

        return df, report

    @staticmethod
    def _clean_amounts(df: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
        """Parse and validate amount values."""
        result = {"invalid": 0, "cleaned": 0, "warnings": []}

        def parse_amount(val):
            if pd.isna(val):
                return None
            s = str(val).strip()
            # Remove currency symbols and commas
            s = re.sub(r"[₹$€£,\s]", "", s)
            # Handle parentheses for negative (accounting format)
            if s.startswith("(") and s.endswith(")"):
                s = "-" + s[1:-1]
            try:
                amount = round(float(s), 2)
                return abs(amount)  # All amounts stored as positive
            except (ValueError, TypeError):
                return None

        df["amount"] = df["amount"].apply(parse_amount)

        # Remove rows with invalid amounts
        invalid_mask = df["amount"].isna() | (df["amount"] <= 0)
        invalid_count = invalid_mask.sum()
        if invalid_count > 0:
            result["invalid"] = int(invalid_count)
            result["warnings"].append(
                f"Removed {invalid_count} records with invalid amounts"
            )
            df = df[~invalid_mask].copy()

        result["cleaned"] = len(df)
        return df, result

    @staticmethod
    def _clean_dates(df: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
        """Parse and standardize date/timestamp values to ISO 8601."""
        result = {"invalid": 0, "cleaned": 0, "warnings": []}

        def parse_date(val):
            if pd.isna(val):
                return None
            s = str(val).strip()
            try:
                # dateutil.parser handles most formats
                dt = date_parser.parse(s, dayfirst=True)  # Indian date format preference
                return dt
            except (ValueError, TypeError):
                return None

        df["timestamp"] = df["timestamp"].apply(parse_date)

        # Remove rows with unparseable dates
        invalid_mask = df["timestamp"].isna()
        invalid_count = invalid_mask.sum()
        if invalid_count > 0:
            result["invalid"] = int(invalid_count)
            result["warnings"].append(
                f"Removed {invalid_count} records with unparseable dates"
            )
            df = df[~invalid_mask].copy()

        result["cleaned"] = len(df)
        return df, result

    @staticmethod
    def _clean_currency(df: pd.DataFrame) -> pd.DataFrame:
        """Standardize currency codes to ISO 4217."""
        currency_map = {
            "rs": "INR", "rs.": "INR", "inr": "INR", "₹": "INR",
            "rupee": "INR", "rupees": "INR",
            "usd": "USD", "$": "USD", "dollar": "USD",
            "eur": "EUR", "€": "EUR", "euro": "EUR",
            "gbp": "GBP", "£": "GBP", "pound": "GBP",
        }

        if "currency" in df.columns:
            df["currency"] = (
                df["currency"]
                .fillna("INR")
                .astype(str)
                .str.strip()
                .str.lower()
                .map(lambda x: currency_map.get(x, x.upper()))
            )
        else:
            df["currency"] = "INR"

        return df

    @staticmethod
    def _clean_names(df: pd.DataFrame) -> pd.DataFrame:
        """Normalize account names: trim, title case, collapse whitespace."""

        def normalize_name(val):
            if pd.isna(val):
                return "Unknown"
            s = str(val).strip()
            # Collapse multiple whitespace
            s = re.sub(r"\s+", " ", s)
            # Title case (unless all-caps like UPI IDs)
            if not s.isupper() or len(s) > 20:
                s = s.title()
            return s

        for col in ["sender", "receiver"]:
            if col in df.columns:
                df[col] = df[col].apply(normalize_name)

        return df

    @staticmethod
    def _deduplicate_by_hash(df: pd.DataFrame) -> pd.DataFrame:
        """Remove semantic duplicates based on transaction content hash."""

        def tx_hash(row):
            key = f"{row['sender']}|{row['receiver']}|{row['amount']}|{row['timestamp']}"
            return hashlib.md5(key.encode()).hexdigest()

        df["_tx_hash"] = df.apply(tx_hash, axis=1)
        df = df.drop_duplicates(subset="_tx_hash")
        df = df.drop(columns=["_tx_hash"])
        return df

    @staticmethod
    def _clean_metadata(df: pd.DataFrame) -> pd.DataFrame:
        """Clean optional metadata fields."""
        # Standardize payment modes
        mode_map = {
            "upi": "UPI", "neft": "NEFT", "rtgs": "RTGS", "imps": "IMPS",
            "cash": "Cash", "cheque": "Cheque", "dd": "DD",
            "wire": "Wire", "transfer": "Transfer",
        }
        if "mode" in df.columns:
            df["mode"] = (
                df["mode"]
                .fillna("")
                .astype(str)
                .str.strip()
                .str.lower()
                .map(lambda x: mode_map.get(x, x.title() if x else None))
            )

        # Clean descriptions
        if "description" in df.columns:
            df["description"] = (
                df["description"]
                .fillna("")
                .astype(str)
                .str.strip()
                .replace("", None)
            )

        # Clean reference numbers
        if "reference_number" in df.columns:
            df["reference_number"] = (
                df["reference_number"]
                .fillna("")
                .astype(str)
                .str.strip()
                .replace("", None)
            )

        return df
