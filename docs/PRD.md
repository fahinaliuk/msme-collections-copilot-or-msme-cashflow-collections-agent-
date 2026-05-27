# Product Requirements Document (PRD)

# MSME Collections Copilot

| Field | Value |
|-------|--------|
| **Product name** | MSME Collections Copilot |
| **Document version** | 1.0 |
| **Status** | Approved for MVP |
| **Owner** | Product / Engineering |
| **Last updated** | May 2026 |

---

## 1. Overview

### 1.1 Purpose

This PRD defines functional and non-functional requirements for the **MSME Collections Copilot** MVP: a lightweight, AI-assisted accounts receivable and collections platform for micro, small, and medium enterprises.

### 1.2 Problem statement

MSMEs struggle to track overdue invoices and follow up on collections efficiently. Invoice data lives in inconsistent spreadsheets and chat logs. Owners lack a single prioritized view of who to contact and what to say.

### 1.3 Product goal

Transform messy invoice data into:

- Structured receivables  
- Overdue tracking and aging analytics  
- Collections intelligence (priority ranking)  
- Customer follow-up workflows (WhatsApp reminder drafts)  

### 1.4 Non-goals (MVP)

- Replace accounting or ERP systems  
- OCR / scanned invoice processing  
- Automated payment collection or legal escalation workflows  
- Native WhatsApp sending from the platform  

---

## 2. Users and personas

### 2.1 Primary persona: Business owner (Ravi)

- Runs a 15-person trading / manufacturing MSME  
- Uses Excel and WhatsApp daily  
- Wants: “How much is overdue and who do I call first?”  
- Success: Opens dashboard Monday morning and acts in &lt; 15 minutes  

### 2.2 Secondary persona: Accounts executive (Priya)

- Maintains invoice spreadsheets  
- Wants: Fast import, catch duplicates and bad dates before saving  
- Success: Uploads monthly ledger, fixes 2–3 rows in preview, confirms  

### 2.3 Tertiary persona: Collections coordinator

- Sends payment reminders to customers  
- Wants: Professional message drafts, tone control, simple history  
- Success: Copies WhatsApp text and logs “sent” in one flow  

---

## 3. User stories and requirements

### Epic 1: Authentication and tenancy

| ID | User story | Priority | MVP |
|----|------------|----------|-----|
| AUTH-01 | As a user, I can register with email, password, name, and optional business name so that I have an isolated workspace. | P0 | Yes |
| AUTH-02 | As a user, I can log in and receive a JWT so that I can access protected APIs. | P0 | Yes |
| AUTH-03 | As a user, I can only see my own invoices, uploads, and customers (user isolation). | P0 | Yes |
| AUTH-04 | As a user, I am redirected to login when my session expires. | P1 | Yes |

**Acceptance criteria (AUTH-01–03):**

- `POST /api/auth/signup` creates user; returns token + profile  
- `POST /api/auth/login` (OAuth2 form) returns token on valid credentials  
- All `/api/invoices`, `/api/dashboard`, `/api/collections` require valid Bearer token  
- Cross-user data access returns 404 or empty set, never another user’s rows  

---

### Epic 2: Invoice ingestion

| ID | User story | Priority | MVP |
|----|------------|----------|-----|
| ING-01 | As a user, I can upload a CSV or XLSX file via drag-and-drop so that I don’t retype invoices. | P0 | Yes |
| ING-02 | As a user, I can paste unstructured invoice text so that I can ingest WhatsApp/email logs. | P0 | Yes |
| ING-03 | As a system, I parse spreadsheets with flexible column names (e.g. “Invoice No”, “Party Name”). | P0 | Yes |
| ING-04 | As a system, I use deterministic parsing first and AI only when heuristics find no rows. | P0 | Yes |
| ING-05 | As a user, I cannot upload files over 10 MB or unsupported types. | P0 | Yes |

**Supported upload types (MVP):**

- `.csv`, `.xlsx`, `.xls`, `.txt`  
- Pasted plain text  

