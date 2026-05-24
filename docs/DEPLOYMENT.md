# Deployment Guide — MSME Collections Copilot

This guide covers the recommended ways to deploy the MVP: **Docker Compose on a VPS** (simplest full stack) and **split hosting** (e.g. Railway / Render). For local development, see the [README](../README.md).

---

## Architecture (production)

```
                    ┌─────────────────┐
   Browser ────────▶│  Next.js :3000  │  (frontend container)
                    │  proxies /api/* │
                    └────────┬────────┘
                             │ internal Docker network
                    ┌────────▼────────┐
                    │ FastAPI :8000   │  (backend container)
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │ PostgreSQL      │  (db container)
                    └─────────────────┘
```

Users only need to reach the **frontend** port (or HTTPS via a reverse proxy). The Next.js server forwards `/api/*` to the backend inside Docker.

---

## Option A: Docker Compose (recommended)

Best for: a single VPS (DigitalOcean, Hetzner, AWS EC2, Linode), or any machine with Docker installed.

### 1. Prerequisites

- Docker Engine 24+ and Docker Compose v2  
- A server with at least **1 GB RAM** (2 GB recommended)  
- Optional: domain name pointed at the server  

### 2. Prepare environment file

On the server, clone the repo and create `.env` from the production template:

```bash
git clone <your-repo-url> msme-copilot
cd msme-copilot
cp .env.production.example .env
```

Edit `.env` and set **strong** values:

```bash
# Generate two secrets (run twice)
openssl rand -hex 32

POSTGRES_PASSWORD=<strong-db-password>
JWT_SECRET=<random-hex>
SECRET_KEY=<random-hex>

# Your public site URL(s) — required if browser talks to API directly; include for split deploys
CORS_ORIGINS=https://your-domain.com,http://your-server-ip:3000
```

`OPENAI_API_KEY` is optional; reminders and text extraction work without it.

### 3. Build and start

```bash
docker compose up --build -d
```

Check status:

```bash
docker compose ps
docker compose logs -f backend
```

### 4. Verify

| URL | Expected |
|-----|----------|
| `http://<server-ip>:3000` | Login page |
| `http://<server-ip>:8000/api/health` | `{"status":"healthy",...}` |
| `http://<server-ip>:8000/docs` | Swagger UI |

### 5. Seed demo data (optional)

```bash
docker compose exec backend python scripts/seed_sample_data.py
```

Login: `demo@example.com` / `demo1234`

### 6. HTTPS with Nginx (recommended for production)

Install Nginx and Certbot on the host. Example server block (terminates SSL, proxies to frontend):

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

Update `.env`:

```env
CORS_ORIGINS=https://your-domain.com
```

Restart backend:

```bash
docker compose up -d backend
```

Do **not** expose port `8000` publicly if the frontend proxies API traffic; only expose `3000` (or 443 via Nginx).

### 7. Updates

```bash
git pull
docker compose up --build -d
```

### 8. Backups (PostgreSQL)

```bash
docker compose exec db pg_dump -U postgres msme_copilot > backup_$(date +%F).sql
```

Restore:

```bash
cat backup.sql | docker compose exec -T db psql -U postgres msme_copilot
```

---

## Option B: Cloud PaaS (Railway / Render / Fly.io)

Deploy three components: **PostgreSQL**, **backend**, **frontend**.

### Backend service

| Setting | Value |
|---------|--------|
| Start command | `uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT` |
| Root directory | repository root |
| Build | `pip install -r requirements.txt` |

Environment variables:

```env
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/dbname
DATABASE_URL_SYNC=postgresql://user:pass@host:5432/dbname
JWT_SECRET=<random>
SECRET_KEY=<random>
CORS_ORIGINS=https://your-frontend-url.vercel.app
OPENAI_API_KEY=<optional>
```

Use the platform’s **managed Postgres** plugin and copy the connection string into both `DATABASE_URL` values (async vs sync URLs as shown above).

### Frontend service

| Setting | Value |
|---------|--------|
| Root | `frontend/` |
| Build command | `npm install && npm run build` |
| Start command | `npm run start` |

**Important:** Set build-time env so Next.js rewrites reach your public API:

```env
API_URL=https://your-backend-url.railway.app
```

On Vercel, set `API_URL` in project environment variables before build, or configure `rewrites` in `next.config.js` to your backend URL.

Users open the **frontend URL** only. The browser never needs the backend URL if rewrites work.

### Database migrations

MVP uses `create_all` on backend startup. For production at scale, run Alembic migrations against `DATABASE_URL_SYNC` when you add real migration scripts.

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

uvicorn backend.app.main:app --host 0.0.0.0 --port 8000
```

Use **systemd** or **supervisor** to keep uvicorn running.

### Frontend

```bash
cd frontend
export API_URL=http://127.0.0.1:8000   # before build
npm install
npm run build
npm run start
```

Put Nginx in front of both, or proxy only port 3000 and set `API_URL` to the internal backend address.

---

## Environment variable reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes (prod) | Async SQLAlchemy URL (`postgresql+asyncpg://...` or `sqlite+aiosqlite://...`) |
| `DATABASE_URL_SYNC` | For Alembic | Sync URL for migrations |
| `JWT_SECRET` | Yes | Signs access tokens |
| `SECRET_KEY` | Yes | App secret |
| `CORS_ORIGINS` | Yes (prod) | Comma-separated browser origins |
| `OPENAI_API_KEY` | No | LLM extraction / reminder polish |
| `POSTGRES_*` | Docker only | Used by `docker-compose.yml` for Postgres container |
| `API_URL` | Frontend build | Target for Next.js `/api` rewrites (Docker: `http://backend:8000`) |

---

## Security checklist (production)

- [ ] Replace all default passwords and `JWT_SECRET` / `SECRET_KEY`  
- [ ] Use HTTPS on the public domain  
- [ ] Restrict `CORS_ORIGINS` to your real frontend URL(s)  
- [ ] Do not commit `.env` to git  
- [ ] Do not expose Postgres port `5432` to the internet  
- [ ] Prefer exposing only frontend (or Nginx on 443), not raw `:8000`  
- [ ] Rotate secrets if they were ever committed or shared  

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|--------|-----|
| `Set JWT_SECRET in .env` on compose up | Missing secrets | Fill `.env` from `.env.production.example` |
| Login works locally but API 404 in Docker | Wrong `API_URL` at frontend **build** | Rebuild frontend with `API_URL=http://backend:8000` (compose does this automatically) |
| CORS errors in browser | Backend blocks origin | Add your site to `CORS_ORIGINS`, restart backend |
| Empty dashboard after deploy | Fresh DB | Register user or run seed script |
| `Address already in use` :8000 | Another process on port | `lsof -i :8000` and stop it, or change `BACKEND_PORT` |
| Backend starts before DB ready | Race on first boot | `docker compose` waits for DB healthcheck; retry `docker compose up -d` |

---

## Related docs

- [README](../README.md) — local development  
- [PRD](./PRD.md) — product requirements  
- [Product Overview](./PRODUCT_OVERVIEW.md) — scope and roadmap  
