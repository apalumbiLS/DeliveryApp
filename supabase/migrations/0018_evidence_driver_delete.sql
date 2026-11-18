-- 0018_evidence_driver_delete.sql — a driver can remove a photo that never
-- became part of the job.
--
-- The driver app uploads a receipt or delivery photo, then records the step.
-- When recording fails, the upload is left behind with nothing pointing at it.
-- This lets the driver who uploaded it delete it again, only while they are
-- still at a photo step on that job (the same window the upload policy
-- allows), and only while no attachment row references it: a photo the job
-- recorded stays put. `owner_id` is set by Storage from the uploader's token,
-- so after a reassignment one driver cannot delete another's files.
--
-- Never edit 0001_baseline.sql; it is frozen. See
-- docs/architecture/03-data-model.md#migrations.

create policy evidence_driver_delete on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'evidence'
    and owner_id = auth.uid()::text
    and exists (
      select 1 from public.orders o
       where o.id::text = (storage.foldername(name))[1]
         and o.assigned_driver_id = auth.uid()
         and o.status in ('driver_at_store', 'en_route')
         and public.is_driver()
    )
    and not exists (
      select 1 from public.attachments a
       where a.storage_path = storage.objects.name
    )
  );
