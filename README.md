# MSME Collections Copilot

A production-style, lightweight AI-powered financial operations and accounts receivable platform for Micro, Small & Medium Enterprises (MSMEs). 

**MSME Collections Copilot** helps businesses transform messy ledger entries, spreadsheet uploads, or pasted text into structured receivables, track overdue invoices, prioritize collections, and generate ready-to-copy WhatsApp reminder drafts.

**Product documentation:** [Product Overview](docs/PRODUCT_OVERVIEW.md) · [PRD](docs/PRD.md) · [Deployment](docs/DEPLOYMENT.md)

---

## Technical Stack

### Frontend
- **Framework**: Next.js 15 (App Router, Client & Server Components)
- **Language**: TypeScript
- **Styling**: TailwindCSS
- **Visualizations**: Recharts (Interactive responsive charts)
- **Icons**: Lucide React
- **API Communication**: Axios + TanStack React Query

### Backend
- **Framework**: FastAPI (Async Architecture)
- **Language**: Python 3.13
- **ORM & Database**: SQLAlchemy 2.0 (Async Session Manager, portable schemas)
- **Database Support**: Dual-mode engine supporting async PostgreSQL (`asyncpg`) and async SQLite (`aiosqlite`)
- **Authentication**: JWT Auth (Bearer Tokens, bcrypt password hashing)
- **Extraction Engine**: Layered parser (deterministic Pandas/regex first, OpenAI fallback only when heuristics find no rows)

---

## MVP Core Features

1. **JWT Authentication & User Isolation**: Credentials signup (`POST /api/auth/signup`), login (`POST /api/auth/login`), and authenticated profile isolation. Every database query is strictly isolated by the authenticated user's ID.
2. **Layered Invoice Ingestion Engine**: Supports CSV, XLSX, and pasted invoice text (no OCR). Uses Pandas + flexible column matching for spreadsheets, regex heuristics for pasted text, and optional OpenAI fallback.
3. **Spreadsheet Validation Grid**: Displays extracted receivables in an editable, real-time client-validated preview table. Highlights duplicate invoice IDs, date overlaps, blank columns, or negative amounts.
4. **Interactive Executive Dashboard**: Features high-fidelity KPI metric cards (Total Receivables, Overdue Balance) and Recharts graphs (BarChart for aging groups, AreaChart with gradients for historical trends).
5. **Risk Priority Engine**: Computes priority as the sum of `outstanding_amount × overdue_days` per invoice, then ranks customers into risk tiers (low, medium, high, critical).
6. **WhatsApp Reminder Drafts**: Offers tone modifications (polite, firm, urgent) and crafts immediate ready-to-copy WhatsApp reminder messages, logging copy actions in the database history.
7. **Premium SaaS UI**: Features a responsive, collapsible left-hand sidebar with native Dark/Light mode support, utilizing `framer-motion` for smooth micro-animations and physics-based interactions.
8. **Context-Aware AI Chatbot**: A floating global chat widget that silently injects the user's real-time financial metrics and top risk accounts into the LLM system prompt, allowing users to "Chat with their data".
9. **Interactive Guided Onboarding**: First-time users are greeted with a `react-joyride` powered step-by-step product tour that intelligently highlights core features, storing completion state in `localStorage`.

---

## Database Schema (SQLAlchemy Models)
The backend defines portable schemas operating seamlessly across SQLite and PostgreSQL:
- **`users`**: Tracks emails, hashed passwords, full name, business name, and operational roles.
- **`uploads`**: Keeps a history of every ingested file (name, size, extraction method, metrics summary).
- **`invoices`**: Houses individual invoice identifiers, customer names, dates, amounts, outstanding balances, days overdue, and warning metrics.
- **`customer_profiles`**: Aggregates customer ledger entries (total invoices count, total outstanding balance, risk score, and tiers).
- **`collection_actions`**: Maintains an audit log of every WhatsApp collection draft reviewed or sent.

---

## Project Structure

```
├── backend/
│   ├── app/
│   │   ├── models/        # Database models (User, Invoice, Customer, etc.)
│   │   ├── routers/       # API endpoints (Auth, Invoices, Dashboard, Reminders)
│   │   ├── schemas/       # Pydantic v2 validation models
│   │   ├── utils/         # Auth helpers and JWT tokens
│   │   ├── config.py      # Pydantic-settings config Loader
│   │   ├── database.py    # Async SQLAlchemy session initialization and startup hooks
│   │   └── main.py        # Central FastAPI entrypoint with middleware
├── frontend/
│   ├── src/
│   │   ├── app/           # Next.js 15 pages and routes (dashboard, upload, collections)
│   │   ├── components/    # Reusable layout and navigation components
│   │   ├── hooks/         # Custom React hooks
│   │   ├── lib/           # Axios global API clients
│   │   └── globals.css    # Global Tailwind styles with dark/light themes
│   ├── tsconfig.json      # TypeScript compiler specifications
│   ├── tailwind.config.js # Custom design tokens and theme variables
│   └── Dockerfile         # Multi-stage frontend container build
├── Dockerfile             # Backend container build
├── docker-compose.yml     # Containerized PostgreSQL, FastAPI, and Next.js orchestrator
├── requirements.txt       # Python package list
└── README.md              # Documentation
```

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
