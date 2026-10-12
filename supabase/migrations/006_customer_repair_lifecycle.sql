BEGIN;

ALTER TABLE public.repair_requests
  ADD COLUMN completed_at timestamptz,
  ADD COLUMN retention_cleanup_started_at timestamptz;

UPDATE public.repair_requests
SET completed_at = COALESCE(updated_at, submitted_at, now())
WHERE status = 'completed';

CREATE FUNCTION app_private.set_repair_completed_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $function$
BEGIN
  IF NEW.status = 'completed' THEN
    IF TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'completed' THEN
      NEW.completed_at := now();
    ELSE
      NEW.completed_at := OLD.completed_at;
    END IF;
  ELSE
    NEW.completed_at := NULL;
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION app_private.set_repair_completed_at()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER repair_requests_set_completed_at
BEFORE INSERT OR UPDATE OF status ON public.repair_requests
FOR EACH ROW EXECUTE FUNCTION app_private.set_repair_completed_at();

CREATE OR REPLACE FUNCTION app_private.guard_repair_request_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $function$
DECLARE
  is_trusted boolean :=
    COALESCE(auth.role() = 'service_role', false) OR app_private.is_owner();
BEGIN
  IF is_trusted THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authenticated customer or trusted owner required'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.customer_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Customers may only delete their own repair requests'
        USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.retention_cleanup_started_at IS NOT NULL THEN
    RAISE EXCEPTION 'This repair request is being permanently removed after its retention period'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.customer_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Customers may only create their own repair requests'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.service_id IS NULL THEN
      NEW.service_name_snapshot := 'Other / not listed';
    ELSE
      SELECT service.name
      INTO NEW.service_name_snapshot
      FROM public.repair_services AS service
      WHERE service.id = NEW.service_id
        AND service.status = 'active';
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Selected service is not active or does not exist'
          USING ERRCODE = '23503';
      END IF;
    END IF;
    NEW.reference_number := 'R-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
    NEW.status := 'submitted';
    NEW.priority := 'normal';
    NEW.submitted_at := now();
    NEW.updated_at := now();
    NEW.assigned_technician_id := NULL;
    NEW.customer_visible_note := NULL;
    NEW.completed_at := NULL;
    NEW.retention_cleanup_started_at := NULL;
    RETURN NEW;
  END IF;

  IF OLD.customer_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Customers may only update their own repair requests'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.reference_number IS DISTINCT FROM OLD.reference_number
    OR NEW.customer_id IS DISTINCT FROM OLD.customer_id
    OR NEW.status IS DISTINCT FROM OLD.status
    OR NEW.priority IS DISTINCT FROM OLD.priority
    OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at
    OR NEW.updated_at IS DISTINCT FROM OLD.updated_at
    OR NEW.assigned_technician_id IS DISTINCT FROM OLD.assigned_technician_id
    OR NEW.customer_visible_note IS DISTINCT FROM OLD.customer_visible_note
    OR NEW.completed_at IS DISTINCT FROM OLD.completed_at
    OR NEW.retention_cleanup_started_at IS DISTINCT FROM OLD.retention_cleanup_started_at THEN
    RAISE EXCEPTION 'Customers cannot change repair status, assignment, reference, retention, or staff updates'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.service_id IS DISTINCT FROM OLD.service_id THEN
    IF NEW.service_id IS NULL THEN
      NEW.service_name_snapshot := 'Other / not listed';
    ELSE
      SELECT service.name
      INTO NEW.service_name_snapshot
      FROM public.repair_services AS service
      WHERE service.id = NEW.service_id
        AND service.status = 'active';
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Selected service is not active or does not exist'
          USING ERRCODE = '23503';
      END IF;
    END IF;
  ELSE
    NEW.service_name_snapshot := OLD.service_name_snapshot;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION app_private.guard_repair_request_write()
  FROM PUBLIC, anon, authenticated;

CREATE POLICY repair_requests_customer_delete_own ON public.repair_requests
FOR DELETE TO authenticated
USING (customer_id = auth.uid());
GRANT DELETE ON TABLE public.repair_requests TO authenticated;

DROP POLICY repair_requests_owner_all ON public.repair_requests;
CREATE POLICY repair_requests_owner_select_all ON public.repair_requests
FOR SELECT TO authenticated
USING (app_private.is_owner());
CREATE POLICY repair_requests_owner_insert_all ON public.repair_requests
FOR INSERT TO authenticated
WITH CHECK (app_private.is_owner());
CREATE POLICY repair_requests_owner_update_all ON public.repair_requests
FOR UPDATE TO authenticated
USING (app_private.is_owner())
WITH CHECK (app_private.is_owner());

