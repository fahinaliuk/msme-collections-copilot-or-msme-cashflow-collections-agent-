"""FastAPI application — MSME Cashflow & Collections Agent.

Exposes a single endpoint that accepts an invoice CSV, identifies the most
critical overdue customers, and returns ranked summaries with AI-generated
WhatsApp reminder messages.
"""
from fastapi.templating import Jinja2Templates
from fastapi import Request
from datetime import date

from fastapi import FastAPI, File, HTTPException, UploadFile

from app.llm import generate_whatsapp_messages
from app.logic import (
    aggregate_by_customer,
    build_customer_summaries,
    compute_overdue_invoices,
    load_invoices_from_file,
    rank_customers,
)
from app.schemas import AnalysisResponse

app = FastAPI(
    title="MSME Cashflow & Collections Agent",
    description=(
        "Upload an invoice CSV to identify top overdue customers and "
        "receive AI-drafted WhatsApp collection reminders."
    ),
    version="0.1.0",
)

templates = Jinja2Templates(directory="app/templates")

@app.get("/", include_in_schema=False)
async def home(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.post(
    "/analyze-invoices",
    response_model=AnalysisResponse,
    summary="Analyze overdue invoices and generate collection messages",
)
async def analyze_invoices(file: UploadFile = File(...)):
    """Accept a CSV of invoices and return a prioritised collection plan.

    The response includes:
    - Overall overdue totals.
    - Top customers ranked by a priority score.
    - Ready-to-send WhatsApp reminder messages for each customer.
    """
    # ------------------------------------------------------------------
    # 1. Validate and load the uploaded CSV
    # ------------------------------------------------------------------
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=400,
            detail="Please upload a CSV file (*.csv).",
        )

    try:
        df = load_invoices_from_file(file.file)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Could not parse the CSV file: {exc}",
        )

    # ------------------------------------------------------------------
    # 2. Compute overdue invoices
    # ------------------------------------------------------------------
    today_date = date.today()
    df_overdue = compute_overdue_invoices(df, today_date)

    if df_overdue.empty:
        return AnalysisResponse(
            total_overdue_amount=0.0,
            total_overdue_customers=0,
            top_customers=[],
        )

    # ------------------------------------------------------------------
    # 3. Aggregate & rank
    # ------------------------------------------------------------------
    df_customers = aggregate_by_customer(df_overdue)
    df_top = rank_customers(df_customers, top_n=5)

    # ------------------------------------------------------------------
    # 4. Build Pydantic summaries
    # ------------------------------------------------------------------
    summaries = build_customer_summaries(df_overdue, df_top)

    # ------------------------------------------------------------------
    # 5. Generate WhatsApp messages for each top customer
    # ------------------------------------------------------------------
    for summary in summaries:
        messages = generate_whatsapp_messages(summary)
        summary.whatsapp_messages = messages

    # ------------------------------------------------------------------
    # 6. Construct response
    # ------------------------------------------------------------------
    total_overdue = sum(s.total_overdue_amount for s in summaries)
    total_customers = len(summaries)

    return AnalysisResponse(
        total_overdue_amount=total_overdue,
        total_overdue_customers=total_customers,
        top_customers=summaries,
    )
