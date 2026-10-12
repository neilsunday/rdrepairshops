BEGIN;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'repair-attachments',
  'repair-attachments',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY repair_attachments_customer_upload_own_request
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'repair-attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND EXISTS (
    SELECT 1
    FROM public.repair_requests AS request
    WHERE request.id::text = (storage.foldername(name))[2]
      AND request.customer_id = auth.uid()
  )
);

CREATE POLICY repair_attachments_customer_read_own
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'repair-attachments'
  AND (
    app_private.is_owner()
    OR EXISTS (
      SELECT 1
      FROM public.repair_attachments AS attachment
      JOIN public.repair_requests AS request
        ON request.id = attachment.repair_request_id
      WHERE attachment.bucket_id = storage.objects.bucket_id
        AND attachment.object_path = storage.objects.name
        AND request.customer_id = auth.uid()
    )
  )
);

CREATE POLICY repair_attachments_customer_cleanup_unregistered_upload
ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'repair-attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND EXISTS (
    SELECT 1
    FROM public.repair_requests AS request
    WHERE request.id::text = (storage.foldername(name))[2]
      AND request.customer_id = auth.uid()
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.repair_attachments AS attachment
    WHERE attachment.bucket_id = storage.objects.bucket_id
      AND attachment.object_path = storage.objects.name
  )
);

CREATE FUNCTION app_private.guard_repair_attachment_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  request_customer_id uuid;
  attachment_count integer;
BEGIN
  IF COALESCE(auth.role() = 'service_role', false) OR app_private.is_owner() THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NULL OR NEW.uploaded_by IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Customers may only attach files to their own repair requests'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.bucket_id <> 'repair-attachments'
    OR NEW.content_type NOT IN ('image/jpeg', 'image/png', 'image/webp', 'image/heic')
    OR NEW.byte_size > 5242880
    OR array_length(string_to_array(NEW.object_path, '/'), 1) <> 3
    OR split_part(NEW.object_path, '/', 1) <> auth.uid()::text THEN
    RAISE EXCEPTION 'Repair attachment does not meet upload requirements'
      USING ERRCODE = '22023';
  END IF;

  SELECT request.customer_id
  INTO request_customer_id
  FROM public.repair_requests AS request
  WHERE request.id::text = split_part(NEW.object_path, '/', 2)
    AND request.id = NEW.repair_request_id
  FOR UPDATE;

  IF NOT FOUND OR request_customer_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Repair request does not belong to the current customer'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM storage.objects AS stored_object
    WHERE stored_object.bucket_id = NEW.bucket_id
      AND stored_object.name = NEW.object_path
  ) THEN
    RAISE EXCEPTION 'Repair photo must be uploaded before its metadata is saved'
      USING ERRCODE = '23503';
  END IF;

  SELECT count(*)
  INTO attachment_count
  FROM public.repair_attachments AS attachment
  WHERE attachment.repair_request_id = NEW.repair_request_id;

  IF attachment_count >= 5 THEN
    RAISE EXCEPTION 'A repair request may have no more than five photos'
      USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION app_private.guard_repair_attachment_insert()
FROM PUBLIC, anon, authenticated;

CREATE TRIGGER repair_attachment_insert_guard
BEFORE INSERT ON public.repair_attachments
FOR EACH ROW
EXECUTE FUNCTION app_private.guard_repair_attachment_insert();

CREATE OR REPLACE FUNCTION app_private.handle_auth_user_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, phone)
  VALUES (
    NEW.id,
    NEW.email,
    left(
      COALESCE(
        NULLIF(btrim(NEW.raw_user_meta_data ->> 'display_name'), ''),
        NULLIF(split_part(COALESCE(NEW.email, ''), '@', 1), ''),
        'Customer'
      ),
      160
    ),
    left(
      COALESCE(
        NULLIF(btrim(NEW.raw_user_meta_data ->> 'phone'), ''),
        NEW.phone
      ),
      40
    )
  );
  RETURN NEW;
END;
$function$;

COMMIT;
