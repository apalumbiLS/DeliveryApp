# Backlog

Work that is planned but not finished. Things deliberately left out of the MVP live in [Deferred work](architecture/12-deferred-and-extension-points.md) instead.

## Driver flow

- **Payout rule.** Driver payout defaults to 90% of the sizing fee plus the mileage fee, and the dispatcher can change it until a driver accepts. That 90% is a placeholder that still needs deliberate configuration. It lives in `default_driver_payout_cents` (`supabase/migrations/0013_driver_jobs.sql`), and the console prefills the same figure.
- **Declining a job.** Drivers can only accept a job for now. Still to build: a Decline button, reporting each decline to the dispatcher, and flagging the order "nobody available" once every driver has declined ([07-dispatch](architecture/07-dispatch.md)).
- **Job texts.** No text message goes out to drivers yet. The dispatcher copies the job link from the console instead. Twilio and US carrier (A2P 10DLC) registration are still needed.

## Before launch

- **Production logs.** Make sure server logs never carry sensitive data: customer contact details, addresses, tokens, keys or raw email bodies. Review every `console.*` call and what the host keeps. One example to check: `approveOrder` in `web/app/portal/orders/actions.ts` logs the database error and order id when an approval fails.
- **Security and privilege pass.** Before real customers, review every RLS policy, every `security definer` function's role checks, the storage bucket policies, server actions that skip a role check, and use of the secret key ([10-auth-and-permissions](architecture/10-auth-and-permissions.md)).
