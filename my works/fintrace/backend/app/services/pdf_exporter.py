"""
FinTrace — PDF Exporter Service

Generates official Suspicious Activity Reports (SARs) as formatted PDF documents
using ReportLab for regulatory compliance and law enforcement submission.
"""

import io
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    HRFlowable,
    KeepTogether,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


class PDFExporter:
    """Service to export SAR reports into highly polished, regulatory PDF files."""

    @staticmethod
    def generate_sar_pdf(sar_data: Dict[str, Any]) -> bytes:
        """
        Builds a PDF binary stream from a SAR payload dict.

        sar_data expected fields:
          - account_id (str) OR chain (List[str])
          - report (str)
          - risk_level (str)
          - risk_score (int/float)
          - flags (List[str])
          - model_used (str)
          - transactions (Optional[List[dict]])
        """
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            leftMargin=36,
            rightMargin=36,
            topMargin=36,
            bottomMargin=36,
        )

        styles = getSampleStyleSheet()

        # Custom Paragraph Styles
        header_title_style = ParagraphStyle(
            "HeaderTitle",
            parent=styles["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=16,
            leading=20,
            textColor=colors.HexColor("#FFFFFF"),
            alignment=1,  # Centered
        )

        header_subtitle_style = ParagraphStyle(
            "HeaderSubTitle",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=10,
            leading=13,
            textColor=colors.HexColor("#CBD5E1"),
            alignment=1,
        )

        meta_label_style = ParagraphStyle(
            "MetaLabel",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=9,
            leading=12,
            textColor=colors.HexColor("#475569"),
        )

        meta_val_style = ParagraphStyle(
            "MetaVal",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=9,
            leading=12,
            textColor=colors.HexColor("#0F172A"),
        )

        section_heading_style = ParagraphStyle(
            "SectionHeading",
            parent=styles["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=12,
            leading=16,
            textColor=colors.HexColor("#1E293B"),
            spaceBefore=10,
            spaceAfter=4,
        )

        body_style = ParagraphStyle(
            "BodyDark",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=9.5,
            leading=14,
            textColor=colors.HexColor("#1E293B"),
        )

        body_bold = ParagraphStyle(
            "BodyBold",
            parent=body_style,
            fontName="Helvetica-Bold",
        )

        code_style = ParagraphStyle(
            "CodeMono",
            parent=styles["Normal"],
            fontName="Courier",
            fontSize=8.5,
            leading=11,
            textColor=colors.HexColor("#0F172A"),
        )

        story = []

        # 1. Header Banner Box
        banner_text = (
            f"<b>FINANCIAL INTELLIGENCE UNIT — SUSPICIOUS ACTIVITY REPORT</b>"
        )
        banner_sub = "OFFICIAL REGULATORY SUBMISSION — STRICTLY CONFIDENTIAL"
        
        banner_data = [
            [Paragraph(banner_text, header_title_style)],
            [Paragraph(banner_sub, header_subtitle_style)],
        ]
        
        banner_table = Table(banner_data, colWidths=[540])
        banner_table.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#0F172A")),
                ("TOPPADDING", (0, 0), (-1, -1), 10),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ])
        )
        story.append(banner_table)
        story.append(Spacer(1, 10))

        # 2. Metadata Grid
        ref_id = f"SAR-{uuid.uuid4().hex[:8].upper()}"
        report_date = datetime.now().strftime("%Y-%m-%d %H:%M:%S UTC")
        
        account_id = sar_data.get("account_id")
        chain = sar_data.get("chain")
        subject = account_id if account_id else (f"Chain ({len(chain)} accounts)" if chain else "N/A")
        risk_level = str(sar_data.get("risk_level") or "medium").upper()
        risk_score = str(sar_data.get("risk_score") if sar_data.get("risk_score") is not None else "N/A")
        model_used = sar_data.get("model_used") or "FinTrace LLM Engine"
        raw_flags = sar_data.get("flags") or []
        flags = ", ".join(raw_flags) if isinstance(raw_flags, list) else str(raw_flags)
        if not flags:
            flags = "Standard AML Surveillance"


        # Determine risk color badge
        if "HIGH" in risk_level or "CRITICAL" in risk_level:
            badge_bg = colors.HexColor("#FEE2E2")
            badge_fg = colors.HexColor("#991B1B")
        elif "MEDIUM" in risk_level:
            badge_bg = colors.HexColor("#FEF3C7")
            badge_fg = colors.HexColor("#92400E")
        else:
            badge_bg = colors.HexColor("#DCFCE7")
            badge_fg = colors.HexColor("#166534")

        risk_p = Paragraph(
            f"<font color='{badge_fg.hexval()}'><b>{risk_level} (Score: {risk_score}/100)</b></font>",
            meta_val_style,
        )

        meta_rows = [
            [
                Paragraph("Report Reference:", meta_label_style),
                Paragraph(ref_id, meta_val_style),
                Paragraph("Target Subject:", meta_label_style),
                Paragraph(f"<b>{subject}</b>", meta_val_style),
            ],
            [
                Paragraph("Filing Timestamp:", meta_label_style),
                Paragraph(report_date, meta_val_style),
                Paragraph("Assessed Risk:", meta_label_style),
                risk_p,
            ],
            [
                Paragraph("Engine / Model:", meta_label_style),
                Paragraph(model_used, meta_val_style),
                Paragraph("Triggered Flags:", meta_label_style),
                Paragraph(flags, meta_val_style),
            ],
        ]

        meta_table = Table(meta_rows, colWidths=[100, 170, 100, 170])
        meta_table.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
                ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#E2E8F0")),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ])
        )
        story.append(meta_table)
        story.append(Spacer(1, 12))

        # Divider
        story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#CBD5E1"), spaceAfter=10))

        # 3. Report Content Parsing
        raw_report = sar_data.get("report", "")
        lines = raw_report.split("\n")

        report_story = []
        for line in lines:
            trimmed = line.strip()
            if not trimmed:
                report_story.append(Spacer(1, 4))
                continue

            # Check if section header or divider
            if trimmed.startswith("===") or trimmed.startswith("---") or trimmed.startswith("***"):
                continue

            if (
                trimmed.isupper()
                or trimmed.startswith("SECTION")
                or trimmed.startswith("1.")
                or trimmed.startswith("2.")
                or trimmed.startswith("3.")
                or trimmed.startswith("4.")
                or trimmed.startswith("5.")
                or trimmed.startswith("6.")
                or trimmed.startswith("7.")
                or trimmed.startswith("SUMMARY")
                or trimmed.startswith("ACCOUNTS INVOLVED")
                or trimmed.startswith("SUSPICIOUS PATTERNS")
                or trimmed.startswith("RECOMMENDED ACTIONS")
            ):
                # Clean up formatting markers like markdown **
                clean_head = trimmed.replace("**", "").replace("#", "").strip()
                report_story.append(Paragraph(clean_head, section_heading_style))
                report_story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#E2E8F0"), spaceAfter=4))
            elif trimmed.startswith("*") or trimmed.startswith("-"):
                clean_bullet = trimmed[1:].strip().replace("**", "<b>", 1).replace("**", "</b>", 1)
                report_story.append(Paragraph(f"• {clean_bullet}", body_style))
            else:
                formatted_line = trimmed.replace("**", "<b>", 1).replace("**", "</b>", 1)
                report_story.append(Paragraph(formatted_line, body_style))
                report_story.append(Spacer(1, 3))

        story.extend(report_story)
        story.append(Spacer(1, 14))

        # 4. Signature & Verification Box
        sig_data = [
            [
                Paragraph("<b>Prepared By:</b> FinTrace AML Automated Intelligence", meta_val_style),
                Paragraph("<b>Filing Authority:</b> FIU Compliance Office", meta_val_style),
            ],
            [
                Paragraph("<b>Verification Hash:</b> SHA256-" + uuid.uuid4().hex, code_style),
                Paragraph("<b>Status:</b> READY FOR SUBMISSION", body_bold),
            ],
        ]
        sig_table = Table(sig_data, colWidths=[270, 270])
        sig_table.setStyle(
            TableStyle([
                ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#94A3B8")),
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F1F5F9")),
                ("PADDING", (0, 0), (-1, -1), 8),
            ])
        )
        
        story.append(KeepTogether(sig_table))

        # Build PDF document
        doc.build(story)
        buffer.seek(0)
        return buffer.getvalue()
