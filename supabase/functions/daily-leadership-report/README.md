# Daily leadership report deployment

The function queries only active employee profiles and check-ins for the organisation whose admin-configured recipients it is processing. It uses stored `sentiment_score` values and never assigns scores to missing check-ins. The PDF is assembled server-side as a compact, multi-page PDF; employee names, moods, support requests, and leadership messages are included in the attachment, so keep the recipient list tightly controlled.

## Deploy

1. Apply `supabase/migrations/202610120001_daily_leadership_reports.sql` in the Supabase SQL Editor after confirming the existing `profiles` columns used by the policy. It adds three report-specific tables and does not alter check-in scoring, historical Energy data, or existing policies.
2. Set Edge Function secrets (values must be supplied privately): `REPORT_CRON_SECRET` (at least 32 random bytes), `REPORT_FROM_EMAIL` (verified Resend sender), and the already configured `RESEND_API_KEY`. Supabase provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to Edge Functions; never copy the service key into the frontend or SQL scheduler.
3. Deploy with Supabase CLI: `supabase functions deploy daily-leadership-report`. Keep JWT verification enabled. The schedule sends the project anon key as the normal Supabase JWT/API key plus the separate secret header checked by the function.
4. In Supabase SQL Editor, confirm the `pg_cron`, `pg_net`, and Vault extensions are available/enabled. Create a random cron secret locally and store it in Vault without pasting it into source control:

   ```sql
   select vault.create_secret('<random-secret>', 'vibe_daily_report_cron_secret', 'Daily report function authentication');
   ```

5. Replace `<PROJECT_REF>` and `<SUPABASE_ANON_KEY>` below with the project URL and public anon key from Supabase project settings. The anon key is not a service credential. Run once to schedule 13:35 UTC (19:05 IST):

   ```sql
   select cron.schedule(
     'vibe-daily-leadership-report',
     '35 13 * * *',
     $job$
       select net.http_post(
         url := 'https://<PROJECT_REF>.supabase.co/functions/v1/daily-leadership-report',
         headers := jsonb_build_object(
           'Content-Type', 'application/json',
           'Authorization', 'Bearer <SUPABASE_ANON_KEY>',
           'apikey', '<SUPABASE_ANON_KEY>',
           'x-vibe-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'vibe_daily_report_cron_secret' limit 1)
         ),
         body := '{}'::jsonb
       );
     $job$
   );
   ```

   Check with `select * from cron.job;` and review `cron.job_run_details` after the next run. To remove the schedule, run `select cron.unschedule('vibe-daily-leadership-report');`.

## Verification

- Run the pure Edge Function unit checks where Deno is installed: `deno test supabase/functions/daily-leadership-report/index_test.ts`. They cover the India business-date boundary, the report's prior working date, and PDF header/xref/trailer plus string escaping.
- Sign in as an active VIBE admin and add/remove a controlled test address on `/admin/reports`. Confirm an employee cannot select or mutate `daily_report_recipients` under RLS.
- Invoke the function without `x-vibe-cron-secret` and confirm HTTP 401. Invoke it with the secret through a controlled admin-only operational procedure or wait for the cron run; do not send employee reports to an unapproved test address.
- Check `daily_report_deliveries` for status and attempt count. A unique `(organization_id, report_date)` claim prevents duplicate sends. An empty list is logged as `no_recipients` and sends nothing. A failed row can be claimed once by a later invocation; sent, no-recipient, or currently sending rows are not resent. To authorize a deliberate retry of an already processed report, an authorised operator must explicitly delete that single delivery row after approval, then invoke the function through the trusted scheduler path.
- Check Resend delivery status and verify the attachment opens as a PDF. This checkout cannot verify a deployed Supabase project, live Resend delivery, or the `vibe-test-email` function configuration.

## Operational notes

The scheduled function relies on the observed `profiles` and `check_ins` columns plus the `signals` fields used in the existing admin service (`organization_id`, `type`, `date_detected`, `status`, and employee/check-in references). Confirm these against the production database before deployment. No signal query fallback is used: schema mismatch fails the report safely and records a brief error. The current implementation logs one attempt per invocation and does not log employee content.

The report sends one email per organisation recipient group. Resend's current Free plan lists 3,000 emails/month and a 100/day limit; an organisation with more than 100 recipients could exceed the daily cap. Supabase lists 500,000 Edge Function invocations on Free and a 150-second wall-clock function limit; the function processes organisations sequentially, so large deployments may need batching. Confirm current Cron/pg_net and attachment limits before production use. No billing tier or unlimited usage is assumed.
