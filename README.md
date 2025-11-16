# Wordler

Vite + React + TypeScript app that demonstrates an entropy-based Wordle solving algorithm, shows step-by-step reasoning, and lays groundwork for Playwright automation against the official NYT Wordle.

## Features
- Deterministic solver (no ML) using information gain (entropy) + candidate filtering.
- Displays each guess, pattern feedback (G/Y/B), and remaining candidate count.
- Light/Dark theme toggle (Tailwind).
- Local history (last 50 solves) with a History page.
- Backend automation endpoints using Playwright (/api/nyt-sse for streaming and /api/nyt-solve).

## Getting Started

```powershell
npm install
npm run dev
```

Open http://localhost:5173.

## Solver Logic
1. Maintain candidate answer set consistent with all prior (guess, pattern) pairs.
2. For each potential guess, compute pattern distribution over remaining candidates and its entropy: \(H = -\sum p_i \log_2 p_i\).
3. Pick guess with highest entropy (expected information). Use a reduced pool when >50 candidates for speed.
4. First guess hard-coded to `ROATE` (high letter coverage) — can be precomputed.
5. Stop when guess equals answer or safety turn limit exceeded.

Patterns: `g` (green), `y` (yellow), `b` (gray). We convert guess vs candidate to a pattern and ensure consistency when filtering.

## Planned Enhancements
- Full allowed/answer lists (current truncated sample).
- Smarter pruning (use full candidate set for scoring when small; fallback to allowed list for mid-game). 
- Precompute entropy table for first move.
- Playwright: automatically dismiss modals, input guesses, capture board images, map colors back to patterns.
- Supabase Postgres: store daily results and expose REST or RPC endpoints.
- Server-side API endpoints (Express or Fastify or Vite plugin) if remote storage used.
- Scheduling: Use a hosted cron (GitHub Actions / Supabase Edge Functions / Cloudflare Workers Cron) to run daily solve.

## Directory Layout
```
src/
  lib/solver.ts         # Core solver
  lib/wordleTypes.ts    # Types
  lib/data/*.json       # Word lists
  components/ThemeToggle.tsx
  pages/App.tsx         # Main solve UI
  pages/History.tsx     # Local history UI

```

## Supabase Data Model (Future)
Table: `solves`
```
id uuid (primary)
date date
answer text
tries int
success boolean
steps jsonb  -- array of { guess, pattern, remaining }
created_at timestamptz default now()
```

Env vars (future):
```
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY= (server side only)
```

## Theme Implementation
Uses Tailwind `dark` class on `<html>` with localStorage persistence and media query fallback.

## License / Word Lists
Word lists here are a truncated demonstration subset. Replace with a permitted open-source English 5-letter corpus (e.g. from wordfreq or ENABLE list) for production use.

## Scripts
```powershell
npm run dev              # Start app
npm run build            # Production build
npm run preview          # Preview build
npm run playwright:install  # Install browsers

```

## Contributing
Feel free to expand the solver heuristics or integrate Supabase. Add tests (Vitest/Jest) for solver correctness before major changes.
