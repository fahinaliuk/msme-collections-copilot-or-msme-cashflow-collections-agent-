"""Invoice upload, extraction, validation preview, and confirmation endpoints."""

from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from backend.app.config import settings
from backend.app.database import get_db
from backend.app.models.invoice import Invoice
from backend.app.models.upload import Upload
from backend.app.models.user import User
from backend.app.schemas import ConfirmInvoicesRequest, ExtractedInvoice, ExtractionPreviewResponse, ReviewQueueInvoice
from backend.app.services.communication import add_timeline_entry
from backend.app.services.confidence import compute_confidence, needs_review as check_needs_review
from backend.app.services.customers import refresh_customer_profiles
from backend.app.services.extraction import extract_invoice_rows_from_text
from backend.app.services.spreadsheet import parse_spreadsheet
from backend.app.utils.auth import get_current_user

router = APIRouter(prefix="/api/invoices", tags=["Invoices"])

# MVP upload types only (no OCR / PDF)
ALLOWED_EXTENSIONS = {".csv", ".xlsx", ".xls", ".txt"}
ALLOWED_MIME_TYPES = {
    "text/csv",
    "text/plain",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/csv",
}


def validate_extracted_invoice(inv: dict, existing_ids: set) -> List[str]:
    """Server-side validation warnings for a single extracted row."""
    warnings: list[str] = []

    if not str(inv.get("invoice_id", "")).strip():
        warnings.append("Missing invoice ID.")
    if not str(inv.get("customer_name", "")).strip():
        warnings.append("Missing customer name.")

    invoice_id = str(inv.get("invoice_id", "")).strip()
    if invoice_id and invoice_id in existing_ids:
        warnings.append(f"Duplicate invoice: ID '{invoice_id}' already exists in your database.")

    invoice_date = inv.get("invoice_date")
    due_date = inv.get("due_date")
    if invoice_date and due_date:
        try:
            inv_d = date.fromisoformat(str(invoice_date)[:10])
            due_d = date.fromisoformat(str(due_date)[:10])
            if due_d < inv_d:
                warnings.append("Due date is before the invoice date.")
        except ValueError:
            warnings.append("Invalid date format. Expected YYYY-MM-DD.")

    amount = float(inv.get("invoice_amount") or 0.0)
    paid = float(inv.get("amount_paid") or 0.0)
    if amount < 0:
        warnings.append("Invoice amount cannot be negative.")
    if paid < 0:
        warnings.append("Amount paid cannot be negative.")
    if paid > amount:
        warnings.append("Amount paid is greater than the total invoice amount.")

    return warnings


def _rows_to_schemas(rows: list[dict], existing_ids: set, extraction_method: str = "deterministic") -> list[ExtractedInvoice]:
    schemas: list[ExtractedInvoice] = []
    for row in rows:
        # Compute confidence score deterministically
        confidence, confidence_warnings = compute_confidence(row, extraction_method, existing_ids)
        # Also run the existing validation for backward-compatible warnings
        row_warnings = validate_extracted_invoice(row, existing_ids)
        # Merge warnings (deduplicate)
        all_warnings = list(dict.fromkeys(confidence_warnings + row_warnings))

        parsed_inv_date = date.today()
        parsed_due_date = date.today()
        try:
            parsed_inv_date = date.fromisoformat(str(row.get("invoice_date"))[:10])
        except ValueError:
            pass
        try:
            parsed_due_date = date.fromisoformat(str(row.get("due_date"))[:10])
        except ValueError:
            pass

        amt = float(row.get("invoice_amount") or 0.0)
        paid = float(row.get("amount_paid") or 0.0)
        outstanding = max(amt - paid, 0.0)
        days_overdue = 0
        if outstanding > 0 and parsed_due_date < date.today():
            days_overdue = (date.today() - parsed_due_date).days

        schemas.append(
            ExtractedInvoice(
                invoice_id=str(row.get("invoice_id") or "").strip(),
                customer_name=str(row.get("customer_name") or "").strip(),
                invoice_date=parsed_inv_date,
                due_date=parsed_due_date,
                invoice_amount=amt,
                amount_paid=paid,
                status=str(row.get("status") or "Unpaid").strip(),
                customer_phone=row.get("customer_phone"),
                amount_outstanding=outstanding,
                days_overdue=days_overdue,
                warnings=all_warnings,
                extraction_confidence=confidence,
                needs_review=check_needs_review(confidence),
            )
        )
    return schemas


