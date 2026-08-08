-- SPEC-08 proof of payment storage and DB safeguards.

ALTER TABLE public.proof_files
  ADD COLUMN IF NOT EXISTS original_name text;

CREATE OR REPLACE FUNCTION public.enforce_proof_file_limit() RETURNS trigger AS $$
BEGIN
  IF (
    SELECT count(*)
    FROM public.proof_files pf
    WHERE pf.installment_item_id = NEW.installment_item_id
  ) >= 3 THEN
    RAISE EXCEPTION 'Maximum 3 proof files allowed per item.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_enforce_proof_file_limit ON public.proof_files;
CREATE TRIGGER trg_enforce_proof_file_limit
  BEFORE INSERT ON public.proof_files
  FOR EACH ROW EXECUTE PROCEDURE public.enforce_proof_file_limit();

CREATE OR REPLACE FUNCTION public.proof_storage_installment_id(p_name text) RETURNS uuid AS $$
  SELECT NULLIF((storage.foldername(p_name))[1], '')::uuid;
$$ LANGUAGE sql STABLE SET search_path = public, storage;

CREATE OR REPLACE FUNCTION public.proof_storage_item_id(p_name text) RETURNS uuid AS $$
  SELECT NULLIF((storage.foldername(p_name))[2], '')::uuid;
$$ LANGUAGE sql STABLE SET search_path = public, storage;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'proofs',
  'proofs',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']::text[];

DROP POLICY IF EXISTS proof_objects_select_member ON storage.objects;
DROP POLICY IF EXISTS proof_objects_insert_member ON storage.objects;
DROP POLICY IF EXISTS proof_objects_delete_uploader_owner ON storage.objects;

CREATE POLICY proof_objects_select_member ON storage.objects FOR SELECT USING (
  bucket_id = 'proofs'
  AND public.is_installment_member(public.proof_storage_installment_id(name))
);

CREATE POLICY proof_objects_insert_member ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'proofs'
  AND public.is_installment_member(public.proof_storage_installment_id(name))
  AND EXISTS (
    SELECT 1
    FROM public.installment_items ii
    WHERE ii.id = public.proof_storage_item_id(name)
      AND ii.installment_id = public.proof_storage_installment_id(name)
  )
);

CREATE POLICY proof_objects_delete_uploader_owner ON storage.objects FOR DELETE USING (
  bucket_id = 'proofs'
  AND EXISTS (
    SELECT 1
    FROM public.proof_files pf
    JOIN public.installment_items ii ON ii.id = pf.installment_item_id
    WHERE pf.file_url = storage.objects.name
      AND (
        pf.uploaded_by = auth.uid()
        OR public.has_installment_role(ii.installment_id, ARRAY['owner']::member_role[])
      )
  )
);
