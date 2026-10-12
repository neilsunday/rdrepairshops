BEGIN;

CREATE TABLE public.client_notebook_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name text NOT NULL CHECK (length(btrim(client_name)) BETWEEN 1 AND 160),
  client_phone text CHECK (client_phone IS NULL OR length(client_phone) <= 80),
  client_email text CHECK (
    client_email IS NULL OR (
      length(client_email) <= 320
      AND client_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    )
  ),
  entry_type text NOT NULL CHECK (entry_type IN ('purchase', 'repair', 'other')),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
  details text CHECK (details IS NULL OR length(details) <= 8000),
  amount numeric(10, 2) CHECK (amount IS NULL OR amount >= 0),
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.client_notebook_entries IS
  'Private owner notebook for client purchases, repairs, services, and other business notes.';

CREATE INDEX client_notebook_entries_date_idx
  ON public.client_notebook_entries (entry_date DESC, created_at DESC);
CREATE INDEX client_notebook_entries_client_idx
  ON public.client_notebook_entries (lower(client_name), entry_date DESC);

CREATE FUNCTION app_private.guard_client_notebook_entry_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $function$
BEGIN
  IF NOT app_private.is_owner() THEN
    RAISE EXCEPTION 'Owner access is required to change notebook entries'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.created_by := auth.uid();
    NEW.created_at := now();
  ELSE
    NEW.created_by := OLD.created_by;
    NEW.created_at := OLD.created_at;
  END IF;

  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION app_private.guard_client_notebook_entry_write()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER client_notebook_entries_guard_write
BEFORE INSERT OR UPDATE ON public.client_notebook_entries
FOR EACH ROW EXECUTE FUNCTION app_private.guard_client_notebook_entry_write();

CREATE TRIGGER client_notebook_entries_set_updated_at
BEFORE UPDATE ON public.client_notebook_entries
FOR EACH ROW EXECUTE FUNCTION app_private.set_updated_at();

ALTER TABLE public.client_notebook_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY client_notebook_entries_owner_all
ON public.client_notebook_entries
FOR ALL TO authenticated
USING (app_private.is_owner())
WITH CHECK (app_private.is_owner());

REVOKE ALL ON TABLE public.client_notebook_entries FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.client_notebook_entries TO authenticated;

COMMIT;
