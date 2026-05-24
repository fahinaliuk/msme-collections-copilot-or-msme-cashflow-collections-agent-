#!/usr/bin/env python3
"""Seed a demo user and sample invoices from sample_data/invoices_sample.csv."""

import asyncio
import csv
import sys
from datetime import date
from pathlib import Path

# Project root on PYTHONPATH
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend.app.database import async_session_factory, init_db
from backend.app.models.invoice import Invoice
from backend.app.models.upload import Upload
from backend.app.models.user import User
from backend.app.services.customers import refresh_customer_profiles
from backend.app.utils.auth import hash_password

SAMPLE_CSV = ROOT / "sample_data" / "invoices_sample.csv"
DEMO_EMAIL = "demo@example.com"
DEMO_PASSWORD = "demo1234"


async def seed() -> None:
    await init_db()

    async with async_session_factory() as db:
        from sqlalchemy import select

        existing = await db.execute(select(User).where(User.email == DEMO_EMAIL))
        user = existing.scalars().first()
        if not user:
            user = User(
                email=DEMO_EMAIL,
                hashed_password=hash_password(DEMO_PASSWORD),
                full_name="Demo Owner",
                business_name="Demo MSME Pvt Ltd",
            )
            db.add(user)
            await db.flush()
            print(f"Created demo user: {DEMO_EMAIL} / {DEMO_PASSWORD}")
        else:
            print(f"Demo user already exists: {DEMO_EMAIL}")

        inv_count = await db.execute(select(Invoice).where(Invoice.user_id == user.id))
        if inv_count.scalars().first():
            print("Sample invoices already seeded. Skipping.")
            await db.commit()
            return

        upload = Upload(
            user_id=user.id,
            file_name="invoices_sample.csv",
            file_type="csv",
            file_size_bytes=SAMPLE_CSV.stat().st_size,
            classification="structured",
            extraction_method="deterministic",
            invoice_count=0,
            total_overdue_amount=0.0,
            total_overdue_customers=0,
        )
        db.add(upload)
        await db.flush()

        today = date.today()
        total_overdue = 0.0
        overdue_customers: set[str] = set()

        row_count = 0
        with SAMPLE_CSV.open(newline="", encoding="utf-8") as handle:
            reader = csv.DictReader(handle)
            for row in reader:
                row_count += 1
                amount = float(row["invoice_amount"])
                paid = float(row.get("amount_paid") or 0)
                outstanding = max(amount - paid, 0.0)
                due = date.fromisoformat(row["due_date"])
                days_overdue = max((today - due).days, 0) if outstanding > 0 and due < today else 0
                if outstanding > 0 and due < today:
                    total_overdue += outstanding
                    overdue_customers.add(row["customer_name"])

                db.add(
                    Invoice(
                        upload_id=upload.id,
                        user_id=user.id,
                        invoice_id=row["invoice_id"],
                        customer_name=row["customer_name"],
                        invoice_date=date.fromisoformat(row["invoice_date"]),
                        due_date=due,
                        invoice_amount=amount,
                        amount_paid=paid,
                        outstanding_amount=outstanding,
                        status=row.get("status", "Unpaid"),
                        days_overdue=days_overdue,
                        customer_phone=row.get("customer_phone") or None,
                    )
                )

        upload.invoice_count = row_count
        upload.total_overdue_amount = total_overdue
        upload.total_overdue_customers = len(overdue_customers)

        await db.flush()
        await refresh_customer_profiles(db, user.id)
        await db.commit()
        print(f"Seeded {upload.invoice_count} invoices from {SAMPLE_CSV.name}")


if __name__ == "__main__":
    asyncio.run(seed())
