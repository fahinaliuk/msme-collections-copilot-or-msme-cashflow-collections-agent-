"""Pydantic schemas for request validation and response serialization in FastAPI."""

import uuid
from datetime import date, datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, EmailStr, Field


# ==========================================
# AUTHENTICATION SCHEMAS
# ==========================================

class UserSignup(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6, description="Password must be at least 6 characters.")
    full_name: str = Field(..., min_length=1)
    business_name: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: uuid.UUID
    email: EmailStr
    full_name: str
    business_name: Optional[str]
    is_autopilot_enabled: bool = False
    created_at: datetime

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserOut


# ==========================================
# PROMISE-TO-PAY SCHEMAS
# ==========================================

class PromiseToPayCreate(BaseModel):
    customer_name: str = Field(..., min_length=1)
    invoice_id: Optional[str] = None
    promised_amount: float = Field(..., gt=0)
    promised_date: date
    notes: Optional[str] = None


class PromiseToPayUpdate(BaseModel):
    status: str = Field(..., pattern=r"^(pending|fulfilled|broken|cancelled)$")
    notes: Optional[str] = None


class PromiseToPayOut(BaseModel):
    id: uuid.UUID
    customer_name: str
    invoice_id: Optional[str]
    promised_amount: float
    promised_date: date
    status: str
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ==========================================
# DISPUTE SCHEMAS
# ==========================================

class DisputeCreate(BaseModel):
    customer_name: str = Field(..., min_length=1)
    invoice_id: Optional[str] = None
    reason: str = Field(
        ...,
        pattern=r"^(pricing_issue|duplicate_invoice|goods_not_delivered|payment_already_done|wrong_customer_details|other)$",
    )
    description: Optional[str] = None
    disputed_amount: float = Field(default=0.0, ge=0)


class DisputeUpdate(BaseModel):
    status: str = Field(..., pattern=r"^(open|under_review|resolved|rejected)$")
    resolution_notes: Optional[str] = None


class DisputeOut(BaseModel):
    id: uuid.UUID
    customer_name: str
    invoice_id: Optional[str]
    reason: str
    description: Optional[str]
    disputed_amount: float
    status: str
    resolution_notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ==========================================
# COMMUNICATION TIMELINE SCHEMAS
# ==========================================

class CommunicationLogOut(BaseModel):
    id: uuid.UUID
    customer_name: str
    event_type: str
    description: Optional[str]
    metadata_json: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


# ==========================================
# INVOICE EXTRACTION & VALIDATION SCHEMAS
# ==========================================

class ExtractedInvoice(BaseModel):
    invoice_id: str
    customer_name: str
    invoice_date: date
    due_date: date
    invoice_amount: float
    amount_paid: float = 0.0
    status: str = "Unpaid"
    customer_phone: Optional[str] = None
    
    # Validation helpers
    amount_outstanding: Optional[float] = None
    days_overdue: Optional[int] = None
    warnings: List[str] = Field(default_factory=list)
    extraction_confidence: float = 1.0
    needs_review: bool = False


class ExtractionPreviewResponse(BaseModel):
    file_name: str
    file_type: str
    file_size_bytes: int
    classification: str  # structured | semi-structured | unstructured
    extraction_method: str  # deterministic | llm | heuristic
    invoices: List[ExtractedInvoice]
    warnings: List[str] = Field(default_factory=list)


class ConfirmInvoicesRequest(BaseModel):
    file_name: str
    file_type: str
    file_size_bytes: int
    classification: str
    extraction_method: str
    invoices: List[ExtractedInvoice]


# ==========================================
# DASHBOARD & METRICS SCHEMAS
# ==========================================

class KPICards(BaseModel):
    total_receivables: float
    overdue_invoices_amount: float
    overdue_invoices_count: int
    collected_amount: float
    overdue_percentage: float


class AgingBucket(BaseModel):
    bucket: str  # "0-30 days", "31-60 days", "61-90 days", "90+ days"
    amount: float
    count: int


class OverdueTrendPoint(BaseModel):
    date: date
    amount: float


class CollectionsSummaryPoint(BaseModel):
    month: str
    collected: float
    outstanding: float


class CustomerPriorityItem(BaseModel):
    customer_name: str
    customer_phone: Optional[str]
    total_outstanding: float
    max_overdue_days: int
    invoice_count: int
    priority_score: float
    risk_tier: str  # low | medium | high | critical
    open_disputes_count: int = 0
    broken_promises_count: int = 0


class HighRiskAccount(BaseModel):
    customer_name: str
    total_outstanding: float
    priority_score: float
    risk_tier: str


class DashboardSummaryResponse(BaseModel):
    kpis: KPICards
    aging_buckets: List[AgingBucket]
    overdue_trends: List[OverdueTrendPoint]
    collections_summary: List[CollectionsSummaryPoint]
    top_priorities: List[CustomerPriorityItem]
    high_risk_accounts: List[HighRiskAccount]
    recent_invoices: List[dict]
    broken_promises_count: int = 0
    open_disputes_count: int = 0
    needs_review_count: int = 0


class ReviewQueueInvoice(BaseModel):
    id: str
    invoice_id: str
    customer_name: str
    invoice_date: date
    due_date: date
    invoice_amount: float
    amount_paid: float
    outstanding_amount: float
    status: str
    days_overdue: int
    customer_phone: Optional[str] = None
    confidence_score: float
    validation_warnings: Optional[str] = None
    created_at: datetime


# ==========================================
# WORKLIST / NEXT-BEST-ACTION SCHEMAS
# ==========================================

class WorklistItemOut(BaseModel):
    customer_id: Optional[str] = None
    customer_name: str
    recommended_action: str  # one of ACTION_TYPES
    reason: str
    urgency_score: int  # 1-100
    affected_invoices: List[dict] = Field(default_factory=list)
    suggested_channel: str
    risk_tier: str = "low"
    total_outstanding: float = 0.0
    max_days_overdue: int = 0
    open_dispute: bool = False
    broken_promise: bool = False
    pending_promise: bool = False


class WorklistFilterParams(BaseModel):
    action_type: Optional[str] = None
    min_urgency: Optional[int] = None
    risk_tier: Optional[str] = None
    limit: int = 50


# ==========================================
# TIMELINE CALL / NOTE SCHEMAS
# ==========================================

class LogCallRequest(BaseModel):
    customer_name: str = Field(..., min_length=1)
    description: str = Field(..., min_length=1)
    phone_number: Optional[str] = None
    duration_seconds: Optional[int] = None
    notes: Optional[str] = None


class AddNoteRequest(BaseModel):
    customer_name: str = Field(..., min_length=1)
    title: str = Field(..., min_length=1)
    description: str = Field(..., min_length=1)


# ==========================================
# WHATSAPP REMINDER SCHEMAS
# ==========================================

class ReminderGenerateRequest(BaseModel):
    customer_name: str
    outstanding_amount: float
    max_days_overdue: int
    tone: str = "polite"  # polite | firm | urgent


class ReminderGenerateResponse(BaseModel):
    customer_name: str
    tone: str
    messages: List[str]


class LogActionRequest(BaseModel):
    customer_name: str
    action_type: str  # reminder | escalation | follow_up
    tone: str
    message_text: str
    overdue_amount: float
    days_overdue: int
    was_sent: bool = True