@router.post("/upload", response_model=ExtractionPreviewResponse)
async def upload_invoice(
    file: Optional[UploadFile] = File(None),
    pasted_text: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Ingest invoices from CSV/XLSX upload or pasted text (preview only)."""
    if not file and not pasted_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either a file upload or pasted invoice text is required.",
        )

    existing_q = await db.execute(
        select(Invoice.invoice_id).where(Invoice.user_id == current_user.id)
    )
    existing_ids = set(existing_q.scalars().all())

    file_name = "pasted_text.txt"
    file_type = "pasted_text"
    file_size = len(pasted_text.encode("utf-8")) if pasted_text else 0
    classification = "unstructured"
    extraction_method = "heuristic"
    global_warnings: list[str] = []
    extracted_rows: list[dict] = []

    if file:
        file_name = file.filename or "uploaded_file"
        content = await file.read()
        file_size = len(content)

        if file_size > settings.MAX_UPLOAD_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File exceeds the maximum upload limit of {settings.MAX_UPLOAD_BYTES // (1024 * 1024)}MB.",
            )

        suffix = ("." + file_name.rsplit(".", 1)[-1].lower()) if "." in file_name else ""
        if suffix not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unsupported file type. Upload CSV, XLSX, or TXT only.",
            )

        if file.content_type and file.content_type not in ALLOWED_MIME_TYPES:
            # Some browsers send generic types; only reject clearly wrong MIME.
            if not file.content_type.startswith("text/") and "spreadsheet" not in file.content_type:
                global_warnings.append(f"Unexpected MIME type '{file.content_type}' — validated by extension.")

        file_type = suffix.lstrip(".")
        if suffix in {".csv", ".xlsx", ".xls"}:
            classification = "structured"
            extraction_method = "deterministic"
            try:
                extracted_rows = parse_spreadsheet(content, file_name)
            except Exception as exc:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Could not parse spreadsheet: {exc}",
                ) from exc
        else:
            # Plain text file treated like pasted content
            try:
                raw_text = content.decode("utf-8-sig")
            except UnicodeDecodeError:
                raw_text = content.decode("latin-1", errors="ignore")
            extracted_rows, extraction_method, global_warnings = extract_invoice_rows_from_text(raw_text)
    else:
        extracted_rows, extraction_method, global_warnings = extract_invoice_rows_from_text(pasted_text or "")

    if not extracted_rows:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No invoice rows could be extracted. Check your file format or pasted text.",
        )

    return ExtractionPreviewResponse(
        file_name=file_name,
        file_type=file_type,
        file_size_bytes=file_size,
        classification=classification,
        extraction_method=extraction_method,
        invoices=_rows_to_schemas(extracted_rows, existing_ids, extraction_method),
        warnings=global_warnings,
    )


@router.post("/confirm", status_code=status.HTTP_201_CREATED)
async def confirm_invoices(
    req: ConfirmInvoicesRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Save user-confirmed preview rows to the database."""
    if not req.invoices:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invoice preview table is empty. Nothing to import.",
        )

    today = date.today()
    total_overdue_amt = 0.0
    overdue_customers: set[str] = set()

    for inv in req.invoices:
        outstanding = max(inv.invoice_amount - inv.amount_paid, 0.0)
        if outstanding > 0 and inv.due_date < today:
            total_overdue_amt += outstanding
            overdue_customers.add(inv.customer_name)

    upload = Upload(
        user_id=current_user.id,
        file_name=req.file_name,
        file_type=req.file_type,
        file_size_bytes=req.file_size_bytes,
        classification=req.classification,
        extraction_method=req.extraction_method,
        invoice_count=len(req.invoices),
        total_overdue_amount=total_overdue_amt,
        total_overdue_customers=len(overdue_customers),
    )
    db.add(upload)
    await db.flush()

    for inv in req.invoices:
        outstanding = max(inv.invoice_amount - inv.amount_paid, 0.0)
        days_overdue = 0
        if outstanding > 0 and inv.due_date < today:
            days_overdue = (today - inv.due_date).days

        dup_q = await db.execute(
            select(Invoice.id).where(
                Invoice.user_id == current_user.id,
                Invoice.invoice_id == inv.invoice_id,
            )
        )
        confirm_warnings: list[str] = []
        if dup_q.scalars().first() is not None:
            confirm_warnings.append(f"Duplicate invoice ID '{inv.invoice_id}' already exists.")
        if inv.warnings:
            confirm_warnings.extend(inv.warnings)

        conf_score = getattr(inv, 'extraction_confidence', 1.0)

        db.add(
            Invoice(
                upload_id=upload.id,
                user_id=current_user.id,
                invoice_id=inv.invoice_id,
                customer_name=inv.customer_name,
                invoice_date=inv.invoice_date,
                due_date=inv.due_date,
                invoice_amount=inv.invoice_amount,
                amount_paid=inv.amount_paid,
                outstanding_amount=outstanding,
                status=inv.status,
                days_overdue=days_overdue,
                customer_phone=inv.customer_phone,
                confidence_score=conf_score,
                validation_warnings=", ".join(confirm_warnings) if confirm_warnings else None,
            )
        )

        # Log timeline event for invoices needing review
        if check_needs_review(conf_score):
            await add_timeline_entry(
                db,
                user_id=current_user.id,
                customer_name=inv.customer_name,
                event_type="invoice_flagged_for_review",
                description=f"Invoice {inv.invoice_id} flagged for review (confidence: {conf_score:.0%}).",
            )

    await db.flush()
    await refresh_customer_profiles(db, current_user.id)

    return {
        "status": "success",
        "message": f"Successfully imported {len(req.invoices)} invoices.",
        "upload_id": str(upload.id),
    }


