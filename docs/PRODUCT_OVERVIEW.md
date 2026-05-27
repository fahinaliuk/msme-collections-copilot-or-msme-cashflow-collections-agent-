# MSME Collections Copilot — Product Overview

**Version:** 1.0 (MVP)  
**Last updated:** May 2026  
**Status:** MVP shipped (local / Docker deployable)

---

## One-line pitch

**MSME Collections Copilot** is a lightweight collections assistant that turns messy invoice data into structured receivables, overdue intelligence, and ready-to-send WhatsApp payment reminders—without replacing your accounting system.

---

## The problem

Micro, small, and medium enterprises (MSMEs) in India and similar markets often run collections on:

- Excel exports from Tally, Zoho, or manual ledgers  
- WhatsApp and email threads with partial payment updates  
- No single view of **who owes what, for how long, and who to chase first**

The result:

- Cash trapped in overdue receivables  
- Ad-hoc follow-ups that feel personal but are inconsistent  
- Owner time spent reconciling spreadsheets instead of running the business  

Enterprise AR platforms are too heavy, expensive, and complex for a 5–50 person business.

---

## The solution

A focused SaaS MVP that does **one job well**:

> Transform messy invoice data → structured receivables → overdue tracking → prioritized collections → customer follow-up drafts.

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│ Upload CSV  │────▶│ Validate & edit  │────▶│ Collections         │
│ or paste    │     │ preview grid     │     │ dashboard + charts  │
│ ledger text │     └──────────────────┘     └──────────┬──────────┘
└─────────────┘                                          │
                                                         ▼
                                              ┌─────────────────────┐
                                              │ Priority-ranked     │
                                              │ customers + WhatsApp  │
                                              │ reminder drafts     │
                                              └─────────────────────┘
```

---

## Target users

| Persona | Role | Primary need |
|---------|------|----------------|
| **Business owner** | Founder / MD of MSME | See total overdue exposure and who to call today |
| **Accounts executive** | Bookkeeper / admin | Import ledgers, fix errors, confirm data |
| **Collections coordinator** | Ops staff (often same as admin) | Draft polite reminders and log follow-ups |

**Company profile:** B2B MSMEs with ₹10L–₹5Cr annual revenue, 20–500 open invoices, heavy WhatsApp customer communication.

---

## Core value proposition

| Benefit | How the product delivers it |
|---------|------------------------------|
| **Clarity** | Executive dashboard with receivables, overdue %, aging buckets |
| **Focus** | Priority score ranks customers by financial impact × lateness |
| **Speed** | Drag-and-drop CSV/XLSX or paste text—no manual row entry |
| **Trust** | Human-in-the-loop preview before anything is saved |
| **Action** | Copy-ready WhatsApp messages in polite / firm / urgent tones |

---

## MVP scope (what exists today)

### In scope

- Email/password auth with per-user data isolation  
- File upload: CSV, XLSX, plain text; pasted invoice text  
- Deterministic extraction (pandas + regex); optional AI fallback  
- Editable validation preview with warnings  
- Collections dashboard (KPIs, aging, trends, summary charts)  
- Customer priority engine and risk tiers  
- WhatsApp reminder generator (templates; optional LLM polish)  
- Collection action audit log  
- Premium SaaS UI with Sidebar and Framer Motion micro-animations
- Context-Aware AI Chatbot for querying financial data
- Interactive Product Tour onboarding (`react-joyride`)

### Explicitly out of scope (MVP)

- OCR / PDF invoice scanning  
- Payment gateway integration or auto-reconciliation  
- Sending WhatsApp messages from the platform (copy-only)  
- Multi-currency, GST filing, or full accounting  
- Mobile native apps  
- Team roles and permissions beyond single-user accounts  

---

## Product principles

1. **Deterministic first** — Rules and parsers before AI; AI only when heuristics fail.  
2. **Human confirms** — Never auto-commit extracted data.  
3. **Modular backend** — Routers, services, models separated for maintainability.  
4. **MSME-appropriate UX** — Stripe/Linear-inspired clarity without enterprise clutter.  
5. **Optional AI** — Product works offline from OpenAI; key only enhances extraction/reminders.  

---

## Success metrics (MVP / pilot)

| Metric | Definition | Target (pilot) |
|--------|------------|----------------|
| Time to first dashboard | Signup → confirmed import → dashboard view | < 10 minutes |
| Extraction acceptance rate | Rows confirmed without major edits / total rows | > 80% for structured CSV |
| Weekly active importers | Users who upload ≥1 file per week | Track baseline |
| Reminder usage | Users who copy or log ≥1 reminder per week | > 50% of active users |
| Overdue visibility | Users who can state top 3 debtors without Excel | Qualitative (interviews) |

---

## Competitive positioning

| Alternative | Limitation | Our angle |
|-------------|------------|-----------|
| Excel + WhatsApp | No priority logic, error-prone | Structured + ranked + drafts |
| Tally / Zoho Books | Accounting, not collections workflow | Collections-first, lighter |
| Enterprise AR (HighRadius, etc.) | Cost, implementation time | MVP SaaS for MSMEs |
| Generic AI chat | No persistent ledger, no validation | Domain schema + preview grid |

---

## Technology summary

| Layer | Stack |
|-------|--------|
| Frontend | Next.js 15, TypeScript, Tailwind, Recharts, React Query |
| Backend | FastAPI, SQLAlchemy 2 (async), Pydantic v2 |
| Database | SQLite (dev) / PostgreSQL (Docker production) |
| Auth | JWT (Bearer), bcrypt passwords |
| Deploy | Docker Compose (db + api + web) |

---

## Roadmap snapshot (post-MVP)

| Phase | Theme | Examples |
|-------|--------|----------|
| **v1.1** | Reliability | Automated tests, real Alembic migrations, email reminders |
| **v1.2** | Integrations | Tally/Zoho export templates, bulk export |
| **v2.0** | Workflow | WhatsApp Business API send, payment links, team seats |
| **v2.x** | Intelligence | Payment prediction, customer reliability scoring ML |

---

## Related documents

- **[PRD.md](./PRD.md)** — Detailed requirements, user stories, acceptance criteria  
- **[../README.md](../README.md)** — Developer setup and run instructions  

---

## Document control

| Role | Name | Notes |
|------|------|-------|
| Product | — | MVP definition |
| Engineering | — | Implementation aligned to PRD v1.0 |
