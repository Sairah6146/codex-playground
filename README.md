# codex-playground
First Agent 

## Resonance Mapper (Vite + React frontend, Node backend proxy)

The `frontend/` directory is a Vite + React app for "The Resonance Mapper".
It never talks to `api.anthropic.com` directly — it calls the backend's
`POST /api/resonance` route, which holds the Anthropic API key server-side
and proxies the request.

### Run it locally

1. Backend (repo root):
   ```bash
   cp .env.example .env      # then put your key in .env
   npm install
   npm start                 # http://localhost:3000
   ```
2. Frontend (separate terminal):
   ```bash
   cd frontend
   npm install
   npm run dev                # http://localhost:5173
   ```

Open http://localhost:5173 — Vite proxies any `/api/*` request to the
backend on port 3000 (see `frontend/vite.config.js`), so no CORS setup is
needed and the browser never sees the API key.

### Where the API key goes

Put your real key in a `.env` file at the **repo root** (not inside
`frontend/`):

```
ANTHROPIC_API_KEY=sk-ant-...
```

`.env` is git-ignored; `.env.example` (checked in) shows the expected shape
with no real key. The backend loads it via `dotenv` in `src/server.js` and
reads it only in `src/resonanceClient.js` — it is never sent to the browser.