**Not supported (MVP):** PDF, DOCX, images (OCR).

**Extracted fields (minimum):**

| Field | Required | Notes |
|-------|----------|-------|
| `invoice_id` | Yes | Unique per user (warning if duplicate) |
| `customer_name` | Yes | |
| `invoice_date` | Recommended | Defaults to due_date if missing |
| `due_date` | Yes | |
| `invoice_amount` | Yes | |
| `amount_paid` | No | Default 0 |
| `status` / payment_status | No | Derived: Paid / Unpaid / Partially Paid |
| `customer_phone` | No | For reminder context |

**Acceptance criteria (ING-01–05):**

- `POST /api/invoices/upload` returns `ExtractionPreviewResponse` without persisting  
- Structured files use `extraction_method: deterministic`  
- Text uses `heuristic` or `llm` when configured  
- Oversize file → HTTP 413; bad type → HTTP 400 with clear message  

---

### Epic 3: Validation and confirmation

| ID | User story | Priority | MVP |
|----|------------|----------|-----|
| VAL-01 | As a user, I see a preview table of extracted rows before anything is saved. | P0 | Yes |
| VAL-02 | As a user, I can edit any cell in the preview grid. | P0 | Yes |
| VAL-03 | As a user, I see warnings for missing fields, duplicates, invalid dates, and amount issues. | P0 | Yes |
| VAL-04 | As a user, I must confirm import to persist data. | P0 | Yes |
| VAL-05 | As a user, I can add or delete rows in preview. | P1 | Yes |

**Validation rules:**

| Rule | Severity | Message example |
|------|----------|-----------------|
| Missing invoice_id | Warning | Missing invoice ID |
| Missing customer_name | Warning | Missing customer name |
| Duplicate invoice_id (DB or preview) | Warning | Duplicate invoice |
| due_date &lt; invoice_date | Warning | Due date is before invoice date |
| invoice_amount &lt; 0 | Warning | Invoice amount cannot be negative |
| amount_paid &gt; invoice_amount | Warning | Amount paid exceeds total |

**Acceptance criteria (VAL-01–04):**

- `POST /api/invoices/confirm` creates `upload` + `invoices` records  
- Customer profiles refreshed after confirm  
- User can proceed with warnings after confirmation dialog (client)  

---

### Epic 4: Collections dashboard

| ID | User story | Priority | MVP |
|----|------------|----------|-----|
| DASH-01 | As an owner, I see KPI cards: total receivables, overdue amount/count, collected, overdue %. | P0 | Yes |
| DASH-02 | As an owner, I see aging buckets (0–30, 31–60, 61–90, 90+ days). | P0 | Yes |
| DASH-03 | As an owner, I see overdue trend (recent days). | P0 | Yes |
| DASH-04 | As an owner, I see collections summary (collected vs outstanding by month). | P1 | Yes |
| DASH-05 | As an owner, I see top priority customers and recent invoices. | P0 | Yes |
| DASH-06 | As an owner, I see high-risk accounts list. | P1 | Yes |

**KPI definitions:**

| KPI | Formula |
|-----|---------|
| Total receivables | Sum of `outstanding_amount` for all invoices |
| Overdue amount | Sum of `outstanding_amount` where `due_date` &lt; today and outstanding &gt; 0 |
| Collected amount | Sum of `amount_paid` |
| Overdue % | Overdue amount / total receivables × 100 |

**Acceptance criteria:**

- `GET /api/dashboard/summary` returns all sections for authenticated user only  
- Empty state renders without errors when no invoices exist  

---

### Epic 5: Collections priority engine

| ID | User story | Priority | MVP |
|----|------------|----------|-----|
| PRI-01 | As a user, customers are ranked by collections priority score. | P0 | Yes |
| PRI-02 | As a user, I see risk tier per customer (low / medium / high / critical). | P0 | Yes |
| PRI-03 | As a user, I view full ranked list on Collections page. | P0 | Yes |

**Priority formula (MVP):**

