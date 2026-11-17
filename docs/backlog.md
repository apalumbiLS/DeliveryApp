# Backlog

Work that is planned but not finished. Things deliberately left out of the MVP live in [Deferred work](architecture/12-deferred-and-extension-points.md) instead.

## Driver flow

- **Payout rule.** Driver payout defaults to 90% of the sizing fee plus the mileage fee, and the dispatcher can change it until a driver accepts. That 90% is a placeholder that still needs deliberate configuration. It lives in `default_driver_payout_cents` (`supabase/migrations/0013_driver_jobs.sql`), and the console prefills the same figure.
- **Declining a job.** Drivers can only accept a job for now. Still to build: a Decline button, reporting each decline to the dispatcher, and flagging the order "nobody available" once every driver has declined ([07-dispatch](architecture/07-dispatch.md)).
- **Job texts.** No text message goes out to drivers yet. The dispatcher copies the job link from the console instead. Twilio and US carrier (A2P 10DLC) registration are still needed.
