# VIBE — Daily Employee Pulse

A mobile-first employee daily check-in. One minute. One pulse. A better workplace.

## Run locally

Requirements: Node.js 18+ (Node 20+ recommended) and npm.

```bash
npm install
npm run dev
```

Authentication and check-in storage currently run in the browser for frontend development. Accounts and completed check-ins are stored in local storage. This temporary implementation is not production authentication or shared organization storage: records are available only in the browser that submitted them. The `/admin` preview is available in development for reviewing that device's actual check-ins; it is not protected by backend admin roles. The auth and check-in services are isolated so they can later be replaced by Supabase without changing the page components. No Supabase project or environment variables are required.

## Vercel

SPA routing is handled by `vercel.json`.

## Current phase

- Frontend account creation, sign-in, password reset and sign-out
- Persistent session restore and protected employee routes
- Check-in answers persisted locally and used by the development admin analytics/signals
- Existing four-step check-in UI

## Next build phases

1. Supabase authentication, employee profiles, roles, and Row Level Security
2. Shared backend check-in persistence and organization-wide aggregation
3. Rotating/adaptive questions
4. Sentiment scoring and trend engine
5. 4-day persistent low-sentiment alerts
6. HR management dashboard
7. Production hardening
