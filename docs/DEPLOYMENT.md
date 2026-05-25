# Deployment Guide — MSME Collections Copilot

This guide covers three deployment scenarios:

1. **[Vercel + Render](#option-a-vercel--render-recommended-for-saas)** — *recommended for SaaS*  
   Frontend (Vercel) + Backend (Render) + Managed PostgreSQL (Neon / Supabase / Render)
2. **[Docker Compose](#option-b-docker-compose)** — single VPS
3. **[Manual VPS](#option-c-manual-vps-without-docker)**

---

## Architecture

```
                               ┌─────────────────────┐
  Browser (user) ─────────────▶│  Vercel (Next.js)   │  HTTPS
                               │  https://app.example │
                               └──────────┬──────────┘
                                          │ API calls (CORS)
                               ┌──────────▼──────────┐
                               │  Render (FastAPI)   │  HTTPS
                               │  https://api.example │
                               └──────────┬──────────┘
                                          │
                               ┌──────────▼──────────┐
                               │  PostgreSQL          │
                               │  (Neon / Supabase)   │
                               └─────────────────────┘
```

Users visit the **Vercel URL**. The Next.js frontend calls the backend API directly via `NEXT_PUBLIC_API_URL`.

---

## Option A: Vercel + Render (recommended for SaaS)

### 1. Database — Neon / Supabase / Render PostgreSQL

Create a PostgreSQL instance on your provider of choice. Copy the **connection string** — you need two forms:

| Form | Example |
|------|---------|
| Async | `postgresql+asyncpg://user:pass@host:5432/dbname` |
| Sync | `postgresql://user:pass@host:5432/dbname` |

> **Note:** Neon and Supabase use `-pooler` connection strings for pooled connections. Use the **direct** (non-pooled) URL for the sync string and the **pooled** URL for the async string.

### 2. Backend — Render Web Service

Create a new **Web Service** on Render. Use the following settings:

| Setting | Value |
|---------|-------|
| **Build Command** | `pip install -r requirements.txt` |
| **Start Command** | `uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT` |
| **Health Check Path** | `/api/health` |
| **Plan** | Starter or higher |

Add these **Environment Variables**:

```env
ENVIRONMENT=production
DEBUG=false
LOG_LEVEL=INFO
DATABASE_URL=postgresql+asyncpg://...
DATABASE_URL_SYNC=postgresql://...
JWT_SECRET=<generate: python3 -c "import secrets; print(secrets.token_hex(32))">
SECRET_KEY=<generate: python3 -c "import secrets; print(secrets.token_hex(32))">
CORS_ORIGINS=https://your-frontend.vercel.app
OPENAI_API_KEY=            # optional
```

> Render automatically sets `PORT`. The start command uses `$PORT` to bind to the right port.

### 3. Frontend — Vercel

Deploy the `frontend/` directory to Vercel. Use these settings:

| Setting | Value |
|---------|-------|
| **Framework** | Next.js |
| **Root Directory** | `frontend/` |
| **Build Command** | `npm run build` |
| **Output Directory** | `.next` |

Add this **Environment Variable** at build time:

```env
NEXT_PUBLIC_API_URL=https://your-backend.onrender.com
```

> ⚠️ `NEXT_PUBLIC_API_URL` is **required** for Vercel + Render. It tells the frontend where to send API requests. The Next.js rewrites are **disabled** when this variable is set.

### 4. Verify

| URL | Expected |
|-----|----------|
| `https://your-frontend.vercel.app` | Login page loads |
| `https://your-backend.onrender.com/api/health` | `{"status":"healthy",...}` |
| `https://your-backend.onrender.com/docs` | Swagger UI |

### 5. Seed demo data (optional)

```bash
# Run from a local terminal or Render Shell:
python scripts/seed_sample_data.py
```

Login with `demo@example.com` / `demo1234`.

---

## Option B: Docker Compose

Best for a single VPS (DigitalOcean, Hetzner, AWS EC2, Linode).

### Prerequisites

- Docker Engine 24+ and Docker Compose v2
- At least 1 GB RAM (2 GB recommended)

### Setup

```bash
git clone <your-repo-url> msme-copilot
cd msme-copilot
cp .env.production.example .env
```

Edit `.env` and set strong secrets:

```bash
openssl rand -hex 32   # run twice for JWT_SECRET and SECRET_KEY

POSTGRES_PASSWORD=<strong-db-password>
JWT_SECRET=<random-hex-64-chars>
SECRET_KEY=<random-hex-64-chars>
CORS_ORIGINS=https://your-domain.com,http://localhost:3000
```

### Build and start

```bash
docker compose up --build -d
```

### Verify

| URL | Expected |
|-----|----------|
| `http://<server-ip>:3000` | Login page |
| `http://<server-ip>:8000/api/health` | `{"status":"healthy",...}` |
| `http://<server-ip>:8000/docs` | Swagger UI |

### HTTPS with Nginx

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate     /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Backups

```bash
docker compose exec db pg_dump -U postgres msme_copilot > backup_$(date +%F).sql
```

---

## Option C: Manual VPS (without Docker)

### Backend

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

export DATABASE_URL=postgresql+asyncpg://...
export JWT_SECRET=...
export SECRET_KEY=...
export CORS_ORIGINS=https://your-domain.com

uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --workers 2
```

Use **systemd** or **supervisor** to keep uvicorn running.

### Frontend

```bash
cd frontend
export NEXT_PUBLIC_API_URL=http://127.0.0.1:8000   # or public backend URL
npm install
npm run build
npm run start
```

---

## Environment variable reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes (prod) | `sqlite+aiosqlite:///msme_agent.db` | Async SQLAlchemy URL (`postgresql+asyncpg://...`) |
| `DATABASE_URL_SYNC` | Alembic | `sqlite:///msme_agent.db` | Sync URL for migrations |
| `JWT_SECRET` | Yes | `insecure-dev-only-...` | Signs access tokens — **must be random in production** |
| `SECRET_KEY` | Yes | `insecure-dev-only-...` | App secret — **must be random in production** |
| `CORS_ORIGINS` | Yes | `http://localhost:3000,...` | Comma-separated browser origins allowed to call the API |
| `ENVIRONMENT` | No | `development` | `development` or `production` |
| `LOG_LEVEL` | No | `INFO` | `DEBUG`, `INFO`, `WARNING`, `ERROR` |
| `OPENAI_API_KEY` | No | `""` | LLM extraction / reminder polish (optional) |
| `NEXT_PUBLIC_API_URL` | Vercel | `""` | Public backend URL for direct API calls |
| `API_URL` | Docker | `http://127.0.0.1:8000` | Backend URL for Next.js rewrites (Docker only) |

---

## Security checklist

- [ ] Replace all default passwords and `JWT_SECRET` / `SECRET_KEY` with strong random values
- [ ] Use HTTPS on the public domain (Vercel provides this automatically)
- [ ] Restrict `CORS_ORIGINS` to your real frontend URL(s)
- [ ] Never commit `.env` to git (`.gitignore` already excludes it)
- [ ] Never expose PostgreSQL port `5432` to the internet
- [ ] Prefer exposing only the frontend (port 443), not the raw API port
- [ ] Rotate secrets if they were ever committed or shared
- [ ] Ensure `ENVIRONMENT=production` in production (enables config validation)

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Set JWT_SECRET in .env` on compose up | Missing secrets | Fill `.env` from `.env.production.example` |
| API calls fail with CORS errors | Backend blocks origin | Add your site to `CORS_ORIGINS`, restart backend |
| Empty dashboard after deploy | Fresh DB | Register a user or run the seed script |
| Frontend shows "Failed to fetch" in production | `NEXT_PUBLIC_API_URL` not set | Add the env var in Vercel dashboard and redeploy |
| Backend starts but DB queries fail | Wrong `DATABASE_URL` | Verify the async driver: `postgresql+asyncpg://...` |
| `Address already in use` | Port conflict | Change `BACKEND_PORT` or stop the process on that port |
| 429 Too Many Requests | Rate limit hit | Login/signup are limited to 5-10 req/min per IP by default |

---

## Related docs

- [README](../README.md) — local development
- [PRD](./PRD.md) — product requirements
- [Product Overview](./PRODUCT_OVERVIEW.md) — scope and roadmap