# MSME Collections Copilot → BizPilot

A production-style, AI-powered financial operations and accounts receivable platform for Micro, Small & Medium Enterprises (MSMEs) — now upgraded with an **Event-Driven Autonomous Agent** system.

**MSME Collections Copilot (BizPilot)** helps businesses transform messy ledger entries, spreadsheet uploads, or pasted text into structured receivables, track overdue invoices, prioritize collections, generate ready-to-copy WhatsApp reminders, and **autonomously dispatch legally-backed collection notices** with MSMED Act Section 16 compound interest penalties.

**Product documentation:** [Product Overview](docs/PRODUCT_OVERVIEW.md) · [PRD](docs/PRD.md) · [Deployment](docs/DEPLOYMENT.md)

---

## ⚡ What's New — BizPilot Autonomous Agent

The BizPilot upgrade transforms the platform from a manual **Copilot** into a switchable **Autopilot** system:

| Capability | Copilot Mode (Manual) | Autopilot Mode (Autonomous) |
|---|---|---|
| Invoice monitoring | User reviews dashboard | Scheduler scans daily at 9 AM IST |
| Reminder generation | User clicks "Draft Reminder" | Auto-generated with LLM templates |
| MSMED legal penalties | Not applied | Auto-calculated for >45-day overdue |
| WhatsApp dispatch | User copies text manually | API-dispatched via gateway |
| Action logging | `MANUAL_COPY` | `AUTOMATED_API` with `DISPATCHED`/`FAILED` status |

---

## Technical Stack

### Frontend
- **Framework**: Next.js 15 (App Router, Client & Server Components)
- **Language**: TypeScript
- **Styling**: TailwindCSS
- **Animations**: Framer Motion (physics-based micro-animations, spring transitions)
- **Visualizations**: Recharts (Interactive responsive charts)
- **Icons**: Lucide React
- **API Communication**: Axios + TanStack React Query (optimistic mutations)

### Backend
- **Framework**: FastAPI (Async Architecture)
- **Language**: Python 3.13
- **ORM & Database**: SQLAlchemy 2.0 (Async Session Manager, portable schemas)
- **Database Support**: Dual-mode engine supporting async PostgreSQL (`asyncpg`) and async SQLite (`aiosqlite`)
- **Authentication**: JWT Auth (Bearer Tokens, bcrypt password hashing)
- **Extraction Engine**: Layered parser (deterministic Pandas/regex first, OpenAI fallback only when heuristics find no rows)
- **Job Scheduler**: APScheduler (AsyncIOScheduler with cron triggers)
- **Legal Engine**: MSMED Act Section 16 compound interest calculator (3× RBI Bank Rate)
- **WhatsApp Gateway**: Async dispatch interface (mock provider, swap-ready for Twilio/Gallabox/Gupshup)

---

## Core Features

### Original MVP
1. **JWT Authentication & User Isolation**: Credentials signup/login with full multi-tenant data isolation.
2. **Layered Invoice Ingestion Engine**: Supports CSV, XLSX, and pasted invoice text. Pandas + flexible column matching for spreadsheets, regex heuristics for pasted text, optional OpenAI fallback.
3. **Spreadsheet Validation Grid**: Editable preview table with duplicate detection, date validation, and real-time confidence scoring.
4. **Interactive Executive Dashboard**: KPI metric cards, Recharts graphs (aging buckets, overdue trends, collections summary).
5. **Risk Priority Engine**: Computes `outstanding_amount × overdue_days` per invoice, ranks into risk tiers (low → critical).
6. **WhatsApp Reminder Drafts**: Tone-adaptive (polite/firm/urgent) ready-to-copy messages, logged in audit history.
7. **Premium SaaS UI**: Responsive sidebar, Dark/Light mode, `framer-motion` micro-animations.
8. **Context-Aware AI Chatbot**: Floating chat widget with real-time financial context injection.
9. **Interactive Guided Onboarding**: `react-joyride` step-by-step product tour.

### BizPilot Autonomous Agent (New)
10. **Autopilot Toggle**: Premium animated Copilot ↔ Autopilot mode switch on the dashboard, powered by Framer Motion with gradient glow effects and optimistic React Query mutations.
11. **MSMED Act Legal Engine**: Section 16 compound interest penalties (16.50% p.a. = 3× RBI Bank Rate of 5.50%), auto-calculated for invoices >45 days overdue. Returns legally worded notices referencing Sections 15, 16, and 17.
12. **WhatsApp Gateway**: Async message dispatch interface with structured results, message IDs, and failure handling. Currently mocked — drop-in replaceable with Twilio/Gallabox.
13. **Autonomous Scheduler**: APScheduler cron job running daily at 09:00 AM IST. Queries autopilot-enabled users' overdue invoices, applies MSMED penalties, generates reminders, dispatches via gateway, and logs actions with `DISPATCHED`/`FAILED` status tracking.
14. **Dispatch Audit Trail**: Every autonomous action tracked with `autopilot_status` (PENDING/DISPATCHED/FAILED) and `sent_via` (MANUAL_COPY/AUTOMATED_API) in the collection_actions table.

