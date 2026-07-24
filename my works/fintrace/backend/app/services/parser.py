"""
FinTrace — File Parser Service

Multi-format parser supporting CSV, Excel, PDF bank statements, and OCR.
Extracts transactions into a standardized Pandas DataFrame.
"""

import io
import re
from typing import Optional, Tuple
from pathlib import Path
from datetime import datetime

import pandas as pd
import pdfplumber

try:
    import pytesseract
    TESSERACT_AVAILABLE = True
except ImportError:
    TESSERACT_AVAILABLE = False


# ── Column Mapping ────────────────────────────────────
# Maps commonly seen column names → standard schema names.

COLUMN_ALIASES = {
    "sender": [
        "sender", "from", "from_account", "debit_account", "payer",
        "sender_account", "sender_name", "remitter", "source",
        "from account", "from_acc", "debtor",
    ],
    "receiver": [
        "receiver", "to", "to_account", "credit_account", "payee",
        "receiver_account", "receiver_name", "beneficiary", "destination",
        "to account", "to_acc", "creditor",
    ],
    "amount": [
        "amount", "amt", "value", "transaction_amount", "txn_amount",
        "sum", "total", "credit", "debit", "transaction amount",
    ],
    "timestamp": [
        "timestamp", "date", "time", "datetime", "transaction_date",
        "txn_date", "transaction_time", "txn_time", "trans_date",
        "value_date", "transaction date", "value date",
    ],
    "reference_number": [
        "reference_number", "ref", "reference", "ref_no", "txn_id", "txn id",
        "transaction_id", "utr", "rrn", "reference number",
        "utr_number", "transaction_ref",
    ],
    "bank": [
        "bank", "bank_name", "institution", "bank name",
    ],
    "mode": [
        "mode", "type", "channel", "payment_mode", "txn_type",
        "payment_type", "transaction_type", "payment mode",
    ],
    "description": [
        "description", "desc", "narration", "remarks", "notes",
        "particulars", "memo", "details", "narrative",
    ],
}


def _map_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Map varied column names to standard schema names."""
    col_lower = {col: col.strip().lower().replace("-", "_") for col in df.columns}
    df = df.rename(columns=col_lower)

    mapping = {}
    for standard_name, aliases in COLUMN_ALIASES.items():
        for alias in aliases:
            normalized = alias.strip().lower().replace("-", "_")
            if normalized in df.columns and standard_name not in mapping.values():
                mapping[normalized] = standard_name
                break

    df = df.rename(columns=mapping)
    return df


def _ensure_required_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Ensure all required columns exist, adding empty ones if missing."""
    required = ["sender", "receiver", "amount", "timestamp"]
    optional = ["reference_number", "bank", "mode", "description", "currency"]

    missing_required = [col for col in required if col not in df.columns]
    if missing_required:
        raise ValueError(
            f"Missing required columns: {missing_required}. "
            f"Available columns: {list(df.columns)}"
        )

    for col in optional:
        if col not in df.columns:
            df[col] = None

    if "currency" not in df.columns or df["currency"].isna().all():
        df["currency"] = "INR"

    return df


# ── CSV Parser ────────────────────────────────────────

class CSVParser:
    """Parse CSV files with auto-delimiter detection."""

    @staticmethod
    def parse(file_content: bytes, filename: str = "") -> pd.DataFrame:
        """
        Parse CSV content into a standardized DataFrame.

        Args:
            file_content: Raw file bytes.
            filename: Original filename for context.

        Returns:
            Standardized DataFrame with mapped columns.
        """
        # Auto-detect delimiter
        text = file_content.decode("utf-8", errors="replace")
        for delimiter in [",", ";", "\t", "|"]:
            if delimiter in text.split("\n")[0]:
                break
        else:
            delimiter = ","

        df = pd.read_csv(
            io.StringIO(text),
            sep=delimiter,
            encoding="utf-8",
            dtype=str,
            na_values=["", "NA", "N/A", "null", "NULL", "None", "-"],
        )
        df = _map_columns(df)
        df = _ensure_required_columns(df)
        return df


