"""Deterministic extraction confidence scoring.

Computes a 0.0–1.0 confidence score for each extracted invoice row based on
data quality signals. The score is purely rule-based — no AI required.
"""

from __future__ import annotations

import re
from typing import List, Set, Tuple

# Auto-generated invoice ID prefixes that signal weak extraction
AUTO_ID_PREFIXES = ("TEXT-", "ROW-", "EXTRACTED-", "INV-")

# Confidence threshold for marking an invoice as needing manual review
NEEDS_REVIEW_THRESHOLD = 0.75


def compute_confidence(
    row: dict,
    extraction_method: str,
    existing_ids: Set[str],
) -> Tuple[float, List[str]]:
    """Score a single extracted invoice row.

    Args:
        row: Extracted row dict with invoice_id, customer_name, etc.
        extraction_method: "deterministic", "heuristic", or "llm".
        existing_ids: Set of invoice IDs already in the user's database.

    Returns:
        (confidence_score, warnings) — score clamped to [0.0, 1.0].
    """
    score = 1.0
    warnings: List[str] = []

    invoice_id = str(row.get("invoice_id") or "").strip()
    customer_name = str(row.get("customer_name") or "").strip()
    invoice_amount = _safe_float(row.get("invoice_amount"))
    amount_paid = _safe_float(row.get("amount_paid"))
    invoice_date = str(row.get("invoice_date") or "").strip()
    due_date = str(row.get("due_date") or "").strip()

    # --- Missing invoice ID ---
    is_auto_id = any(invoice_id.startswith(p) for p in AUTO_ID_PREFIXES)
    if not invoice_id or is_auto_id:
        score -= 0.15
        warnings.append("Missing or auto-generated invoice ID.")

    # --- Missing customer name ---
    if not customer_name or customer_name.lower() == "unknown customer":
        score -= 0.15
        warnings.append("Missing or unknown customer name.")

    # --- Missing / invalid amount ---
    if invoice_amount is None or invoice_amount == 0:
        score -= 0.20
        warnings.append("Invoice amount is missing or zero.")
    elif invoice_amount < 0:
        score -= 0.10
        warnings.append("Invoice amount is negative.")

    # --- Missing / invalid due date ---
    if not due_date or not _is_valid_date(due_date):
        score -= 0.20
        warnings.append("Due date is missing or invalid.")

    # --- Missing invoice date ---
    if not invoice_date or not _is_valid_date(invoice_date):
        score -= 0.05
        warnings.append("Invoice date is missing or invalid.")

    # --- Duplicate invoice ID ---
    if invoice_id and invoice_id in existing_ids:
        score -= 0.10
        warnings.append(f"Duplicate invoice ID '{invoice_id}' already exists in database.")

    # --- Due date before invoice date ---
    if (
        due_date
        and invoice_date
        and _is_valid_date(due_date)
        and _is_valid_date(invoice_date)
        and due_date < invoice_date
    ):
        score -= 0.05
        warnings.append("Due date is before invoice date.")

    # --- Amount paid exceeds invoice amount ---
    if (
        invoice_amount is not None
        and amount_paid is not None
        and invoice_amount > 0
        and amount_paid > invoice_amount
    ):
        score -= 0.05
        warnings.append("Amount paid exceeds invoice amount.")

    # --- Non-structured extraction method ---
    if extraction_method in ("heuristic", "llm"):
        score -= 0.05
        warnings.append(f"Extracted via {extraction_method} — verify accuracy.")

    # --- Compound weakness: auto-ID + unknown customer ---
    if is_auto_id and (not customer_name or customer_name.lower() == "unknown customer"):
        score -= 0.10
        warnings.append("Weak row: both ID and customer name are auto-generated.")

    # Clamp to valid range
    score = max(0.0, min(1.0, round(score, 2)))

    return score, warnings


def needs_review(score: float) -> bool:
    """Whether a confidence score falls below the review threshold."""
    return score < NEEDS_REVIEW_THRESHOLD


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _safe_float(value) -> float | None:
    """Safely convert a value to float."""
    if value is None:
        return None
    try:
        return float(value)
    except (ValueError, TypeError):
        return None


def _is_valid_date(value: str) -> bool:
    """Check if a string looks like a valid ISO date (YYYY-MM-DD)."""
    return bool(re.match(r"^\d{4}-\d{1,2}-\d{1,2}", str(value).strip()))
