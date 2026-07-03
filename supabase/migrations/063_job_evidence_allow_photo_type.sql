-- 063_job_evidence_allow_photo_type.sql
--
-- Defensive: connectDb.uploadCheckoutEvidence used to insert type='photo'
-- which silently failed the job_evidence_type_check constraint (allowed
-- list never had 'photo' — only before_photo / after_photo / signature /
-- note / timestamp). The frontend was patched to 'after_photo' but cached
-- bundles in users' browsers still send 'photo'. Allow it so cached
-- clients keep working until they refresh.
--
-- If 'photo' is ever confirmed gone from every deployed bundle, a later
-- migration can drop it back to the original five-value list.

alter table public.job_evidence
  drop constraint if exists job_evidence_type_check;

alter table public.job_evidence
  add constraint job_evidence_type_check
  check (type = any (array[
    'before_photo',
    'after_photo',
    'photo',
    'signature',
    'note',
    'timestamp'
  ]));
