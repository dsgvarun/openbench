-- OpenBench v1 — resume storage (Phase 2.1)
-- Private bucket. Resumes are NEVER public. Candidates own their folder; revealed
-- companies receive a short-lived signed URL minted server-side after the reveal is
-- re-checked (the app does that, not a broad storage policy).
--
-- Supabase-specific (storage.* schema) — skipped by the PGLite validator, verified
-- against a live project. Files are stored at: {auth.uid}/{filename}.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'resumes', 'resumes', false,
  10485760, -- 10 MB (PRD §6.1)
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', -- .docx
    'text/plain'
  ]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Owner-only access: the first path segment must be the caller's auth uid.
create policy "resume_owner_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "resume_owner_select" on storage.objects for select to authenticated
  using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "resume_owner_update" on storage.objects for update to authenticated
  using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "resume_owner_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);
