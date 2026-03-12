-- Person photo: path in storage (Supabase Storage bucket person-photos or similar).
-- Upload/URL logic in n8n; frontend only sends file to n8n and displays URL.
ALTER TABLE public.persons
  ADD COLUMN IF NOT EXISTS photo_path text;

COMMENT ON COLUMN public.persons.photo_path IS 'Path in storage (e.g. Supabase Storage bucket) for employee photo. Format and bucket configured in n8n.';
