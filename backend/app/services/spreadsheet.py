"""Deterministic CSV/XLSX parsing with flexible column name matching."""

from __future__ import annotations

import io
import re
from typing import Any

import pandas as pd

# Map canonical field names to common spreadsheet header variants.
COLUMN_ALIASES: dict[str, list[str]] = {
    "invoice_id": [
        "invoice_id",
        "invoice id",
        "invoice no",
        "invoice number",
        "inv",
        "inv no",
        "bill no",
        "bill number",
        "reference",
        "ref",
    ],
    "customer_name": [
        "customer_name",
        "customer name",
        "customer",
        "client",
        "party",
        "buyer",
        "account name",
    ],
    "invoice_date": [
        "invoice_date",
        "invoice date",
        "inv date",
        "bill date",
        "date",
        "issue date",
    ],
    "due_date": [
        "due_date",
        "due date",
        "payment due",
        "due",
        "pay by",
    ],
    "invoice_amount": [
        "invoice_amount",
        "invoice amount",
        "amount",
        "total",
        "total amount",
        "bill amount",
        "value",
        "invoice value",
    ],
    "amount_paid": [
        "amount_paid",
        "amount paid",
        "paid",
        "received",
        "payment received",
        "advance",
    ],
    "status": [
        "status",
        "payment_status",
        "payment status",
        "paid status",
    ],
    "customer_phone": [
        "customer_phone",
        "phone",
        "mobile",
        "contact",
        "whatsapp",
    ],
}


def _normalize_header(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", str(value).strip().lower()).strip()


def _build_column_map(columns: list[str]) -> dict[str, str]:
    """Match spreadsheet headers to canonical invoice fields."""
    normalized = {_normalize_header(col): col for col in columns}
    mapping: dict[str, str] = {}

    for canonical, aliases in COLUMN_ALIASES.items():
        for alias in aliases:
            key = _normalize_header(alias)
            if key in normalized:
                mapping[canonical] = normalized[key]
                break

    return mapping


def _cell_str(row: pd.Series, column: str | None) -> str:
    if not column or column not in row.index:
        return ""
    value = row[column]
    if pd.isna(value):
        return ""
    return str(value).strip()


def _cell_float(row: pd.Series, column: str | None, default: float = 0.0) -> float:
    raw = _cell_str(row, column)
    if not raw:
        return default
    cleaned = re.sub(r"[^0-9.\-]", "", raw)
    if not cleaned:
        return default
    try:
        return float(cleaned)
    except ValueError:
        return default


def _infer_payment_status(invoice_amount: float, amount_paid: float, status: str) -> str:
    if status:
        normalized = status.strip().lower()
        if normalized in {"paid", "unpaid", "partially paid", "partial"}:
            if normalized == "partial":
                return "Partially Paid"
            return status.strip().title() if normalized != "partially paid" else "Partially Paid"

    if amount_paid >= invoice_amount > 0:
        return "Paid"
    if amount_paid > 0:
        return "Partially Paid"
    return "Unpaid"


def parse_spreadsheet(content: bytes, file_name: str) -> list[dict[str, Any]]:
    """Parse CSV or Excel bytes into normalized invoice row dictionaries."""
    suffix = file_name.rsplit(".", 1)[-1].lower() if "." in file_name else ""

    if suffix == "csv":
        df = pd.read_csv(io.BytesIO(content))
    elif suffix in {"xlsx", "xls"}:
        df = pd.read_excel(io.BytesIO(content))
    else:
        raise ValueError("Unsupported spreadsheet format. Use CSV or XLSX.")

    if df.empty:
        raise ValueError("The uploaded spreadsheet has no data rows.")

    column_map = _build_column_map(list(df.columns))
    required = ["invoice_id", "customer_name", "due_date", "invoice_amount"]
    missing = [field for field in required if field not in column_map]
    if missing:
        raise ValueError(
            "Could not find required columns: "
            + ", ".join(missing)
            + ". Expected headers like invoice_id, customer_name, due_date, invoice_amount."
        )

    rows: list[dict[str, Any]] = []
    for idx, row in df.iterrows():
        invoice_amount = _cell_float(row, column_map.get("invoice_amount"))
        amount_paid = _cell_float(row, column_map.get("amount_paid"))
        status = _infer_payment_status(
            invoice_amount,
            amount_paid,
            _cell_str(row, column_map.get("status")),
        )

        inv_date_raw = _cell_str(row, column_map.get("invoice_date"))
        due_date_raw = _cell_str(row, column_map.get("due_date"))
        invoice_date = inv_date_raw.split(" ")[0] if inv_date_raw else due_date_raw.split(" ")[0]

        invoice_id = _cell_str(row, column_map.get("invoice_id")) or f"ROW-{int(idx) + 1}"
        customer_name = _cell_str(row, column_map.get("customer_name")) or "Unknown Customer"

        rows.append(
            {
                "invoice_id": invoice_id,
                "customer_name": customer_name,
                "invoice_date": invoice_date,
                "due_date": due_date_raw.split(" ")[0] if due_date_raw else invoice_date,
                "invoice_amount": invoice_amount,
                "amount_paid": amount_paid,
                "status": status,
                "customer_phone": _cell_str(row, column_map.get("customer_phone")) or None,
            }
        )

    return rows
