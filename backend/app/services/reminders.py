"""WhatsApp reminder drafts — templates first, optional LLM enhancement."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import List

from backend.app.config import settings
from backend.app.services.extraction import is_llm_configured


@dataclass
class ReminderContext:
    customer_name: str
    total_overdue_amount: float
    max_days_overdue: int
    number_of_invoices: int
    oldest_due_date: str
    business_name: str
    tone: str
    open_dispute_count: int = 0
    broken_promise_count: int = 0


def _tone_label(tone: str, max_days_overdue: int, open_dispute_count: int = 0, broken_promise_count: int = 0) -> str:
    normalized = (tone or "polite").strip().lower()
    if normalized in {"polite", "firm", "urgent"}:
        return normalized
    # Escalate tone if there are broken promises or open disputes
    if broken_promise_count > 0 or open_dispute_count > 0:
        return "firm" if max_days_overdue <= 30 else "urgent"
    if max_days_overdue <= 15:
        return "polite"
    if max_days_overdue <= 45:
        return "firm"
    return "urgent"


def _template_messages(ctx: ReminderContext) -> List[str]:
    name = ctx.customer_name
    amount = f"₹{ctx.total_overdue_amount:,.2f}"
    business = ctx.business_name

    context_lines: list[str] = []
    if ctx.open_dispute_count > 0:
        context_lines.append(f"Open disputes: {ctx.open_dispute_count}")
    if ctx.broken_promise_count > 0:
        context_lines.append(f"Broken promises: {ctx.broken_promise_count}")
    context_str = f" ({'; '.join(context_lines)})" if context_lines else ""

    if ctx.tone == "polite":
        return [
            (
                f"Hi {name}, this is a friendly reminder from {business}. "
                f"You have an outstanding balance of {amount} across {ctx.number_of_invoices} invoice(s)."
                f"{context_str} "
                f"We would appreciate payment at your earliest convenience. Thank you."
            ),
            (
                f"Hello {name}! A gentle follow-up from {business} regarding your pending balance of {amount}. "
                f"Please let us know if you need any assistance with payment."
            ),
        ]

    if ctx.tone == "firm":
        return [
            (
                f"Dear {name}, your account with {business} shows an overdue balance of {amount} "
                f"(oldest due: {ctx.oldest_due_date}).{context_str} "
                f"Please arrange payment soon or contact us to discuss."
            ),
            (
                f"Hi {name}, this is a follow-up from {business} on your overdue amount of {amount}. "
                f"We value our partnership and request you to clear the outstanding dues promptly."
            ),
        ]

    return [
        (
            f"Dear {name}, urgent reminder: {amount} remains overdue with {business} "
            f"({ctx.max_days_overdue} days past due).{context_str} "
            f"Please pay today to avoid further escalation."
        ),
        (
            f"Hi {name}, your overdue balance of {amount} with {business} needs immediate attention. "
            f"Contact us right away if there is any issue preventing payment."
        ),
    ]


def _parse_llm_messages(raw_text: str) -> List[str]:
    parts = re.split(r"MESSAGE\s*\d+\s*:", raw_text, flags=re.IGNORECASE)
    messages = [p.strip() for p in parts if p.strip()]
    if len(messages) >= 2:
        return messages[:2]
    blocks = [b.strip() for b in raw_text.strip().split("\n\n") if b.strip()]
    if len(blocks) >= 2:
        return blocks[:2]
    return [raw_text.strip()]


def generate_whatsapp_messages(
    customer_name: str,
    total_overdue_amount: float,
    max_days_overdue: int,
    number_of_invoices: int,
    oldest_due_date: str,
    business_name: str,
    tone: str = "polite",
    open_dispute_count: int = 0,
    broken_promise_count: int = 0,
) -> List[str]:
    """Return two professional WhatsApp reminder variants."""
    ctx = ReminderContext(
        customer_name=customer_name,
        total_overdue_amount=total_overdue_amount,
        max_days_overdue=max_days_overdue,
        number_of_invoices=number_of_invoices,
        oldest_due_date=oldest_due_date,
        business_name=business_name or "Our Business",
        tone=_tone_label(tone, max_days_overdue, open_dispute_count, broken_promise_count),
        open_dispute_count=open_dispute_count,
        broken_promise_count=broken_promise_count,
    )

    # Always have reliable template output; try LLM only when configured.
    templates = _template_messages(ctx)
    if not is_llm_configured():
        return templates

    try:
        from openai import OpenAI

        client = OpenAI(api_key=settings.OPENAI_API_KEY)
        prompt = (
            f"Write exactly 2 short WhatsApp payment reminders for {ctx.customer_name}.\n"
            f"Overdue: {ctx.total_overdue_amount:.2f} INR, {ctx.number_of_invoices} invoice(s), "
            f"max {ctx.max_days_overdue} days overdue, tone: {ctx.tone}.\n"
            f"Business: {ctx.business_name}. Format:\nMESSAGE 1:\n...\n\nMESSAGE 2:\n..."
        )
        response = client.chat.completions.create(
            model=settings.LLM_MODEL,
            messages=[
                {"role": "system", "content": "You write concise professional WhatsApp reminders."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.6,
            max_tokens=500,
        )
        raw = response.choices[0].message.content or ""
        parsed = _parse_llm_messages(raw)
        if len(parsed) >= 2:
            return parsed[:2]
    except Exception:
        pass

    return templates
