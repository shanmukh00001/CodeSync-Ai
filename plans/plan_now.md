# Hands-Free Deployment Plan — CodeSync AI

## Goal
The app must run 24/7 with the laptop fully powered off. That means **zero**
dependency on anything running on `localhost` — no Ollama, no local Piston,
no tunnel of any kind.

## Why tunneling doesn't solve this
Cloudflared / ngrok / localtunnel only forward traffic to your laptop —
they don't move the computation anywhere. The laptop still has to be on,
awake, and online, and it's still capped at whatever a 16GB machine can run
(~7B–8B models). This plan skips tunneling entirely.

## Target architecture
| Layer | Where it runs | Cost |
|---|---|---|
| Frontend | Vercel or Netlify | Free |
| Backend | Render or Railway | Free tier |
| Database | MongoDB Atlas | Already cloud |
| AI model | Groq API (cloud) | Free tier |
| Code execution | Public Piston API | Free |

## Step-by-step

### 1. Get free API keys
- **Groq** (`console.groq.com`) — no credit card. Free tier is roughly
  30 requests/minute, with per-model daily caps (up to ~14,400 req/day on
  some models). Models available include Llama 3.3 70B, Qwen3, GPT-OSS and
  Llama 4 Scout — all far more capable than anything a laptop can run
  locally, and hosted on Groq's hardware so there's zero load on your
  machine.
- **Google AI Studio / Gemini** (`aistudio.google.com`) — keep as a backup
  provider. Gemini 2.5 Flash: 500 req/day at 15 RPM. Gemini 2.0 Flash:
  1,500 req/day at 15 RPM.

### 2. Replace Ollama with Groq in the backend
- Swap calls from `http://localhost:11434` to Groq's OpenAI-compatible
  endpoint: `https://api.groq.com/openai/v1/chat/completions`.
- New env vars: `AI_PROVIDER=groq`, `GROQ_API_KEY=...`,
  `GROQ_MODEL=llama-3.3-70b-versatile` (or another supported model).
- Optional: add a fallback to Gemini if a Groq call 429s, so the app
  degrades gracefully instead of failing.

### 3. Replace local Piston with the public Piston API
- `PISTON_URL=https://emkc.org/api/v2/piston`
- Remove any remaining references to `http://127.0.0.1:2000`.

### 4. Centralize the frontend API URL
```js
// src/config/api.js
export const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
```
Replace every hardcoded `http://localhost:5000/...` call with
`API_BASE_URL`.

### 5. Fix cross-domain cookies (backend)
```js
res.cookie("token", token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
});
```
Also confirm CORS is set with `credentials: true` and `origin: CLIENT_URL`.

### 6. Deploy
- **Backend → Render/Railway**: set `MONGO_URI`, `JWT_SECRET`, `CLIENT_URL`,
  `PISTON_URL`, `AI_PROVIDER`, `GROQ_API_KEY`.
- **Frontend → Vercel/Netlify**: set `VITE_API_URL` to the deployed backend URL.

### 7. Test with the laptop fully shut down
- Auth flow (JWT cookie, Google OAuth, OTP email)
- Problem submission → Piston execution
- AI hint/review → Groq response
- Confirm everything still works with the laptop powered off — this is the
  real test of "hands-free."

## Rate-limit safety net
- Groq free tier caps at ~30 req/min; daily limits vary by model.
- If you hit a 429, fall back to Gemini, or add light per-user rate
  limiting in the app so you stay under the provider's ceiling.

## What to avoid
- Cloudflare Tunnel, ngrok, localtunnel — these keep the laptop as the
  compute source, which defeats the goal.
- Any production env var pointing at `127.0.0.1` or `localhost`.