BEGIN;

CREATE TABLE public.repair_completion_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_number bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  record_count smallint NOT NULL DEFAULT 10 CHECK (record_count = 10),
  downloaded_at timestamptz,
  downloaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  cleanup_authorized_at timestamptz,
  cleanup_authorized_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT completion_batch_download_before_cleanup
    CHECK (
      (downloaded_at IS NULL AND downloaded_by IS NULL
          AND cleanup_authorized_at IS NULL)
        OR
        (downloaded_at IS NOT NULL AND cleanup_authorized_at IS NOT NULL)
    )
);

COMMENT ON TABLE public.repair_completion_batches IS
  'Tracks groups of ten completion proofs and owner-confirmed downloads before retention cleanup.';
COMMENT ON TABLE public.repair_completion_proofs IS
  'Temporary owner-only report records, deleted with completed requests after a full downloaded and approved batch reaches its 48-hour retention.';

ALTER TABLE public.repair_completion_proofs
  ADD COLUMN batch_id uuid REFERENCES public.repair_completion_batches(id),
  ADD COLUMN cleanup_started_at timestamptz;

CREATE INDEX repair_completion_proofs_batch_idx
  ON public.repair_completion_proofs (batch_id, completed_at);

ALTER TABLE public.repair_completion_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY repair_completion_batches_owner_select
ON public.repair_completion_batches
FOR SELECT TO authenticated
USING (app_private.is_owner());

REVOKE ALL ON TABLE public.repair_completion_batches
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.repair_completion_batches TO authenticated;
GRANT SELECT, UPDATE ON TABLE public.repair_completion_batches TO service_role;
GRANT SELECT, UPDATE, DELETE ON TABLE public.repair_completion_proofs
  TO service_role;

CREATE FUNCTION public.stage_ready_completion_proof_batches()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  proof_ids uuid[];
  new_batch_id uuid;
  staged_count integer := 0;
BEGIN
  IF NOT COALESCE(auth.role() = 'service_role', false)
    AND NOT app_private.is_owner() THEN
    RAISE EXCEPTION 'Owner access is required to prepare completion reports'
      USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(720081210, 10);

  LOOP
    SELECT array_agg(ready.id ORDER BY ready.completed_at, ready.id)
    INTO proof_ids
    FROM (
      SELECT proof.id, proof.completed_at
      FROM public.repair_completion_proofs AS proof
      WHERE proof.batch_id IS NULL
      ORDER BY proof.completed_at, proof.id
      FOR UPDATE SKIP LOCKED
      LIMIT 10
    ) AS ready;

    IF COALESCE(cardinality(proof_ids), 0) < 10 THEN
      EXIT;
    END IF;

    INSERT INTO public.repair_completion_batches DEFAULT VALUES
    RETURNING id INTO new_batch_id;

    UPDATE public.repair_completion_proofs
    SET batch_id = new_batch_id
    WHERE id = ANY(proof_ids);

    staged_count := staged_count + 1;
  END LOOP;

  RETURN staged_count;
END;
$function$;
REVOKE ALL ON FUNCTION public.stage_ready_completion_proof_batches()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.stage_ready_completion_proof_batches()
  TO authenticated, service_role;

CREATE FUNCTION public.authorize_completion_proof_cleanup(p_batch_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  authorized_count integer;
  requested_count integer;
BEGIN
  IF NOT app_private.is_owner() THEN
    RAISE EXCEPTION 'Owner access is required to authorize repair cleanup'
      USING ERRCODE = '42501';
  END IF;

  requested_count := COALESCE(cardinality(p_batch_ids), 0);
  IF requested_count = 0 THEN
    RAISE EXCEPTION 'Select at least one downloaded completion batch'
      USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(720081210, 10);

  WITH eligible AS (
    SELECT batch.id
    FROM public.repair_completion_batches AS batch
    WHERE batch.id = ANY(p_batch_ids)
      AND batch.cleanup_authorized_at IS NULL
      AND (
        SELECT count(*)
        FROM public.repair_completion_proofs AS proof
        WHERE proof.batch_id = batch.id
      ) = 10
    FOR UPDATE
  )
  UPDATE public.repair_completion_batches AS batch
  SET downloaded_at = now(),
      downloaded_by = auth.uid(),
      cleanup_authorized_at = now(),
      cleanup_authorized_by = auth.uid()
  FROM eligible
  WHERE batch.id = eligible.id;

  GET DIAGNOSTICS authorized_count = ROW_COUNT;
  IF authorized_count <> requested_count THEN
    RAISE EXCEPTION 'One or more completion batches are unavailable or incomplete; refresh the report'
      USING ERRCODE = '40001';
  END IF;

  RETURN authorized_count;
END;
$function$;
REVOKE ALL ON FUNCTION public.authorize_completion_proof_cleanup(uuid[])
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.authorize_completion_proof_cleanup(uuid[])
  TO authenticated;

DROP FUNCTION public.claim_completed_repairs_for_cleanup(integer);

CREATE FUNCTION public.claim_completed_repairs_for_cleanup(p_limit integer DEFAULT 50)
RETURNS TABLE (
  proof_id uuid,
  repair_request_id uuid,
  reference_number text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
BEGIN
  IF NOT COALESCE(auth.role() = 'service_role', false) THEN
    RAISE EXCEPTION 'Service role is required to claim repair cleanup'
      USING ERRCODE = '42501';
  END IF;

  PERFORM public.stage_ready_completion_proof_batches();

  RETURN QUERY
  WITH due AS (
    SELECT proof.id AS proof_id, proof.repair_request_id, proof.batch_id
    FROM public.repair_completion_proofs AS proof
    JOIN public.repair_completion_batches AS batch
      ON batch.id = proof.batch_id
    WHERE batch.cleanup_authorized_at IS NOT NULL
      AND proof.completed_at <= now() - interval '2 days'
      AND (
        proof.cleanup_started_at IS NULL
        OR proof.cleanup_started_at < now() - interval '15 minutes'
      )
      AND (
        proof.repair_request_id IS NULL
        OR EXISTS (
          SELECT 1
          FROM public.repair_requests AS request
          WHERE request.id = proof.repair_request_id
            AND request.status = 'completed'
        )
      )
    ORDER BY proof.completed_at, proof.id
    FOR UPDATE OF proof SKIP LOCKED
    LIMIT greatest(1, least(COALESCE(p_limit, 50), 100))
  ),
  claimed AS (
    UPDATE public.repair_completion_proofs AS proof
    SET cleanup_started_at = now()
    FROM due
    WHERE proof.id = due.proof_id
    RETURNING proof.id, proof.repair_request_id, proof.reference_number
  ),
  marked_requests AS (
    UPDATE public.repair_requests AS request
    SET retention_cleanup_started_at = now()
    FROM claimed
    WHERE request.id = claimed.repair_request_id
    RETURNING request.id
  )
  SELECT
    claimed.id,
    claimed.repair_request_id,
    claimed.reference_number
  FROM claimed
  LEFT JOIN marked_requests
    ON marked_requests.id = claimed.repair_request_id
  WHERE claimed.repair_request_id IS NULL
    OR marked_requests.id IS NOT NULL;
END;
$function$;
REVOKE ALL ON FUNCTION public.claim_completed_repairs_for_cleanup(integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_completed_repairs_for_cleanup(integer)
  TO service_role;

COMMIT;
