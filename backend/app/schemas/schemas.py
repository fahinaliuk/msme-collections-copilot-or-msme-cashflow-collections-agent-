"""Pydantic schemas for request validation and response serialization in FastAPI."""

import uuid
from datetime import date, datetime
from typing import List, Optional
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
    created_at: datetime

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserOut


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
