"""Pure data logic for processing invoices and ranking overdue customers.

All functions operate on Pandas DataFrames and Pydantic models.
No dependency on FastAPI or the LLM layer.
"""

from datetime import date, timedelta
from typing import BinaryIO, Iterable, List, Mapping, Any

import pandas as pd

from app.schemas import CashflowDay, CustomerSummary, Invoice

# Columns the uploaded CSV must contain.
REQUIRED_COLUMNS = [
    "invoice_id",
    "customer_name",
    "invoice_date",
    "due_date",
    "invoice_amount",
    "amount_paid",
    "status",
]


def normalize_invoice_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """Normalize invoice data and validate the required columns."""

    df = df.copy()
    df.columns = [c.strip().lower() for c in df.columns]

    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        raise ValueError(
            f"Missing required columns: {', '.join(missing)}. "
            f"Expected columns: {', '.join(REQUIRED_COLUMNS)}"
        )

    if "customer_phone" not in df.columns:
        df["customer_phone"] = None

    try:
        df["invoice_date"] = pd.to_datetime(
            df["invoice_date"], format="%Y-%m-%d"
        )
        df["due_date"] = pd.to_datetime(df["due_date"], format="%Y-%m-%d")
        df["invoice_amount"] = pd.to_numeric(df["invoice_amount"])
        df["amount_paid"] = pd.to_numeric(df["amount_paid"])
    except Exception as exc:
        raise ValueError(
            "Could not parse invoice_date, due_date, invoice_amount, or "
            f"amount_paid. Dates must be YYYY-MM-DD. Details: {exc}"
        )

    return df


def load_invoices_from_file(file: BinaryIO) -> pd.DataFrame:
    """Read an uploaded CSV into a DataFrame and validate required columns.

    Parameters
    ----------
    file : BinaryIO
        A file-like object containing CSV data (e.g. from a FastAPI UploadFile).

    Returns
    -------
    pd.DataFrame
        The raw invoice data with date columns converted to datetime.

    Raises
    ------
    ValueError
        If any required columns are missing from the CSV.
    """
    return normalize_invoice_dataframe(pd.read_csv(file))


def build_invoices_dataframe(records: Iterable[Mapping[str, Any]]) -> pd.DataFrame:
    """Build a validated invoice DataFrame from extracted invoice records."""

    rows = list(records)
    if not rows:
        raise ValueError("No invoice rows could be extracted.")

    normalized_rows = []
    for index, row in enumerate(rows, start=1):
        invoice_amount = float(row.get("invoice_amount") or 0)
        amount_paid = float(row.get("amount_paid") or 0)
        status = str(row.get("status") or "").strip()
        if not status:
            if amount_paid >= invoice_amount and invoice_amount > 0:
                status = "Paid"
            elif amount_paid > 0:
                status = "Partially Paid"
            else:
                status = "Unpaid"

        normalized_rows.append(
            {
                "invoice_id": str(row.get("invoice_id") or f"EXTRACTED-{index}"),
                "customer_name": str(row.get("customer_name") or "Unknown Customer"),
                "invoice_date": row.get("invoice_date"),
                "due_date": row.get("due_date"),
                "invoice_amount": invoice_amount,
                "amount_paid": amount_paid,
                "status": status,
                "customer_phone": row.get("customer_phone") or None,
            }
        )

    return normalize_invoice_dataframe(pd.DataFrame(normalized_rows))


def analyze_overdues_from_dataframe(
    df: pd.DataFrame,
    today_date: date,
    top_n: int = 5,
) -> List[CustomerSummary]:
    """Run the overdue analysis pipeline and return ranked summaries."""

    df_overdue = compute_overdue_invoices(df, today_date)
    if df_overdue.empty:
        return []

    df_customers = aggregate_by_customer(df_overdue)
    df_top = rank_customers(df_customers, top_n=top_n)
    return build_customer_summaries(df_overdue, df_top)


def compute_overdue_invoices(df: pd.DataFrame, today_date: date) -> pd.DataFrame:
    """Filter the DataFrame to overdue invoices and add computed columns.

    An invoice is overdue when:
    - ``amount_outstanding`` (invoice_amount − amount_paid) > 0 **and**
    - ``due_date`` < ``today_date``.

    Parameters
    ----------
    df : pd.DataFrame
        Raw invoice data (output of :func:`load_invoices_from_file`).
    today_date : date
        The reference date for computing overdue status.

    Returns
    -------
    pd.DataFrame
        Subset of overdue invoices with ``amount_outstanding`` and
        ``days_overdue`` columns added.
    """
    df = df.copy()
    df["amount_outstanding"] = df["invoice_amount"] - df["amount_paid"]

    today_dt = pd.Timestamp(today_date)
    overdue_mask = (df["amount_outstanding"] > 0) & (df["due_date"] < today_dt)
    df_overdue = df.loc[overdue_mask].copy()

    df_overdue["days_overdue"] = (today_dt - df_overdue["due_date"]).dt.days

    return df_overdue


