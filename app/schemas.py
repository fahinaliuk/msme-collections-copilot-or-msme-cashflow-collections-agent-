"""Pydantic models for the MSME Cashflow & Collections Agent."""

from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class Invoice(BaseModel):
    """Represents a single invoice with computed overdue metrics."""

    invoice_id: str
    customer_name: str
    invoice_date: date
    due_date: date
    invoice_amount: float
    amount_paid: float
    status: str
    customer_phone: Optional[str] = None
    amount_outstanding: float
    days_overdue: int


class CustomerSummary(BaseModel):
    """Aggregated overdue summary for a single customer."""

    customer_name: str
    total_overdue_amount: float
    max_days_overdue: int
    number_of_invoices: int
    priority_score: float
    customer_phone: Optional[str] = None
    invoices: List[Invoice] = Field(default_factory=list)
    whatsapp_messages: List[str] = Field(default_factory=list)


class AnalysisResponse(BaseModel):
    """Top-level response returned by the /analyze-invoices endpoint."""

    total_overdue_amount: float
    total_overdue_customers: int
    top_customers: List[CustomerSummary] = Field(default_factory=list)


class UnstructuredAnalysisResponse(AnalysisResponse):
    """Analysis response with extraction details for messy inputs."""

    extracted_invoice_count: int
    extraction_method: str
    warnings: List[str] = Field(default_factory=list)


class LLMStatusResponse(BaseModel):
    """Runtime LLM configuration status that does not expose secrets."""

    configured: bool
    message_model: str
    extraction_model: str
    max_extraction_characters: int


class UploadSummary(BaseModel):
    """Summary of a saved invoice analysis upload."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    file_name: str
    total_overdue_amount: float
    total_overdue_customers: int


class CustomerOverdueHistory(BaseModel):
    """Saved customer-level overdue summary for a previous upload."""

    model_config = ConfigDict(from_attributes=True)

    customer_name: str
    total_overdue_amount: float
    max_days_overdue: int
    priority_score: float


class UploadDetailResponse(BaseModel):
    """Full saved upload details returned by GET /uploads/{upload_id}."""

    upload: UploadSummary
    customers: List[CustomerOverdueHistory] = Field(default_factory=list)


class CashflowDay(BaseModel):
    """Projected cash movement and balance for one day."""

    date: date
    inflows: float
    outflows: float
    end_of_day_balance: float


class CashflowProjectionResponse(BaseModel):
    """Fourteen-day cashflow projection with low-cash risk dates."""

    projection: List[CashflowDay] = Field(default_factory=list)
    risk_flags: List[date] = Field(default_factory=list)