CREATE FUNCTION public.claim_completed_repairs_for_cleanup(p_limit integer DEFAULT 50)
RETURNS TABLE (id uuid, reference_number text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
BEGIN
  IF NOT COALESCE(auth.role() = 'service_role', false) THEN
    RAISE EXCEPTION 'Service role is required to claim repair cleanup'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH due AS (
    SELECT request.id
    FROM public.repair_requests AS request
    WHERE request.status = 'completed'
      AND request.completed_at <= now() - interval '2 days'
      AND (
        request.retention_cleanup_started_at IS NULL
        OR request.retention_cleanup_started_at < now() - interval '15 minutes'
      )
    ORDER BY request.completed_at, request.id
    FOR UPDATE SKIP LOCKED
    LIMIT greatest(1, least(COALESCE(p_limit, 50), 100))
  )
  UPDATE public.repair_requests AS request
  SET retention_cleanup_started_at = now()
  FROM due
  WHERE request.id = due.id
  RETURNING request.id, request.reference_number;
END;
$function$;
REVOKE ALL ON FUNCTION public.claim_completed_repairs_for_cleanup(integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_completed_repairs_for_cleanup(integer)
  TO service_role;

ALTER TABLE public.repair_status_history
  ADD COLUMN repair_reference_snapshot text,
  ADD COLUMN client_name_snapshot text,
  ADD COLUMN device_snapshot text;
ALTER TABLE public.repair_internal_notes
  ADD COLUMN repair_reference_snapshot text,
  ADD COLUMN client_name_snapshot text,
  ADD COLUMN device_snapshot text;

UPDATE public.repair_status_history AS history
SET repair_reference_snapshot = request.reference_number,
    client_name_snapshot = request.customer_name,
    device_snapshot = concat_ws(' ', request.brand, request.model)
FROM public.repair_requests AS request
WHERE request.id = history.repair_request_id;

UPDATE public.repair_internal_notes AS note
SET repair_reference_snapshot = request.reference_number,
    client_name_snapshot = request.customer_name,
    device_snapshot = concat_ws(' ', request.brand, request.model)
FROM public.repair_requests AS request
WHERE request.id = note.repair_request_id;

ALTER TABLE public.repair_status_history
  ALTER COLUMN repair_request_id DROP NOT NULL,
  DROP CONSTRAINT repair_status_history_repair_request_id_fkey,
  ADD CONSTRAINT repair_status_history_repair_request_id_fkey
    FOREIGN KEY (repair_request_id)
    REFERENCES public.repair_requests(id) ON DELETE SET NULL;
ALTER TABLE public.repair_internal_notes
  ALTER COLUMN repair_request_id DROP NOT NULL,
  DROP CONSTRAINT repair_internal_notes_repair_request_id_fkey,
  ADD CONSTRAINT repair_internal_notes_repair_request_id_fkey
    FOREIGN KEY (repair_request_id)
    REFERENCES public.repair_requests(id) ON DELETE SET NULL;

CREATE FUNCTION app_private.snapshot_repair_logs_before_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
BEGIN
  UPDATE public.repair_status_history
  SET repair_reference_snapshot = OLD.reference_number,
      client_name_snapshot = OLD.customer_name,
      device_snapshot = concat_ws(' ', OLD.brand, OLD.model)
  WHERE repair_request_id = OLD.id;

  UPDATE public.repair_internal_notes
  SET repair_reference_snapshot = OLD.reference_number,
      client_name_snapshot = OLD.customer_name,
      device_snapshot = concat_ws(' ', OLD.brand, OLD.model)
  WHERE repair_request_id = OLD.id;

  RETURN OLD;
END;
$function$;
REVOKE ALL ON FUNCTION app_private.snapshot_repair_logs_before_delete()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER repair_requests_snapshot_logs_before_delete
BEFORE DELETE ON public.repair_requests
FOR EACH ROW EXECUTE FUNCTION app_private.snapshot_repair_logs_before_delete();
GRANT EXECUTE ON FUNCTION app_private.snapshot_repair_logs_before_delete()
  TO service_role;

DROP POLICY repair_attachments_customer_cleanup_unregistered_upload
  ON storage.objects;
CREATE POLICY repair_attachments_customer_delete_own_request
ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'repair-attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND array_length(storage.foldername(name), 1) = 3
  AND EXISTS (
    SELECT 1
    FROM public.repair_requests AS request
    WHERE request.id::text = (storage.foldername(name))[2]
      AND request.customer_id = auth.uid()
  )
);

COMMIT;