# ── Excel Parser ──────────────────────────────────────

class ExcelParser:
    """Parse Excel (.xlsx / .xls) files."""

    @staticmethod
    def parse(file_content: bytes, filename: str = "") -> pd.DataFrame:
        """
        Parse Excel content into a standardized DataFrame.
        Reads the first sheet by default.
        """
        df = pd.read_excel(
            io.BytesIO(file_content),
            dtype=str,
            na_values=["", "NA", "N/A", "null", "NULL", "None", "-"],
        )
        df = _map_columns(df)
        df = _ensure_required_columns(df)
        return df


# ── PDF Parser ────────────────────────────────────────

class PDFParser:
    """
    Parse PDF bank statements using pdfplumber text extraction.
    Falls back to OCR (Tesseract) for scanned documents.
    """

    # Common bank statement patterns (Indian banks)
    TRANSACTION_PATTERNS = [
        # Date | Description | Debit | Credit | Balance
        re.compile(
            r"(?P<timestamp>\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\s+"  # Date
            r"(?P<description>.+?)\s+"                          # Description
            r"(?P<amount>[\d,]+\.?\d*)\s+"                      # Amount 1 (Debit/Credit)
            r"(?P<amount2>[\d,]+\.?\d*)?",                      # Amount 2 (optional)
        ),
        # DD/MM/YYYY | Ref | Narration | Amount
        re.compile(
            r"(?P<timestamp>\d{2}/\d{2}/\d{4})\s+"
            r"(?P<reference>\S+)\s+"
            r"(?P<description>.+?)\s+"
            r"(?:Dr|Cr)?\s*(?P<amount>[\d,]+\.?\d*)",
        ),
    ]

    @staticmethod
    def parse(file_content: bytes, filename: str = "") -> pd.DataFrame:
        """
        Extract transactions from a PDF bank statement.

        Attempts table extraction first, then text regex matching, and falls back to OCR for scanned docs.
        """
        # Step 1: Try structured table extraction via pdfplumber
        df = PDFParser._extract_tables_df(file_content)
        if df is not None and not df.empty:
            df = _map_columns(df)
            df = _ensure_required_columns(df)
            return df

        # Step 2: Fall back to text extraction & regex parsing
        text = PDFParser._extract_text(file_content)

        if not text or len(text.strip()) < 50:
            # Likely a scanned PDF — try OCR
            if TESSERACT_AVAILABLE:
                text = PDFParser._ocr_extract(file_content)
            else:
                raise ValueError(
                    "PDF appears to be scanned but Tesseract OCR is not available. "
                    "Install pytesseract and Tesseract-OCR to process scanned PDFs."
                )

        transactions = PDFParser._parse_transactions(text)

        if not transactions:
            raise ValueError(
                "Could not extract transactions from PDF. "
                "The document format may not be supported."
            )

        df = pd.DataFrame(transactions)
        df = _map_columns(df)
        df = _ensure_required_columns(df)
        return df

    @staticmethod
    def _extract_tables_df(file_content: bytes):
        """Attempt to extract structured tables directly from PDF using pdfplumber."""
        all_rows = []
        headers = None

        try:
            with pdfplumber.open(io.BytesIO(file_content)) as pdf:
                for page in pdf.pages:
                    tables = page.extract_tables()
                    for table in tables:
                        if not table or len(table) < 2:
                            continue
                        if headers is None:
                            candidate_header = [str(cell or "").strip() for cell in table[0]]
                            header_str = " ".join(candidate_header).lower()
                            if any(k in header_str for k in ["amount", "txn", "sender", "receiver", "from", "to", "date", "debit", "credit"]):
                                headers = candidate_header
                                data_rows = table[1:]
                            else:
                                data_rows = table
                        else:
                            data_rows = table

                        for row in data_rows:
                            cleaned_row = [str(cell or "").strip() for cell in row]
                            if headers and cleaned_row == headers:
                                continue
                            if any(cleaned_row):
                                all_rows.append(cleaned_row)
        except Exception:
            return None

        if not all_rows:
            return None

        if headers and len(headers) == len(all_rows[0]):
            df = pd.DataFrame(all_rows, columns=headers)
        else:
            df = pd.DataFrame(all_rows)

        return df

    @staticmethod
    def _extract_text(file_content: bytes) -> str:
        """Extract text from PDF pages using pdfplumber."""
        full_text = []
        with pdfplumber.open(io.BytesIO(file_content)) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    full_text.append(text)

                # Also try extracting tables
                tables = page.extract_tables()
                for table in tables:
                    for row in table:
                        if row:
                            full_text.append(" | ".join(str(cell or "") for cell in row))

        return "\n".join(full_text)

    @staticmethod
    def _ocr_extract(file_content: bytes) -> str:
        """Extract text from scanned PDF using Tesseract OCR."""
        try:
            from pdf2image import convert_from_bytes
            images = convert_from_bytes(file_content)
            text_parts = []
            for img in images:
                text_parts.append(pytesseract.image_to_string(img))
            return "\n".join(text_parts)
        except ImportError:
            raise ValueError(
                "pdf2image is required for OCR on scanned PDFs. "
                "Install it with: pip install pdf2image"
            )

    @staticmethod
    def _parse_transactions(text: str) -> list:
        """Parse transaction lines from extracted text."""
        transactions = []
        lines = text.split("\n")

        for line in lines:
            line = line.strip()
            if not line:
                continue

            for pattern in PDFParser.TRANSACTION_PATTERNS:
                match = pattern.search(line)
                if match:
                    gd = match.groupdict()
                    amount = gd.get("amount", "0")
                    amount = amount.replace(",", "") if amount else "0"
                    
                    tx = {
                        "timestamp": gd.get("timestamp") or "",
                        "description": gd.get("description") or "",
                        "amount": amount,
                        "sender": "Statement Holder",
                        "receiver": gd.get("description") or "Unknown",
                    }
                    if gd.get("reference"):
                        tx["reference_number"] = gd.get("reference")
                    transactions.append(tx)
                    break

        return transactions


