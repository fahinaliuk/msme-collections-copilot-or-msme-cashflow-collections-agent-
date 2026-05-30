"""MSMED Act Section 16 — compound interest penalty calculator.

Implements the delayed-payment interest rules under India's Micro, Small
and Medium Enterprises Development (MSMED) Act, 2006:

  • Section 15: Buyer's liability to make payment within the agreed-upon or
    default period (45 days from acceptance/deemed acceptance).
  • Section 16: Interest on delayed payments at three times the RBI Bank Rate,
    compounded monthly.
  • Section 17: Right of the supplier to refer the dispute to the Micro and
    Small Enterprises Facilitation Council (MSEFC).

Reference RBI Bank Rate (effective 2026): 5.50% p.a.
Applicable interest rate: 3 × 5.50% = 16.50% p.a., compounded monthly.
"""

from datetime import date, timedelta
from typing import Optional

# ---------------------------------------------------------------------------
# Constants — MSMED Act + RBI Bank Rate (2026)
# ---------------------------------------------------------------------------
RBI_BANK_RATE_PERCENT: float = 5.50
MSMED_MULTIPLIER: int = 3
ANNUAL_INTEREST_RATE: float = RBI_BANK_RATE_PERCENT * MSMED_MULTIPLIER  # 16.50%
MONTHLY_RATE: float = (ANNUAL_INTEREST_RATE / 100) / 12  # ≈ 0.01375
OVERDUE_THRESHOLD_DAYS: int = 45


async def calculate_msmed_penalty(
    principal: float,
    due_date: date,
    as_of: Optional[date] = None,
) -> dict:
    """Calculate MSMED Section 16 compound interest on a delayed payment.

    Parameters
    ----------
    principal : float
        Outstanding invoice amount (₹).
    due_date : date
        Invoice due date (payment was expected by this date).
    as_of : date | None
        Date to compute interest up to. Defaults to today.

    Returns
    -------
    dict with keys:
        applies        – bool, whether MSMED penalty is applicable
        days_overdue   – int, calendar days past due date
        months_overdue – int, whole months past the 45-day grace period
        annual_rate    – float, the statutory interest rate (%)
        penalty_amount – float, accrued compound interest (₹)
        total_due      – float, principal + penalty (₹)
        legal_text     – str, legally worded notice for WhatsApp/email
    """
    if as_of is None:
        as_of = date.today()

    days_overdue = (as_of - due_date).days
    if days_overdue < 0:
        days_overdue = 0

    result = {
        "applies": False,
        "days_overdue": days_overdue,
        "months_overdue": 0,
        "annual_rate": ANNUAL_INTEREST_RATE,
        "penalty_amount": 0.0,
        "total_due": principal,
        "legal_text": "",
    }

    # MSMED penalties only apply after the 45-day threshold
    if days_overdue <= OVERDUE_THRESHOLD_DAYS:
        return result

    # -----------------------------------------------------------------------
    # Compute compound interest: A = P × (1 + r/12)^n
    # n = whole months elapsed since the 45-day grace period expired
    # -----------------------------------------------------------------------
    penalty_start_date = due_date + timedelta(days=OVERDUE_THRESHOLD_DAYS)
    penalty_days = (as_of - penalty_start_date).days
    months_overdue = penalty_days // 30  # conservative whole-month count

    if months_overdue < 1:
        # Less than one full month of compounding — still flag as applicable
        # but compute simple pro-rata interest for the partial month
        daily_rate = ANNUAL_INTEREST_RATE / 100 / 365
        penalty = principal * daily_rate * penalty_days
    else:
        # Full compound interest calculation
        amount = principal * ((1 + MONTHLY_RATE) ** months_overdue)
        penalty = amount - principal

    penalty = round(penalty, 2)
    total_due = round(principal + penalty, 2)

    result.update(
        {
            "applies": True,
            "months_overdue": months_overdue,
            "penalty_amount": penalty,
            "total_due": total_due,
            "legal_text": _build_legal_notice(
                principal=principal,
                penalty=penalty,
                total_due=total_due,
                days_overdue=days_overdue,
                months_overdue=months_overdue,
                annual_rate=ANNUAL_INTEREST_RATE,
                due_date=due_date,
                as_of=as_of,
            ),
        }
    )

    return result


def _build_legal_notice(
    *,
    principal: float,
    penalty: float,
    total_due: float,
    days_overdue: int,
    months_overdue: int,
    annual_rate: float,
    due_date: date,
    as_of: date,
) -> str:
    """Return a professionally worded MSMED legal notice paragraph.

    This text is designed to be appended to WhatsApp collection reminders.
    """
    return (
        f"⚖️ *MSMED Act Legal Notice*\n"
        f"\n"
        f"This is to formally bring to your attention that as per Section 15 "
        f"of the Micro, Small and Medium Enterprises Development (MSMED) Act, 2006, "
        f"payment for the supplied goods/services was due on *{due_date.strftime('%d %b %Y')}*.\n"
        f"\n"
        f"The payment is now overdue by *{days_overdue} days*. Under *Section 16* "
        f"of the MSMED Act, interest on delayed payments is chargeable at three times "
        f"the RBI Bank Rate ({RBI_BANK_RATE_PERCENT}% p.a.), i.e., "
        f"*{annual_rate:.2f}% per annum, compounded monthly*.\n"
        f"\n"
        f"📋 *Penalty Computation:*\n"
        f"  • Principal Outstanding: ₹{principal:,.2f}\n"
        f"  • Interest Period: {months_overdue} month(s) ({days_overdue} days overdue)\n"
        f"  • Accrued Interest: ₹{penalty:,.2f}\n"
        f"  • *Total Amount Due: ₹{total_due:,.2f}*\n"
        f"\n"
        f"Kindly arrange immediate payment to avoid further accrual of interest. "
        f"Please note that under *Section 17* of the MSMED Act, the supplier "
        f"reserves the right to refer this matter to the Micro and Small Enterprises "
        f"Facilitation Council (MSEFC) for recovery of the outstanding dues along "
        f"with accrued interest.\n"
        f"\n"
        f"_Computed as of {as_of.strftime('%d %b %Y')}_"
    )