@router.get("", response_model=List[dict])
async def get_all_invoices(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all invoices for the authenticated user."""
    result = await db.execute(
        select(Invoice)
        .where(Invoice.user_id == current_user.id)
        .order_by(Invoice.due_date.asc())
    )
    invoices = result.scalars().all()
    return [
        {
            "id": str(i.id),
            "invoice_id": i.invoice_id,
            "customer_name": i.customer_name,
            "invoice_date": i.invoice_date.isoformat(),
            "due_date": i.due_date.isoformat(),
            "invoice_amount": i.invoice_amount,
            "amount_paid": i.amount_paid,
            "outstanding_amount": i.outstanding_amount,
            "status": i.status,
            "days_overdue": i.days_overdue,
            "customer_phone": i.customer_phone,
            "confidence_score": i.confidence_score,
            "validation_warnings": i.validation_warnings,
            "created_at": i.created_at.isoformat(),
        }
        for i in invoices
    ]


@router.get("/review-queue", response_model=List[ReviewQueueInvoice])
async def get_review_queue(
    filter_type: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Fetch invoices for the review queue with optional filters.

    filter_type options:
    - needs_review: confidence_score < 0.75
    - high_confidence: confidence_score >= 0.95
    - duplicate: validation_warnings contains 'Duplicate'
    - invalid_amount: validation_warnings contains 'amount'
    - (default/None): all invoices with confidence_score < 0.95, sorted by confidence asc
    """
    query = select(Invoice).where(Invoice.user_id == current_user.id)

    if filter_type == "needs_review":
        query = query.where(Invoice.confidence_score < 0.75)
    elif filter_type == "high_confidence":
        query = query.where(Invoice.confidence_score >= 0.95)
    elif filter_type == "duplicate":
        query = query.where(Invoice.validation_warnings.ilike("%duplicate%"))
    elif filter_type == "invalid_amount":
        query = query.where(Invoice.validation_warnings.ilike("%amount%"))
    else:
        query = query.where(Invoice.confidence_score < 0.95)

    query = query.order_by(Invoice.confidence_score.asc())
    result = await db.execute(query)
    invoices = result.scalars().all()

    return [
        ReviewQueueInvoice(
            id=str(i.id),
            invoice_id=i.invoice_id,
            customer_name=i.customer_name,
            invoice_date=i.invoice_date,
            due_date=i.due_date,
            invoice_amount=i.invoice_amount,
            amount_paid=i.amount_paid,
            outstanding_amount=i.outstanding_amount,
            status=i.status,
            days_overdue=i.days_overdue,
            customer_phone=i.customer_phone,
            confidence_score=i.confidence_score,
            validation_warnings=i.validation_warnings,
            created_at=i.created_at,
        )
        for i in invoices
    ]


@router.delete("/clear")
async def clear_all_data(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Clear all uploaded invoices, disputes, promises, and uploads for the user to reset the demo."""
    from backend.app.models.invoice import Invoice
    from backend.app.models.dispute import Dispute
    from backend.app.models.promise_to_pay import PromiseToPay
    from backend.app.models.upload import Upload
    from backend.app.models.customer_profile import CustomerProfile
    from backend.app.models.communication_log import CommunicationLog
    
    from sqlalchemy import delete
    
    await db.execute(delete(Invoice).where(Invoice.user_id == current_user.id))
    await db.execute(delete(Dispute).where(Dispute.user_id == current_user.id))
    await db.execute(delete(PromiseToPay).where(PromiseToPay.user_id == current_user.id))
    await db.execute(delete(CommunicationLog).where(CommunicationLog.user_id == current_user.id))
    await db.execute(delete(CustomerProfile).where(CustomerProfile.user_id == current_user.id))
    await db.execute(delete(Upload).where(Upload.user_id == current_user.id))
    
    await db.commit()
    return {"status": "success", "message": "All user demo data has been cleared successfully."}