def aggregate_by_customer(df_overdue: pd.DataFrame) -> pd.DataFrame:
    """Group overdue invoices by customer and compute summary statistics.

    Parameters
    ----------
    df_overdue : pd.DataFrame
        Overdue invoice data (output of :func:`compute_overdue_invoices`).

    Returns
    -------
    pd.DataFrame
        One row per customer with columns:
        ``customer_name``, ``total_overdue_amount``, ``max_days_overdue``,
        ``number_of_invoices``, ``customer_phone``.
    """
    agg_spec = {
        "total_overdue_amount": ("amount_outstanding", "sum"),
        "max_days_overdue": ("days_overdue", "max"),
        "number_of_invoices": ("invoice_id", "count"),
    }

    if "customer_phone" in df_overdue.columns:
        agg_spec["customer_phone"] = ("customer_phone", "first")

    agg = df_overdue.groupby("customer_name", as_index=False).agg(**agg_spec)

    # If customer_phone column wasn't present, add it as None.
    if "customer_phone" not in agg.columns:
        agg["customer_phone"] = None

    return agg


def rank_customers(df_customer: pd.DataFrame, top_n: int = 5) -> pd.DataFrame:
    """Score and rank customers by overdue severity, returning the top N.

    ``priority_score = total_overdue_amount × (1 + max_days_overdue / 30)``

    Parameters
    ----------
    df_customer : pd.DataFrame
        Aggregated customer data (output of :func:`aggregate_by_customer`).
    top_n : int, optional
        Number of top customers to return (default 5).

    Returns
    -------
    pd.DataFrame
        The top customers sorted by ``priority_score`` descending.
    """
    df = df_customer.copy()
    df["priority_score"] = df["total_overdue_amount"] * (
        1 + df["max_days_overdue"] / 30
    )
    df = df.sort_values("priority_score", ascending=False).head(top_n)
    return df


def build_customer_summaries(
    df_overdue: pd.DataFrame, df_top_customers: pd.DataFrame
) -> List[CustomerSummary]:
    """Convert ranked customer rows into Pydantic :class:`CustomerSummary` objects.

    Each ``CustomerSummary`` contains a nested list of its overdue
    :class:`Invoice` objects. ``whatsapp_messages`` is left empty here —
    it will be populated later by the LLM layer.

    Parameters
    ----------
    df_overdue : pd.DataFrame
        Full overdue invoice data.
    df_top_customers : pd.DataFrame
        Ranked / scored customer data.

    Returns
    -------
    list[CustomerSummary]
        One entry per top customer, ordered by priority.
    """
    summaries: List[CustomerSummary] = []

    for _, cust_row in df_top_customers.iterrows():
        name = cust_row["customer_name"]
        cust_invoices_df = df_overdue[df_overdue["customer_name"] == name]

        invoices: List[Invoice] = []
        for _, inv_row in cust_invoices_df.iterrows():
            invoices.append(
                Invoice(
                    invoice_id=str(inv_row["invoice_id"]),
                    customer_name=str(inv_row["customer_name"]),
                    invoice_date=inv_row["invoice_date"].date(),
                    due_date=inv_row["due_date"].date(),
                    invoice_amount=float(inv_row["invoice_amount"]),
                    amount_paid=float(inv_row["amount_paid"]),
                    status=str(inv_row["status"]),
                    customer_phone=(
                        str(inv_row["customer_phone"])
                        if pd.notna(inv_row.get("customer_phone"))
                        else None
                    ),
                    amount_outstanding=float(inv_row["amount_outstanding"]),
                    days_overdue=int(inv_row["days_overdue"]),
                )
            )

        summaries.append(
            CustomerSummary(
                customer_name=name,
                total_overdue_amount=float(cust_row["total_overdue_amount"]),
                max_days_overdue=int(cust_row["max_days_overdue"]),
                number_of_invoices=int(cust_row["number_of_invoices"]),
                priority_score=float(cust_row["priority_score"]),
                customer_phone=(
                    str(cust_row["customer_phone"])
                    if pd.notna(cust_row.get("customer_phone"))
                    else None
                ),
                invoices=invoices,
                whatsapp_messages=[],  # filled in later by llm.py
            )
        )

    return summaries


def build_cashflow_projection(
    df: pd.DataFrame,
    start_date: date,
    starting_cash: float,
    fixed_monthly_expenses: float,
    days: int = 14,
) -> tuple[List[CashflowDay], List[date]]:
    """Project daily cash balances from unpaid invoice due dates.

    For this first version, each unpaid or partially paid invoice is treated as
    an inflow on its due date. Fixed monthly expenses are spread evenly across
    30 days.
    """

    df = df.copy()
    df["amount_outstanding"] = df["invoice_amount"] - df["amount_paid"]
    status = df["status"].astype(str).str.strip().str.lower()
    open_invoice_mask = (df["amount_outstanding"] > 0) & ~status.isin(
        {"paid", "fully paid"}
    )
    open_invoices = df.loc[open_invoice_mask].copy()

    daily_outflow = fixed_monthly_expenses / 30
    balance = starting_cash
    low_cash_threshold = max(starting_cash * 0.25, 0.0)
    projection: List[CashflowDay] = []
    risk_flags: List[date] = []

    for day_offset in range(days):
        projection_date = start_date + timedelta(days=day_offset)
        projection_timestamp = pd.Timestamp(projection_date)
        due_today = open_invoices["due_date"] == projection_timestamp
        inflows = float(open_invoices.loc[due_today, "amount_outstanding"].sum())
        outflows = float(daily_outflow)
        balance = float(balance + inflows - outflows)

        projection.append(
            CashflowDay(
                date=projection_date,
                inflows=inflows,
                outflows=outflows,
                end_of_day_balance=balance,
            )
        )

        if balance < 0 or balance < low_cash_threshold:
            risk_flags.append(projection_date)

    return projection, risk_flags