# ── Unified Parser ────────────────────────────────────

class UnifiedParser:
    """
    Factory that dispatches to the correct parser based on file type.
    """

    PARSERS = {
        "csv": CSVParser,
        "excel": ExcelParser,
        "xlsx": ExcelParser,
        "xls": ExcelParser,
        "pdf": PDFParser,
    }

    MIME_MAP = {
        "text/csv": "csv",
        "application/vnd.ms-excel": "excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "excel",
        "application/pdf": "pdf",
    }

    @classmethod
    def detect_type(cls, filename: str, content_type: Optional[str] = None) -> str:
        """Detect file type from filename extension or MIME type."""
        if content_type and content_type in cls.MIME_MAP:
            return cls.MIME_MAP[content_type]

        ext = Path(filename).suffix.lower().lstrip(".")
        if ext in cls.PARSERS:
            return ext
        if ext in ("xlsx", "xls"):
            return "excel"

        raise ValueError(f"Unsupported file type: {ext}")

    @classmethod
    def parse(
        cls,
        file_content: bytes,
        filename: str,
        content_type: Optional[str] = None,
    ) -> Tuple[pd.DataFrame, str]:
        """
        Parse a file into a standardized DataFrame.

        Args:
            file_content: Raw file bytes.
            filename: Original filename.
            content_type: MIME type (optional).

        Returns:
            Tuple of (DataFrame, file_type string).
        """
        file_type = cls.detect_type(filename, content_type)
        parser_class = cls.PARSERS.get(file_type)

        if parser_class is None:
            raise ValueError(f"No parser available for file type: {file_type}")

        df = parser_class.parse(file_content, filename)
        return df, file_type