---

## System Architecture Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                        BIZPILOT SYSTEM FLOW                        │
└─────────────────────────────────────────────────────────────────────┘

  ┌──────────────┐       ┌──────────────────┐      ┌───────────────┐
  │  Next.js 15  │──────▶│  FastAPI Backend  │─────▶│  PostgreSQL/  │
  │  Dashboard   │◀──────│  (Async Routes)   │◀─────│  SQLite DB    │
  └──────┬───────┘       └────────┬─────────┘      └───────────────┘
         │                        │
         │  PATCH /api/users/     │
         │  settings              │
         ▼                        ▼
  ┌──────────────┐       ┌──────────────────┐
  │  Autopilot   │       │  APScheduler     │
  │  Toggle UI   │       │  (09:00 AM IST)  │
  │  (React      │       │                  │
  │   Query +    │       │  Daily Cron Job   │
  │   Framer     │       └────────┬─────────┘
  │   Motion)    │                │
  └──────────────┘                ▼
                         ┌──────────────────┐
                         │  1. Query Users   │
                         │  where autopilot  │
                         │  == True          │
                         └────────┬─────────┘
                                  │
                                  ▼
                         ┌──────────────────┐
                         │  2. Query Overdue │
                         │  Invoices where   │
                         │  outstanding > 0  │
                         └────────┬─────────┘
                                  │
                                  ▼
                         ┌──────────────────┐     ┌──────────────────┐
                         │  3. Days > 45?   │────▶│  MSMED Legal     │
                         │     (Check)      │ YES │  Agent: Compound │
                         └────────┬─────────┘     │  Interest @      │
                                  │ NO            │  16.50% p.a.     │
                                  │               └────────┬─────────┘
                                  │                        │
                                  ▼                        ▼
                         ┌──────────────────┐     ┌──────────────────┐
                         │  4. Generate      │◀───│  Append Legal    │
                         │  WhatsApp Msg    │     │  Notice Text     │
                         │  (LLM Templates) │     └──────────────────┘
                         └────────┬─────────┘
                                  │
                                  ▼
                         ┌──────────────────┐
                         │  5. Dispatch via  │
                         │  WhatsApp Gateway │
                         │  (Mock / Twilio)  │
                         └────────┬─────────┘
                                  │
                                  ▼
                         ┌──────────────────┐
                         │  6. Log Action    │
                         │  autopilot_status │
                         │  = DISPATCHED     │
                         │  sent_via =       │
                         │  AUTOMATED_API    │
                         └──────────────────┘
