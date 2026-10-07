# VIBE — Daily Employee Pulse

A mobile-first employee daily check-in and workplace sentiment application.

## Run locally

Requirements: Node.js 18+ (Node 20+ recommended) and npm.

```bash
npm install
npm run dev
```

The application uses Supabase Authentication and the Supabase database. Configure the Vite environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` for the target project. Never place a service-role key in the browser.

## Current application

- Supabase sign-up, sign-in, session restoration, password recovery, and sign-out
- Database-backed profiles and role-protected employee and admin routes
- Daily employee check-ins stored in `check_ins`, using the `Asia/Kolkata` business date
- Admin overview, employee analytics, and signal views backed by Supabase
- Vercel SPA routing configured in `vercel.json`

Database schema, triggers, and Row Level Security policies are not included in this repository. Before production use, verify the schema assumptions and policies in the connected Supabase project, including the per-user/per-business-date unique check-in constraint and organization-scoped access policies.
