# <img src="assets/Logo.png" alt="Wordler logo" width="22" height="22" /> Wordler

<p align="center">
  <img src="assets/WordlerAnimation.gif" alt="Wordler logo" width="200" height="200" />
</p>

<p align="center">
  <img alt="React" src="https://img.shields.io/badge/React-61DAFB?logo=react&logoColor=black" />
  <img alt="Vite" src="https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white" />
  <img alt="Tailwind CSS" src="https://img.shields.io/badge/Tailwind-06B6D4?logo=tailwindcss&logoColor=white" />
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-339933?logo=node.js&logoColor=white" />
  <img alt="Express" src="https://img.shields.io/badge/Express-000000?logo=express&logoColor=white" />
  <img alt="Playwright" src="https://img.shields.io/badge/Playwright-ff4154?logo=playwright&logoColor=white" />
  <img alt="GitHub Actions" src="https://img.shields.io/badge/GitHub%20Actions-2088FF?logo=githubactions&logoColor=white" />
  <img alt="Docker" src="https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white" />
  <img alt="Render" src="https://img.shields.io/badge/Render-20232A?logo=render&logoColor=white" />
  <img alt="Firebase" src="https://img.shields.io/badge/Firebase-FFCA28?logo=firebase&logoColor=black" />
</p>

A compact, practical Wordle solver and demo UI built with Vite, React and TypeScript. Wordler implements an entropy-based, deterministic solver that shows full decision steps and can optionally drive the official NYT Wordle using Playwright for live demos.


![Home screenshot](assets/HomeDark.png)

<p align="center">
  <a href="https://wordler-app.web.app" target="_blank" rel="noopener noreferrer">
    <img src="https://img.shields.io/badge/Open%20Deployed%20Site-Visit-blue?style=for-the-badge" alt="Open deployed site" />
  </a>
</p>

---

## Demos

- NYT Live Solve Desktop Demo 

<p align="center">
  <a href="https://drive.google.com/file/d/1yhkJDbxSnVDXb7AkX55RWUg8g0uDXv4A/view?usp=sharing" target="_blank" rel="noopener noreferrer">
    <img src="https://github.com/user-attachments/assets/d29b38d8-dd03-4deb-a106-2f70c9598f32" alt="NYT live demo" width="600" />
  </a>
</p>

- Simulation / Random Solve Mobile Demo

<p align="center">
  <a href="https://drive.google.com/file/d/1ga3iwcc8LCjjh_FnAvj6oEhtdc0C3nyq/view?usp=sharing" target="_blank" rel="noopener noreferrer">
    <img src="https://github.com/user-attachments/assets/5039ee3e-03b1-42a0-b2ec-9f5056c39bef" alt="NYT live demo" width="600" />
  </a>
</p>

---

## Introduction

Wordler runs a solver engine that:

- Keeps a candidate answer set consistent with observed (guess, pattern) pairs.
- Scores potential guesses by expected information (entropy) across remaining candidates.
- Picks the highest-scoring guess (with reduced-pool fallbacks when candidate sets are large for performance).

The UI shows each guess, the G/Y/B pattern, remaining candidate count, and optional rationale logs.

---

## Frameworks & Tools

- **Frontend:** React, Vite, TypeScript, Tailwind CSS
- **Server:** Node, Express, Playwright (Chromium) for automation
- **Dev & Deployment:** Docker (Playwright base), Render (API host), Git, GitHub Actions (CI/CD)
- **Firebase:** Authentication, Firestore (Database), Hosting, Firebase CLI, Web App

---

## Features & Modules

 - **Smart entropy-based solver:** deterministic, explains each guess and shows remaining candidates.
 - **Flexible wordlist handling:** frontend lazy-loads canonical lists with a fast local fallback so the solver runs identically on client or server.
 - **Fast, practical scoring:** reduced-pool heuristics for performance on large candidate sets and a sensible first-guess policy.
 - **NYT integration:** server-side Playwright automation enabled using Docker containerization with a realtime SSE stream the frontend consumes for logs, per-guess updates and final results; successful solves are persisted per ET day (Firestore for signed-in users, localStorage otherwise).
 - **Wordle usage history:** the app records past solves and attempts and displays them in a History view (persisted to Firestore per-user or localStorage for anonymous users).
 - **UI theme toggles:** built-in light/dark theme switch with persisted user preference for a consistent experience across sessions.
 - **Server:** exposes canonical wordlists and a realtime SSE endpoint for live solves; packaged as a Docker image (Playwright base) for reliable deployments on Render or any Docker host.
 - **CI/CD:** GitHub Actions workflows build the frontend and deploy to Firebase Hosting on push.

---

## Screenshots

![NYT](assets/NYT.png)

![Random](assets/Random.png)

![History](assets/History.png)

![Sign Up](assets/SignUp.png)

---

## Installation

Prerequisites: Node 18+ and npm.

Create file ```.env``` and point the frontend at a dev backend using an explicit env override:

```powershell
$env:VITE_API_BASE = 'http://localhost:4000' # Inside .env file
```

PowerShell quick start (frontend):
```powershell
npm install
npm run playwright:install # Installs Playwright browsers
npm run dev:full
```

Open http://localhost:5173

If you prefer to run the server using Docker (recommended for Playwright compatibility):

```powershell
npm install
npm run dev

# build the server image (from project root)
docker build -t wordler-server ./server -f server/Dockerfile

# run the server (exposes port 4000)
docker run --rm -p 4000:4000 \
  -e PORT=4000 \
  -e CORS_ORIGIN='http://localhost:5173' \
  wordler-server
```

### Firebase Setup

To use Authentication and Firestore locally you must create a Firebase project and register a web app:

1. Go to the Firebase console and create a new Project.
2. In Project Settings -> Your apps, add a Web app and copy the Firebase config values.
3. Add those config values as environment variables (or to a `.env` file) for the frontend. Typical env names used by this project are:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MEASUREMENT_ID` (optional)

Without these values Authentication and Firestore features will not work. For safe local development you can also run the Firebase Emulators (Auth + Firestore) and point your app at the emulators using the Firebase CLI and emulator host/port overrides.

Firebase checklist:

- In the Firebase Console enable Authentication and add the Email/Password sign-in provider so users can sign up and sign in.
- Create and enable a Firestore Database for the project.

### Project Layout

```
src/                 # Frontend app (Vite + React + TS)
  lib/solver.ts      # Core solver
  lib/wordleTypes.ts
pages/
components/

server/              # Playwright-backed server
  index.ts           # Express endpoints (nyt-sse, wordlists)
```

---

## Troubleshooting & Feedback

- If Playwright fails to launch locally, use the provided Docker image (Playwright base) which bundles required browsers and system libraries.
- If SSE shows stale puzzles occasionally, the server attempts to clear SW/storage/caches; redeploy or restart the server if the issue persists.
- Thanks for trying Wordler! Open to feedback