```

### Detailed Flow Explanation

**Step 1 — User Enables Autopilot**
The user flips the Autopilot toggle on the Executive Dashboard. This sends a `PATCH /api/users/settings` request via TanStack React Query (with optimistic updates) to set `is_autopilot_enabled = true` on their user record.

**Step 2 — Scheduler Wakes Up (Daily 9 AM IST)**
APScheduler's `AsyncIOScheduler` fires a cron job every day at 09:00 AM IST. It opens a fresh `AsyncSession` from the SQLAlchemy session factory.

**Step 3 — Query Eligible Users & Invoices**
The scheduler queries all users where `is_autopilot_enabled == True AND is_active == True`. For each user, it fetches all invoices with `outstanding_amount > 0`, then groups them by `customer_name`.

**Step 4 — MSMED Penalty Calculation**
For any customer whose oldest invoice is >45 days overdue, the legal agent applies **Section 16 of the MSMED Act, 2006**:
- Interest rate: **16.50% p.a.** (3× RBI Bank Rate of 5.50%)
- Compounding: **Monthly** → `A = P × (1 + 0.165/12)^n`
- A legally worded notice is generated referencing Sections 15, 16, and 17, including the exact penalty computation.

**Step 5 — Message Generation**
The existing `reminders` service generates tone-adaptive WhatsApp messages (polite/firm/urgent based on days overdue). If the MSMED penalty applies, the legal notice is appended to the message body.

**Step 6 — WhatsApp Dispatch**
The message is sent through the WhatsApp gateway (`dispatch_whatsapp_message`). Currently mocked with `asyncio.sleep` — returns a structured `WhatsAppResult` with a unique `message_id` and success/failure status.

**Step 7 — Audit Logging**
A `CollectionAction` record is created with:
- `autopilot_status = DISPATCHED` (or `FAILED` / `PENDING`)
- `sent_via = AUTOMATED_API`
- Full message text, overdue amount, and customer details

---

## Database Schema (SQLAlchemy Models)

The backend defines portable schemas operating seamlessly across SQLite and PostgreSQL:
- **`users`**: Emails, hashed passwords, full name, business name, roles, and **`is_autopilot_enabled`** (BizPilot toggle).
- **`uploads`**: History of every ingested file (name, size, extraction method, metrics summary).
- **`invoices`**: Invoice identifiers, customer names, dates, amounts, outstanding balances, days overdue, confidence scores.
- **`customer_profiles`**: Aggregated customer ledger entries (total invoices count, total outstanding, risk score/tiers).
- **`collection_actions`**: Audit log of every WhatsApp draft/dispatch with **`autopilot_status`** (PENDING/DISPATCHED/FAILED) and **`sent_via`** (MANUAL_COPY/AUTOMATED_API).
- **`promises_to_pay`**: Payment promise tracking with status lifecycle.
- **`disputes`**: Dispute management with resolution workflow.
- **`communication_logs`**: Customer communication timeline.

---

## Project Structure

```
├── backend/
│   ├── app/
│   │   ├── models/            # Database models (User, Invoice, Customer, CollectionAction, etc.)
│   │   ├── routers/           # API endpoints
│   │   │   ├── auth.py        #   JWT signup/login/me
│   │   │   ├── dashboard.py   #   KPIs, aging buckets, trends
│   │   │   ├── invoices.py    #   Upload, extraction, validation, confirm
│   │   │   ├── reminders.py   #   WhatsApp draft generation & action logging
│   │   │   ├── worklist.py    #   Next-best-action recommendations
│   │   │   ├── promises.py    #   Promise-to-pay CRUD
│   │   │   ├── disputes.py    #   Dispute management CRUD
│   │   │   ├── chat.py        #   AI chatbot endpoint
│   │   │   └── user_settings.py  # ⚡ Autopilot toggle (GET/PATCH /api/users/settings)
│   │   ├── schemas/           # Pydantic v2 validation models
│   │   ├── services/          # Business logic (extraction, reminders, worklist, etc.)
│   │   ├── utils/
│   │   │   ├── auth.py        #   JWT & password hashing
│   │   │   ├── legal_agent.py #   ⚡ MSMED Act Section 16 penalty calculator
│   │   │   ├── scheduler.py   #   ⚡ APScheduler autonomous orchestrator
│   │   │   ├── whatsapp_gateway.py  # ⚡ WhatsApp dispatch mock
│   │   │   └── rate_limiter.py
│   │   ├── config.py          # Pydantic-settings config loader
│   │   ├── database.py        # Async SQLAlchemy session & init_db
│   │   └── main.py            # FastAPI entrypoint with scheduler lifespan
├── frontend/
│   ├── src/
│   │   ├── app/               # Next.js 15 pages (dashboard, upload, collections, etc.)
│   │   ├── components/
│   │   │   ├── dashboard/
│   │   │   │   └── AutopilotToggle.tsx  # ⚡ Copilot ↔ Autopilot animated toggle
│   │   │   ├── chat/          # AI chatbot widget
│   │   │   ├── layout/        # Sidebar, navigation
│   │   │   ├── onboarding/    # Product tour
│   │   │   └── ui/            # Shared UI primitives
│   │   └── lib/
│   │       └── api.ts         # Axios API clients (+ settingsAPI for autopilot)
├── alembic/
│   └── versions/
│       ├── 001_initial_mvp_schema.py
│       └── 002_add_autopilot_columns.py  # ⚡ BizPilot migration
├── Dockerfile                 # Backend container build
├── docker-compose.yml         # Full-stack orchestrator
├── requirements.txt           # Python packages (+ APScheduler)
└── README.md
```

> ⚡ = New in BizPilot upgrade

---

## How to Get Started

### Configuration (Environment Variables)

Create a `.env` file in the project root. The backend will load variables using Pydantic Settings:
Copy `.env.example` to `.env` and adjust values. OpenAI is optional (templates used for reminders and heuristic extraction when the key is absent).

### Option A: Local Run (No Docker)

#### 1. Start the FastAPI Backend
Ensure your Python dependencies are installed:
```bash
pip install -r requirements.txt
```

Run uvicorn (from project root):
```bash
uvicorn backend.app.main:app --reload --port 8000
```
*Backend Swagger Docs will be available at `http://127.0.0.1:8000/docs`.*
*The BizPilot scheduler will auto-start and run the autopilot job daily at 9:00 AM IST.*

#### Optional: Seed demo data
```bash
python3 scripts/seed_sample_data.py
```
Login with `demo@example.com` / `demo1234`.

#### 2. Start the Next.js Client
Ensure Node.js is installed. Navigate to the frontend directory:
```bash
cd frontend
npm install
npm run dev
```
*The web UI will be live at `http://127.0.0.1:3000`.*

---

### Option B: Deploy with Docker Compose

```bash
cp .env.production.example .env
# Edit .env — set JWT_SECRET, SECRET_KEY, POSTGRES_PASSWORD (see docs/DEPLOYMENT.md)

docker compose up --build -d
```

- **Web UI:** `http://localhost:3000`  
- **API health:** `http://localhost:8000/api/health`  

Full production steps (HTTPS, VPS, cloud PaaS): **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**

---

## License
MIT