```
priority_score = Σ (outstanding_amount × overdue_days)  per overdue invoice
overdue_days = max(0, today - due_date)  when outstanding > 0
```

**Risk tier thresholds (MVP):**

| Tier | Condition (priority_score) |
|------|----------------------------|
| critical | &gt; 500,000 |
| high | &gt; 100,000 |
| medium | &gt; 25,000 |
| low | otherwise |

**Acceptance criteria:**

- `GET /api/dashboard/customers` returns list sorted by `priority_score` descending  
- Scores update after each successful import  

---

### Epic 6: WhatsApp reminder generator

| ID | User story | Priority | MVP |
|----|------------|----------|-----|
| REM-01 | As a user, I generate 2 reminder message variants for a selected customer. | P0 | Yes |
| REM-02 | As a user, I choose tone: polite, firm, urgent. | P0 | Yes |
| REM-03 | As a user, I copy a message to clipboard. | P0 | Yes |
| REM-04 | As a user, I regenerate messages. | P0 | Yes |
| REM-05 | As a user, I log a collection action (sent / draft). | P1 | Yes |
| REM-06 | As a system, I use template messages when OpenAI is not configured. | P0 | Yes |

**Acceptance criteria:**

- `POST /api/collections/reminders/generate` returns 2 strings  
- Messages reference customer name and overdue amount; professional tone  
- `POST /api/collections/actions` persists to `collection_actions`  
- No API keys exposed to frontend  

---

### Epic 7: Invoice ledger

| ID | User story | Priority | MVP |
|----|------------|----------|-----|
| INV-01 | As a user, I view all committed invoices in a searchable table. | P0 | Yes |
| INV-02 | As a user, I filter by payment status. | P1 | Yes |

**Acceptance criteria:**

- `GET /api/invoices` returns user-scoped list with outstanding and days_overdue  

---

### Epic 8: AI Copilot Chatbot

| ID | User story | Priority | MVP |
|----|------------|----------|-----|
| CHAT-01 | As a user, I can chat with an AI assistant embedded in the UI. | P0 | Yes |
| CHAT-02 | As a user, the AI understands my current financial metrics and high-risk customers without me typing them. | P0 | Yes |

**Acceptance criteria:**

- `POST /api/chat` receives user message, historical context, and UI-injected financial metrics.
- Returns AI generated text based on OpenAI LLM.

---

### Epic 9: Product-Led Onboarding

| ID | User story | Priority | MVP |
|----|------------|----------|-----|
| ONB-01 | As a new user, I receive a guided tour of the application upon first login. | P1 | Yes |
| ONB-02 | As a system, I remember if a user has completed the tour and do not show it again. | P1 | Yes |

**Acceptance criteria:**

- Uses `react-joyride` to highlight Sidebar, Ingest, Collections, and Chatbot.
- State stored in `localStorage`.

---

## 4. Functional requirements summary

| Module | Endpoints (MVP) |
|--------|-----------------|
| Auth | `POST /api/auth/signup`, `POST /api/auth/login`, `GET /api/auth/me` |
| Invoices | `POST /api/invoices/upload`, `POST /api/invoices/confirm`, `GET /api/invoices` |
| Dashboard | `GET /api/dashboard/summary`, `GET /api/dashboard/customers` |
| Collections | `POST /api/collections/reminders/generate`, `POST /api/collections/actions` |
| AI Chatbot | `POST /api/chat` |
| Health | `GET /api/health` |

---

## 5. Data model

### 5.1 Entities (MVP)

```
users
  ├── uploads
  │     └── invoices
  ├── customer_profiles  (aggregated per customer_name)
  └── collection_actions
```

### 5.2 Table purposes

| Table | Purpose |
|-------|---------|
| `users` | Authentication and business profile |
| `uploads` | Audit trail per ingestion batch |
| `invoices` | Line-level receivable records |
| `customer_profiles` | Aggregated metrics and priority/risk |
| `collection_actions` | Follow-up history |

---

## 6. Non-functional requirements

