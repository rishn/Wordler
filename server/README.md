# Wordler NYT Solver Server

Express server that streams live NYT Wordle solving via Server-Sent Events (SSE), using Playwright.

## Endpoints

- `GET /api/health` — Health check
- `GET /api/nyt-sse` — SSE stream of live solving (events: `log`, `step`, `complete`, `error`)
- `GET /api/nyt-solve` — One-shot solve returning JSON

## Deploy to Render (Free Tier)

1. Commit this `server/` folder to a Git repository (Render needs a repo).
2. In Render, create a new **Web Service**:
   - Select your repo
   - Root directory: `server`
   - Runtime: Node
   - Environment: `Node 18+`
   - Build Command:
     ```bash
     npm install && npx playwright install --with-deps && npm run build
     ```
   - Start Command:
     ```bash
     npm start
     ```
   - Add Environment Variables (recommended):
     - `CORS_ORIGIN` = `https://<your-firebase-app>.web.app`
3. Save and Deploy. First cold start may take up to a minute while browsers install.

## Local Development

```bash
# from server/
npm install
npm run dev
# Server listens on http://localhost:4000
```

To test SSE locally, set the client env `VITE_API_BASE=http://localhost:4000` and run the frontend dev server.

## Notes
- This service uses Playwright with the bundled Chromium.
- On free platforms, cold starts are expected; the client UI shows a friendly message while waking up.
- Set `CORS_ORIGIN` to your Firebase Hosting origin to restrict cross-origin access.
