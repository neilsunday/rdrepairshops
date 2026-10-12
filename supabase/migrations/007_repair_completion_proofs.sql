BEGIN;

CREATE TABLE public.repair_completion_proofs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repair_request_id uuid UNIQUE
    REFERENCES public.repair_requests(id) ON DELETE SET NULL,
  reference_number text NOT NULL UNIQUE,
  customer_name text NOT NULL,
  customer_email text,
  customer_phone text,
  device_type text NOT NULL,
  brand text NOT NULL,
  model text NOT NULL,
  reported_issue text NOT NULL,
  service_name text NOT NULL,
  submitted_at timestamptz NOT NULL,
  completed_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.repair_completion_proofs IS
  'Owner-only completion snapshots retained after repair requests and photos are removed.';

CREATE INDEX repair_completion_proofs_completed_idx
  ON public.repair_completion_proofs (completed_at DESC);

ALTER TABLE public.repair_completion_proofs ENABLE ROW LEVEL SECURITY;
CREATE POLICY repair_completion_proofs_owner_select
ON public.repair_completion_proofs
FOR SELECT TO authenticated
USING (app_private.is_owner());

REVOKE ALL ON TABLE public.repair_completion_proofs
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.repair_completion_proofs TO authenticated;

CREATE FUNCTION app_private.capture_repair_completion_proof()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
BEGIN
  INSERT INTO public.repair_completion_proofs (
    repair_request_id,
    reference_number,
    customer_name,
    customer_email,
    customer_phone,
    device_type,
    brand,
    model,
    reported_issue,
    service_name,
    submitted_at,
    completed_at
  )
  VALUES (
    NEW.id,
    NEW.reference_number,
    NEW.customer_name,
    NEW.customer_email,
    NEW.customer_phone,
    NEW.device_type,
    NEW.brand,
    NEW.model,
    NEW.reported_issue,
    NEW.service_name_snapshot,
    NEW.submitted_at,
    COALESCE(NEW.completed_at, now())
  )
  ON CONFLICT (reference_number) DO UPDATE
  SET repair_request_id = EXCLUDED.repair_request_id,
      customer_name = EXCLUDED.customer_name,
      customer_email = EXCLUDED.customer_email,
      customer_phone = EXCLUDED.customer_phone,
      device_type = EXCLUDED.device_type,
      brand = EXCLUDED.brand,
      model = EXCLUDED.model,
      reported_issue = EXCLUDED.reported_issue,
      service_name = EXCLUDED.service_name,
      submitted_at = EXCLUDED.submitted_at,
      completed_at = EXCLUDED.completed_at;

  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION app_private.capture_repair_completion_proof()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER repair_requests_capture_completion_proof
AFTER UPDATE OF status ON public.repair_requests
FOR EACH ROW
WHEN (NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed')
EXECUTE FUNCTION app_private.capture_repair_completion_proof();

INSERT INTO public.repair_completion_proofs (
  repair_request_id,
  reference_number,
  customer_name,
  customer_email,
  customer_phone,
  device_type,
  brand,
  model,
  reported_issue,
  service_name,
  submitted_at,
  completed_at
)
SELECT
  id,
  reference_number,
  customer_name,
  customer_email,
  customer_phone,
  device_type,
  brand,
  model,
  reported_issue,
  service_name_snapshot,
  submitted_at,
  COALESCE(completed_at, updated_at, submitted_at, now())
FROM public.repair_requests
WHERE status = 'completed';

COMMIT;