### 6.1 Security

| Requirement | Implementation |
|-------------|----------------|
| Password storage | bcrypt hashing |
| API auth | JWT Bearer, server-side secret |
| User isolation | `user_id` on all tenant tables |
| File upload limits | 10 MB max (configurable) |
| MIME / extension validation | CSV, XLSX, TXT only |
| SQL injection | SQLAlchemy parameterized queries |
| XSS | React escaping; security headers on API |
| Secrets | Environment variables only; never in frontend |

### 6.2 Performance (MVP targets)

| Scenario | Target |
|----------|--------|
| CSV upload (&lt; 1000 rows) | Preview &lt; 5 s |
| Dashboard load | &lt; 2 s |
| Reminder generation (templates) | &lt; 1 s |

### 6.3 Availability and deploy

- Runnable via Docker Compose (PostgreSQL + API + web)  
- Local dev via SQLite + uvicorn + Next.js dev server  

### 6.4 Accessibility and UX

- Responsive layout (mobile-friendly tables with horizontal scroll)  
- Dark and light themes  
- Loading states on async actions  
- Executive-style dashboard (Stripe / Linear inspiration)  

---

## 7. UI requirements

### 7.1 Pages

| Route | Purpose |
|-------|---------|
| `/` | Redirect to dashboard or login |
| `/login`, `/register` | Auth |
| `/dashboard` | Executive overview |
| `/upload` | Ingest + preview |
| `/collections` | Priority list + reminders |
| `/invoices` | Full ledger |

### 7.2 Global navigation

- Dashboard, Ingest Invoices, Collections Priority, All Invoices  
- Theme toggle, user info, logout  

---

## 8. AI / extraction policy

| Layer | Method | When |
|-------|--------|------|
| 1 | Pandas + column alias matching | CSV / XLSX |
| 2 | Regex / keyword heuristics | Pasted or TXT text |
| 3 | OpenAI JSON extraction | Only if layer 2 returns zero rows and API key set |
| Reminders | Template strings | Default |
| Reminders | OpenAI | Optional enhancement when API key set |

**Principle:** Deterministic logic is the source of truth; AI is assistive, not authoritative.

---

## 9. Release criteria (MVP sign-off)

- [ ] User can register, login, and access only own data  
- [ ] User can upload sample CSV and confirm import  
- [ ] Dashboard shows correct KPIs for sample data  
- [ ] Collections page ranks customers and generates 2 reminders  
- [ ] Copy and log actions work  
- [ ] App runs via documented local setup  
- [ ] Docker Compose builds and starts all services  
- [ ] No OpenAI key required for core demo path  

---

## 10. Open questions and future requirements

| ID | Question / future item | Target phase |
|----|------------------------|--------------|
| FQ-01 | WhatsApp Business API for send-in-app? | v2.0 |
| FQ-02 | Multi-user teams and roles? | v1.2 |
| FQ-03 | Tally / Zoho direct sync? | v1.2 |
| FQ-04 | PDF/OCR ingestion? | v2.x |
| FQ-05 | Payment link (Razorpay / UPI)? | v2.0 |
| FQ-06 | Email reminders? | v1.1 |
| FQ-07 | Export collections report PDF? | v1.1 |

---

## 11. Appendix

### 11.1 Sample test accounts

| Email | Password | Notes |
|-------|----------|-------|
| `demo@example.com` | `demo1234` | Created by `scripts/seed_sample_data.py` |

### 11.2 Sample data files

- `sample_data/invoices_sample.csv` — structured import test  
- `sample_data/unstructured_invoices.txt` — heuristic extraction test  

### 11.3 Glossary

| Term | Definition |
|------|------------|
| **Receivables** | Money owed to the business by customers |
| **Outstanding** | Invoice amount minus amount paid |
| **Aging** | Grouping overdue balances by days past due |
| **Priority score** | Ranking metric: sum of outstanding × overdue days |

---

## Document history

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | May 2026 | — | Initial MVP PRD aligned to shipped build |
