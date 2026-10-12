-- R&D Cellphone Repair initial database schema.
-- Review existing Supabase objects before applying. This migration intentionally
-- uses non-idempotent CREATE statements so name conflicts fail instead of being
-- silently accepted or overwritten. It does not alter Supabase Storage objects.

BEGIN;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
CREATE SCHEMA app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA app_private TO authenticated;
GRANT USAGE ON SCHEMA app_private TO service_role;

CREATE TYPE public.app_role AS ENUM ('owner', 'admin', 'customer');
CREATE TYPE public.customer_account_status AS ENUM ('inquiry_only', 'active', 'inactive');
CREATE TYPE public.repair_service_status AS ENUM ('active', 'draft', 'inactive');
CREATE TYPE public.repair_status AS ENUM (
  'submitted',
  'inspecting',
  'awaiting_approval',
  'approved',
  'in_progress',
  'ready_for_pickup',
  'completed',
  'cancelled'
);
CREATE TYPE public.repair_priority AS ENUM ('low', 'normal', 'high', 'urgent');
CREATE TYPE public.repair_post_status AS ENUM ('draft', 'published', 'archived');
CREATE TYPE public.comment_moderation_status AS ENUM ('pending', 'approved', 'rejected', 'hidden');
CREATE TYPE public.reaction_type AS ENUM ('like');
CREATE TYPE public.activity_entity_type AS ENUM (
  'repair_request',
  'customer_profile',
  'repair_service',
  'repair_post',
  'comment',
  'notification',
  'system'
);

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  display_name text NOT NULL DEFAULT 'Customer' CHECK (length(btrim(display_name)) BETWEEN 1 AND 160),
  phone text CHECK (phone IS NULL OR length(phone) <= 40),
  account_status public.customer_account_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.profiles IS 'Private profile details for Supabase Auth users. Role assignment is stored separately.';

CREATE TABLE public.user_roles (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  PRIMARY KEY (user_id, role)
);
COMMENT ON TABLE public.user_roles IS 'Trusted role assignments. No browser role-assignment policy is provided; provision the owner manually.';

CREATE TABLE public.repair_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (length(btrim(slug)) BETWEEN 1 AND 120),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 180),
  category text NOT NULL CHECK (length(btrim(category)) BETWEEN 1 AND 120),
  description text NOT NULL DEFAULT '' CHECK (length(description) <= 2000),
  status public.repair_service_status NOT NULL DEFAULT 'active',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.repair_services IS 'Public readers may see active catalog records; writes are owner-only.';

CREATE TABLE public.repair_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_number text NOT NULL UNIQUE DEFAULT (
    'R-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))
  ),
  customer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  customer_name text NOT NULL CHECK (length(btrim(customer_name)) BETWEEN 1 AND 160),
  customer_email text CHECK (customer_email IS NULL OR length(customer_email) <= 320),
  customer_phone text CHECK (customer_phone IS NULL OR length(customer_phone) <= 40),
  device_type text NOT NULL CHECK (length(btrim(device_type)) BETWEEN 1 AND 100),
  brand text NOT NULL CHECK (length(btrim(brand)) BETWEEN 1 AND 100),
  model text NOT NULL CHECK (length(btrim(model)) BETWEEN 1 AND 160),
  reported_issue text NOT NULL CHECK (length(btrim(reported_issue)) BETWEEN 1 AND 5000),
  service_id uuid REFERENCES public.repair_services(id) ON DELETE SET NULL,
  service_name_snapshot text NOT NULL CHECK (length(btrim(service_name_snapshot)) BETWEEN 1 AND 180),
  status public.repair_status NOT NULL DEFAULT 'submitted',
  priority public.repair_priority NOT NULL DEFAULT 'normal',
  submitted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  assigned_technician_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_visible_note text CHECK (customer_visible_note IS NULL OR length(customer_visible_note) <= 4000),
  CONSTRAINT repair_requests_contact_required CHECK (
    nullif(btrim(customer_email), '') IS NOT NULL OR nullif(btrim(customer_phone), '') IS NOT NULL
  )
);
COMMENT ON TABLE public.repair_requests IS 'Private repair intake. Internal notes are deliberately normalized into repair_internal_notes.';
COMMENT ON COLUMN public.repair_requests.service_name_snapshot IS 'Preserves the service label used at intake if a catalog entry is later renamed or removed.';

CREATE TABLE public.repair_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repair_request_id uuid NOT NULL REFERENCES public.repair_requests(id) ON DELETE CASCADE,
  from_status public.repair_status,
  to_status public.repair_status NOT NULL,
  customer_message text CHECK (customer_message IS NULL OR length(customer_message) <= 4000),
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.repair_status_history IS 'Customer-visible, append-only status transitions created by a trusted trigger.';

CREATE TABLE public.repair_internal_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repair_request_id uuid NOT NULL REFERENCES public.repair_requests(id) ON DELETE CASCADE,
  note text NOT NULL CHECK (length(btrim(note)) BETWEEN 1 AND 8000),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.repair_internal_notes IS 'Owner-only notes, isolated so customers cannot read them through repair request rows.';

CREATE TABLE public.repair_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repair_request_id uuid NOT NULL REFERENCES public.repair_requests(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  bucket_id text NOT NULL DEFAULT 'repair-attachments' CHECK (bucket_id = 'repair-attachments'),
  object_path text NOT NULL CHECK (length(btrim(object_path)) BETWEEN 1 AND 1024),
  original_filename text NOT NULL CHECK (length(btrim(original_filename)) BETWEEN 1 AND 255),
  content_type text NOT NULL CHECK (length(content_type) BETWEEN 1 AND 160),
  byte_size bigint NOT NULL CHECK (byte_size > 0),
  alt_text text CHECK (alt_text IS NULL OR length(alt_text) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bucket_id, object_path)
);
COMMENT ON TABLE public.repair_attachments IS 'Private file metadata. Storage object authorization is separately configured on storage.objects.';

CREATE TABLE public.repair_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 240),
  caption text NOT NULL DEFAULT '' CHECK (length(caption) <= 10000),
  service_id uuid REFERENCES public.repair_services(id) ON DELETE SET NULL,
  status public.repair_post_status NOT NULL DEFAULT 'draft',
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT published_posts_need_timestamp CHECK (status <> 'published' OR published_at IS NOT NULL)
);
COMMENT ON TABLE public.repair_posts IS 'Only published posts are readable by anonymous visitors.';

CREATE TABLE public.post_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.repair_posts(id) ON DELETE CASCADE,
  bucket_id text NOT NULL DEFAULT 'showcase-media' CHECK (bucket_id = 'showcase-media'),
  object_path text NOT NULL CHECK (length(btrim(object_path)) BETWEEN 1 AND 1024),
  sort_order integer NOT NULL DEFAULT 0,
  alt_text text NOT NULL CHECK (length(btrim(alt_text)) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bucket_id, object_path)
);
COMMENT ON TABLE public.post_media IS 'Media metadata linked to showcase posts; bucket access is separately controlled by Storage policies.';

CREATE TABLE public.post_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.repair_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction public.reaction_type NOT NULL DEFAULT 'like',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id, reaction)
);
COMMENT ON TABLE public.post_reactions IS 'Authenticated reactions only. Public clients receive aggregate counts, not actor rows.';

CREATE TABLE public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.repair_posts(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  author_name_snapshot text NOT NULL CHECK (length(btrim(author_name_snapshot)) BETWEEN 1 AND 160),
  body text NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 4000),
  status public.comment_moderation_status NOT NULL DEFAULT 'pending',
  moderated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  moderated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT comment_moderation_pair CHECK (
    (status = 'pending' AND moderated_at IS NULL AND moderated_by IS NULL)
    OR (status IN ('approved', 'rejected', 'hidden') AND moderated_at IS NOT NULL)
  )
);
COMMENT ON TABLE public.comments IS 'Authenticated customers may submit pending comments on published posts; owner moderates.';

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_type text NOT NULL CHECK (length(btrim(notification_type)) BETWEEN 1 AND 120),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 240),
  body text NOT NULL DEFAULT '' CHECK (length(body) <= 4000),
  related_entity_type public.activity_entity_type,
  related_entity_id uuid,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.notifications IS 'Private recipient-scoped notifications; the dashboard recipient will be the provisioned owner.';

CREATE TABLE public.business_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  business_name text NOT NULL DEFAULT '' CHECK (length(business_name) <= 200),
  public_phone text CHECK (public_phone IS NULL OR length(public_phone) <= 80),
  public_email text CHECK (public_email IS NULL OR length(public_email) <= 320),
  public_address text CHECK (public_address IS NULL OR length(public_address) <= 1000),
  business_hours text CHECK (business_hours IS NULL OR length(business_hours) <= 2000),
  notification_preferences jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(notification_preferences) = 'object'),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.business_settings IS 'Single owner-managed settings record matching the current disabled Settings preview form.';

CREATE TABLE public.admin_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (length(btrim(action)) BETWEEN 1 AND 160),
  entity_type public.activity_entity_type NOT NULL,
  entity_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.admin_activity_logs IS 'Append-only owner audit trail. Keep metadata redacted and avoid secrets or unnecessary personal data.';

GRANT USAGE ON TYPE public.app_role TO authenticated;
GRANT USAGE ON TYPE public.customer_account_status TO authenticated;
GRANT USAGE ON TYPE public.repair_service_status TO anon, authenticated;
GRANT USAGE ON TYPE public.repair_status TO authenticated;
GRANT USAGE ON TYPE public.repair_priority TO authenticated;
GRANT USAGE ON TYPE public.repair_post_status TO anon, authenticated;
GRANT USAGE ON TYPE public.comment_moderation_status TO anon, authenticated;
GRANT USAGE ON TYPE public.reaction_type TO authenticated;
GRANT USAGE ON TYPE public.activity_entity_type TO authenticated;

CREATE INDEX profiles_status_idx ON public.profiles (account_status);
CREATE INDEX user_roles_role_idx ON public.user_roles (role, user_id);
CREATE INDEX repair_services_status_sort_idx ON public.repair_services (status, sort_order, name);
CREATE INDEX repair_requests_customer_submitted_idx ON public.repair_requests (customer_id, submitted_at DESC);
CREATE INDEX repair_requests_status_priority_updated_idx ON public.repair_requests (status, priority, updated_at DESC);
CREATE INDEX repair_requests_assigned_technician_idx ON public.repair_requests (assigned_technician_id, status);
CREATE INDEX repair_status_history_request_created_idx ON public.repair_status_history (repair_request_id, created_at);
CREATE INDEX repair_internal_notes_request_created_idx ON public.repair_internal_notes (repair_request_id, created_at DESC);
CREATE INDEX repair_attachments_request_created_idx ON public.repair_attachments (repair_request_id, created_at DESC);
CREATE INDEX repair_posts_status_published_idx ON public.repair_posts (status, published_at DESC);
CREATE INDEX post_media_post_sort_idx ON public.post_media (post_id, sort_order);
CREATE INDEX post_reactions_post_idx ON public.post_reactions (post_id, reaction);
CREATE INDEX comments_post_status_created_idx ON public.comments (post_id, status, created_at);
CREATE INDEX comments_profile_created_idx ON public.comments (profile_id, created_at DESC);
CREATE INDEX notifications_recipient_created_idx ON public.notifications (recipient_user_id, created_at DESC);
CREATE INDEX admin_activity_entity_created_idx ON public.admin_activity_logs (entity_type, entity_id, created_at DESC);
CREATE INDEX admin_activity_created_idx ON public.admin_activity_logs (created_at DESC);

CREATE FUNCTION app_private.is_owner()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles AS role_record
    WHERE role_record.user_id = auth.uid()
      AND role_record.role = 'owner'::public.app_role
  );
$function$;
REVOKE ALL ON FUNCTION app_private.is_owner() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.is_owner() TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.is_owner() TO service_role;
COMMENT ON FUNCTION app_private.is_owner() IS 'Trusted RLS helper. It grants owner access only to an explicitly provisioned owner role row.';

CREATE FUNCTION app_private.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $function$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION app_private.set_updated_at() FROM PUBLIC, anon, authenticated;

CREATE FUNCTION app_private.handle_auth_user_created()
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
    NEW.phone
  );
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION app_private.handle_auth_user_created() FROM PUBLIC, anon, authenticated;

CREATE FUNCTION app_private.guard_profile_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $function$
BEGIN
  IF COALESCE(auth.role() = 'service_role', false) OR app_private.is_owner() THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NULL OR OLD.id <> auth.uid() THEN
    RAISE EXCEPTION 'Profile update is not permitted' USING ERRCODE = '42501';
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.email IS DISTINCT FROM OLD.email
    OR NEW.account_status IS DISTINCT FROM OLD.account_status
    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Customers may only update their display name and phone' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION app_private.guard_profile_update() FROM PUBLIC, anon, authenticated;

CREATE FUNCTION app_private.guard_repair_request_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $function$
DECLARE
  is_trusted boolean := COALESCE(auth.role() = 'service_role', false) OR app_private.is_owner();
BEGIN
  IF is_trusted THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authenticated customer or trusted owner required' USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.customer_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Customers may only create their own repair requests' USING ERRCODE = '42501';
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
        RAISE EXCEPTION 'Selected service is not active or does not exist' USING ERRCODE = '23503';
      END IF;
    END IF;
    NEW.reference_number := 'R-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
    NEW.status := 'submitted';
    NEW.priority := 'normal';
    NEW.submitted_at := now();
    NEW.updated_at := now();
    NEW.assigned_technician_id := NULL;
    NEW.customer_visible_note := NULL;
    RETURN NEW;
  END IF;

  IF OLD.customer_id IS DISTINCT FROM auth.uid() OR OLD.status <> 'submitted' THEN
    RAISE EXCEPTION 'Customers may only update their own uninspected repair requests' USING ERRCODE = '42501';
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.reference_number IS DISTINCT FROM OLD.reference_number
    OR NEW.customer_id IS DISTINCT FROM OLD.customer_id
    OR NEW.status IS DISTINCT FROM OLD.status
    OR NEW.priority IS DISTINCT FROM OLD.priority
    OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at
    OR NEW.assigned_technician_id IS DISTINCT FROM OLD.assigned_technician_id
    OR NEW.customer_visible_note IS DISTINCT FROM OLD.customer_visible_note THEN
    RAISE EXCEPTION 'Customers cannot change repair status, assignment, reference, or staff notes' USING ERRCODE = '42501';
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
        RAISE EXCEPTION 'Selected service is not active or does not exist' USING ERRCODE = '23503';
      END IF;
    END IF;
  ELSE
    NEW.service_name_snapshot := OLD.service_name_snapshot;
  END IF;

  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION app_private.guard_repair_request_write() FROM PUBLIC, anon, authenticated;

CREATE FUNCTION app_private.record_repair_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  is_trusted boolean := COALESCE(auth.role() = 'service_role', false) OR app_private.is_owner();
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.repair_status_history (
      repair_request_id, from_status, to_status, customer_message, changed_by
    ) VALUES (
      NEW.id, NULL, NEW.status,
      COALESCE(NULLIF(NEW.customer_visible_note, ''), 'Repair request received.'),
      auth.uid()
    );
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.repair_status_history (
      repair_request_id, from_status, to_status, customer_message, changed_by
    ) VALUES (
      NEW.id, OLD.status, NEW.status, NEW.customer_visible_note, auth.uid()
    );

    IF is_trusted THEN
      INSERT INTO public.admin_activity_logs (
        actor_user_id, action, entity_type, entity_id, metadata
      ) VALUES (
        auth.uid(), 'repair.status_changed', 'repair_request', NEW.id,
        jsonb_build_object('from_status', OLD.status, 'to_status', NEW.status)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION app_private.record_repair_status_change() FROM PUBLIC, anon, authenticated;

CREATE FUNCTION app_private.guard_comment_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $function$
DECLARE
  is_trusted boolean := COALESCE(auth.role() = 'service_role', false) OR app_private.is_owner();
BEGIN
  IF is_trusted THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authenticated customer or trusted owner required' USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.profile_id IS DISTINCT FROM auth.uid()
      OR NEW.status <> 'pending'
      OR NEW.moderated_by IS NOT NULL
      OR NEW.moderated_at IS NOT NULL THEN
      RAISE EXCEPTION 'Customer comments must be submitted as pending under the signed-in profile' USING ERRCODE = '42501';
    END IF;
    SELECT profile.display_name
    INTO NEW.author_name_snapshot
    FROM public.profiles AS profile
    WHERE profile.id = auth.uid();
    IF NOT FOUND THEN
      RAISE EXCEPTION 'A profile is required to submit a comment' USING ERRCODE = '23503';
    END IF;
    NEW.created_at := now();
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  IF OLD.profile_id IS DISTINCT FROM auth.uid() OR OLD.status <> 'pending' THEN
    RAISE EXCEPTION 'Customers may only edit their own pending comments' USING ERRCODE = '42501';
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.post_id IS DISTINCT FROM OLD.post_id
    OR NEW.profile_id IS DISTINCT FROM OLD.profile_id
    OR NEW.author_name_snapshot IS DISTINCT FROM OLD.author_name_snapshot
    OR NEW.status IS DISTINCT FROM OLD.status
    OR NEW.moderated_by IS DISTINCT FROM OLD.moderated_by
    OR NEW.moderated_at IS DISTINCT FROM OLD.moderated_at
    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Customers cannot change comment ownership or moderation state' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION app_private.guard_comment_write() FROM PUBLIC, anon, authenticated;

CREATE FUNCTION app_private.guard_notification_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $function$
BEGIN
  IF COALESCE(auth.role() = 'service_role', false) OR app_private.is_owner() THEN
    RETURN NEW;
  END IF;
  IF auth.uid() IS NULL OR OLD.recipient_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Notification update is not permitted' USING ERRCODE = '42501';
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.recipient_user_id IS DISTINCT FROM OLD.recipient_user_id
    OR NEW.notification_type IS DISTINCT FROM OLD.notification_type
    OR NEW.title IS DISTINCT FROM OLD.title
    OR NEW.body IS DISTINCT FROM OLD.body
    OR NEW.related_entity_type IS DISTINCT FROM OLD.related_entity_type
    OR NEW.related_entity_id IS DISTINCT FROM OLD.related_entity_id
    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Recipients may only update their own read state' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION app_private.guard_notification_update() FROM PUBLIC, anon, authenticated;

CREATE FUNCTION app_private.guard_business_settings_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $function$
BEGIN
  IF COALESCE(auth.role() = 'service_role', false) THEN
    NEW.updated_by := auth.uid();
    RETURN NEW;
  END IF;
  IF NOT app_private.is_owner() THEN
    RAISE EXCEPTION 'Owner access is required to change business settings' USING ERRCODE = '42501';
  END IF;
  NEW.updated_by := auth.uid();
  IF TG_OP = 'INSERT' THEN
    NEW.created_at := now();
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION app_private.guard_business_settings_write() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER auth_user_create_profile
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION app_private.handle_auth_user_created();

INSERT INTO public.profiles (id, email, display_name, phone)
SELECT
  existing_user.id,
  existing_user.email,
  left(
    COALESCE(
      NULLIF(btrim(existing_user.raw_user_meta_data ->> 'display_name'), ''),
      NULLIF(split_part(COALESCE(existing_user.email, ''), '@', 1), ''),
      'Customer'
    ),
    160
  ),
  existing_user.phone
FROM auth.users AS existing_user
ON CONFLICT (id) DO NOTHING;

CREATE TRIGGER profiles_guard_update
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION app_private.guard_profile_update();
CREATE TRIGGER profiles_set_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION app_private.set_updated_at();
CREATE TRIGGER repair_services_set_updated_at
BEFORE UPDATE ON public.repair_services
FOR EACH ROW EXECUTE FUNCTION app_private.set_updated_at();
CREATE TRIGGER repair_requests_guard_write
BEFORE INSERT OR UPDATE ON public.repair_requests
FOR EACH ROW EXECUTE FUNCTION app_private.guard_repair_request_write();
CREATE TRIGGER repair_requests_set_updated_at
BEFORE UPDATE ON public.repair_requests
FOR EACH ROW EXECUTE FUNCTION app_private.set_updated_at();
CREATE TRIGGER repair_requests_record_history
AFTER INSERT OR UPDATE OF status ON public.repair_requests
FOR EACH ROW EXECUTE FUNCTION app_private.record_repair_status_change();
CREATE TRIGGER repair_internal_notes_set_updated_at
BEFORE UPDATE ON public.repair_internal_notes
FOR EACH ROW EXECUTE FUNCTION app_private.set_updated_at();
CREATE TRIGGER repair_posts_set_updated_at
BEFORE UPDATE ON public.repair_posts
FOR EACH ROW EXECUTE FUNCTION app_private.set_updated_at();
CREATE TRIGGER comments_guard_write
BEFORE INSERT OR UPDATE ON public.comments
FOR EACH ROW EXECUTE FUNCTION app_private.guard_comment_write();
CREATE TRIGGER comments_set_updated_at
BEFORE UPDATE ON public.comments
FOR EACH ROW EXECUTE FUNCTION app_private.set_updated_at();
CREATE TRIGGER notifications_guard_update
BEFORE UPDATE ON public.notifications
FOR EACH ROW EXECUTE FUNCTION app_private.guard_notification_update();
CREATE TRIGGER business_settings_guard_write
BEFORE INSERT OR UPDATE ON public.business_settings
FOR EACH ROW EXECUTE FUNCTION app_private.guard_business_settings_write();
CREATE TRIGGER business_settings_set_updated_at
BEFORE UPDATE ON public.business_settings
FOR EACH ROW EXECUTE FUNCTION app_private.set_updated_at();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_internal_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_owner_all ON public.profiles
FOR ALL TO authenticated
USING (app_private.is_owner())
WITH CHECK (app_private.is_owner());
CREATE POLICY profiles_customer_select_own ON public.profiles
FOR SELECT TO authenticated
USING (id = auth.uid());
CREATE POLICY profiles_customer_update_own ON public.profiles
FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

CREATE POLICY user_roles_owner_select ON public.user_roles
FOR SELECT TO authenticated
USING (app_private.is_owner());

CREATE POLICY repair_services_public_select_active ON public.repair_services
FOR SELECT TO anon
USING (status = 'active');
CREATE POLICY repair_services_authenticated_select_active ON public.repair_services
FOR SELECT TO authenticated
USING (status = 'active');
CREATE POLICY repair_services_owner_all ON public.repair_services
FOR ALL TO authenticated
USING (app_private.is_owner())
WITH CHECK (app_private.is_owner());

CREATE POLICY repair_requests_owner_all ON public.repair_requests
FOR ALL TO authenticated
USING (app_private.is_owner())
WITH CHECK (app_private.is_owner());
CREATE POLICY repair_requests_customer_select_own ON public.repair_requests
FOR SELECT TO authenticated
USING (customer_id = auth.uid());
CREATE POLICY repair_requests_customer_insert_own ON public.repair_requests
FOR INSERT TO authenticated
WITH CHECK (customer_id = auth.uid());
CREATE POLICY repair_requests_customer_update_own ON public.repair_requests
FOR UPDATE TO authenticated
USING (customer_id = auth.uid())
WITH CHECK (customer_id = auth.uid());

CREATE POLICY repair_status_history_owner_select ON public.repair_status_history
FOR SELECT TO authenticated
USING (app_private.is_owner());
CREATE POLICY repair_status_history_customer_select_own ON public.repair_status_history
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.repair_requests AS request
    WHERE request.id = repair_status_history.repair_request_id
      AND request.customer_id = auth.uid()
  )
);

CREATE POLICY repair_internal_notes_owner_all ON public.repair_internal_notes
FOR ALL TO authenticated
USING (app_private.is_owner())
WITH CHECK (app_private.is_owner());

CREATE POLICY repair_attachments_owner_all ON public.repair_attachments
FOR ALL TO authenticated
USING (app_private.is_owner())
WITH CHECK (app_private.is_owner());
CREATE POLICY repair_attachments_customer_select_own ON public.repair_attachments
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.repair_requests AS request
    WHERE request.id = repair_attachments.repair_request_id
      AND request.customer_id = auth.uid()
  )
);
CREATE POLICY repair_attachments_customer_insert_own ON public.repair_attachments
FOR INSERT TO authenticated
WITH CHECK (
  uploaded_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.repair_requests AS request
    WHERE request.id = repair_attachments.repair_request_id
      AND request.customer_id = auth.uid()
  )
);

CREATE POLICY repair_posts_public_select_published ON public.repair_posts
FOR SELECT TO anon
USING (status = 'published');
CREATE POLICY repair_posts_authenticated_select_published ON public.repair_posts
FOR SELECT TO authenticated
USING (status = 'published');
CREATE POLICY repair_posts_owner_all ON public.repair_posts
FOR ALL TO authenticated
USING (app_private.is_owner())
WITH CHECK (app_private.is_owner());

CREATE POLICY post_media_public_select_published ON public.post_media
FOR SELECT TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.repair_posts AS post
    WHERE post.id = post_media.post_id AND post.status = 'published'
  )
);
CREATE POLICY post_media_authenticated_select_published ON public.post_media
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.repair_posts AS post
    WHERE post.id = post_media.post_id AND post.status = 'published'
  )
);
CREATE POLICY post_media_owner_all ON public.post_media
FOR ALL TO authenticated
USING (app_private.is_owner())
WITH CHECK (app_private.is_owner());

CREATE POLICY post_reactions_owner_all ON public.post_reactions
FOR ALL TO authenticated
USING (app_private.is_owner())
WITH CHECK (app_private.is_owner());
CREATE POLICY post_reactions_customer_select_own ON public.post_reactions
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.repair_posts AS post
    WHERE post.id = post_reactions.post_id
      AND post.status = 'published'
  )
);
CREATE POLICY post_reactions_customer_insert_own_published ON public.post_reactions
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.repair_posts AS post
    WHERE post.id = post_reactions.post_id AND post.status = 'published'
  )
);
CREATE POLICY post_reactions_customer_delete_own ON public.post_reactions
FOR DELETE TO authenticated
USING (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.repair_posts AS post
    WHERE post.id = post_reactions.post_id
      AND post.status = 'published'
  )
);

CREATE POLICY comments_public_select_approved ON public.comments
FOR SELECT TO anon
USING (
  status = 'approved'
  AND EXISTS (
    SELECT 1 FROM public.repair_posts AS post
    WHERE post.id = comments.post_id AND post.status = 'published'
  )
);
CREATE POLICY comments_authenticated_select_allowed ON public.comments
FOR SELECT TO authenticated
USING (
  app_private.is_owner()
  OR profile_id = auth.uid()
  OR (
    status = 'approved'
    AND EXISTS (
      SELECT 1 FROM public.repair_posts AS post
      WHERE post.id = comments.post_id AND post.status = 'published'
    )
  )
);
CREATE POLICY comments_owner_all ON public.comments
FOR ALL TO authenticated
USING (app_private.is_owner())
WITH CHECK (app_private.is_owner());
CREATE POLICY comments_customer_insert_pending ON public.comments
FOR INSERT TO authenticated
WITH CHECK (
  profile_id = auth.uid()
  AND status = 'pending'
  AND moderated_by IS NULL
  AND moderated_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.repair_posts AS post
    WHERE post.id = comments.post_id AND post.status = 'published'
  )
);
CREATE POLICY comments_customer_update_pending_own ON public.comments
FOR UPDATE TO authenticated
USING (profile_id = auth.uid() AND status = 'pending')
WITH CHECK (profile_id = auth.uid() AND status = 'pending');

CREATE POLICY notifications_owner_all ON public.notifications
FOR ALL TO authenticated
USING (app_private.is_owner())
WITH CHECK (app_private.is_owner());
CREATE POLICY notifications_recipient_select_own ON public.notifications
FOR SELECT TO authenticated
USING (recipient_user_id = auth.uid());
CREATE POLICY notifications_recipient_update_own ON public.notifications
FOR UPDATE TO authenticated
USING (recipient_user_id = auth.uid())
WITH CHECK (recipient_user_id = auth.uid());

CREATE POLICY business_settings_owner_all ON public.business_settings
FOR ALL TO authenticated
USING (app_private.is_owner())
WITH CHECK (app_private.is_owner());

CREATE POLICY admin_activity_logs_owner_select ON public.admin_activity_logs
FOR SELECT TO authenticated
USING (app_private.is_owner());

REVOKE ALL ON TABLE public.profiles FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.user_roles FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.repair_services FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.repair_requests FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.repair_status_history FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.repair_internal_notes FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.repair_attachments FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.repair_posts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.post_media FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.post_reactions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.comments FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.notifications FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.business_settings FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.admin_activity_logs FROM PUBLIC, anon, authenticated;

GRANT SELECT, UPDATE ON TABLE public.profiles TO authenticated;
GRANT SELECT ON TABLE public.user_roles TO authenticated;
GRANT SELECT ON TABLE public.repair_services TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.repair_services TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.repair_requests TO authenticated;
GRANT SELECT ON TABLE public.repair_status_history TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.repair_internal_notes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.repair_attachments TO authenticated;
GRANT SELECT ON TABLE public.repair_posts TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.repair_posts TO authenticated;
GRANT SELECT ON TABLE public.post_media TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.post_media TO authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.post_reactions TO authenticated;
GRANT SELECT ON TABLE public.comments TO anon, authenticated;
GRANT INSERT, UPDATE ON TABLE public.comments TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.business_settings TO authenticated;
GRANT SELECT ON TABLE public.admin_activity_logs TO authenticated;

REVOKE SELECT ON TABLE public.repair_status_history FROM authenticated;
GRANT SELECT (id, repair_request_id, from_status, to_status, customer_message, created_at)
ON TABLE public.repair_status_history TO authenticated;

-- Public readers use safe-column views for showcase content. Keep author IDs,
-- commenter profile IDs, moderation actor IDs, and private object paths off the
-- public Data API surface.
REVOKE SELECT ON TABLE public.repair_posts, public.post_media, public.comments
FROM anon, authenticated;
GRANT SELECT (id, title, caption, service_id, status, published_at, created_at, updated_at)
ON TABLE public.repair_posts TO authenticated;
GRANT SELECT (id, post_id, author_name_snapshot, body, status, created_at, updated_at)
ON TABLE public.comments TO authenticated;

-- Supabase's service_role is trusted server-only access and bypasses RLS.
-- Never place its secret key in a browser or public deployment variable.
GRANT ALL ON TABLE
  public.profiles,
  public.user_roles,
  public.repair_services,
  public.repair_requests,
  public.repair_status_history,
  public.repair_internal_notes,
  public.repair_attachments,
  public.repair_posts,
  public.post_media,
  public.post_reactions,
  public.comments,
  public.notifications,
  public.business_settings,
  public.admin_activity_logs
TO service_role;
GRANT USAGE ON TYPE
  public.app_role,
  public.customer_account_status,
  public.repair_service_status,
  public.repair_status,
  public.repair_priority,
  public.repair_post_status,
  public.comment_moderation_status,
  public.reaction_type,
  public.activity_entity_type
TO service_role;

CREATE VIEW public.public_showcase_posts
WITH (security_barrier = true)
AS
SELECT post.id, post.title, post.caption, post.service_id, post.status,
       post.published_at, post.created_at, post.updated_at
FROM public.repair_posts AS post
WHERE post.status = 'published';
COMMENT ON VIEW public.public_showcase_posts IS 'Safe public fields for published showcase posts; excludes author identity.';

CREATE VIEW public.public_showcase_media
WITH (security_barrier = true)
AS
SELECT media.id, media.post_id, media.sort_order, media.alt_text, media.created_at
FROM public.post_media AS media
JOIN public.repair_posts AS post ON post.id = media.post_id
WHERE post.status = 'published';
COMMENT ON VIEW public.public_showcase_media IS 'Safe public media metadata; excludes private Storage bucket and object path.';

CREATE VIEW public.public_approved_comments
WITH (security_barrier = true)
AS
SELECT comment.id, comment.post_id, comment.author_name_snapshot,
       comment.body, comment.created_at
FROM public.comments AS comment
JOIN public.repair_posts AS post ON post.id = comment.post_id
WHERE comment.status = 'approved' AND post.status = 'published';
COMMENT ON VIEW public.public_approved_comments IS 'Approved public comments without profile IDs or moderation metadata.';

CREATE VIEW public.owner_showcase_posts
WITH (security_barrier = true)
AS
SELECT post.*
FROM public.repair_posts AS post
WHERE app_private.is_owner();
CREATE VIEW public.owner_showcase_media
WITH (security_barrier = true)
AS
SELECT media.*
FROM public.post_media AS media
WHERE app_private.is_owner();
CREATE VIEW public.owner_comments
WITH (security_barrier = true)
AS
SELECT comment.*
FROM public.comments AS comment
WHERE app_private.is_owner();
CREATE VIEW public.owner_repair_status_history
WITH (security_barrier = true)
AS
SELECT history.*
FROM public.repair_status_history AS history
WHERE app_private.is_owner();

GRANT SELECT ON TABLE public.public_showcase_posts, public.public_showcase_media,
  public.public_approved_comments TO anon, authenticated;
GRANT SELECT ON TABLE public.owner_showcase_posts, public.owner_showcase_media,
  public.owner_comments, public.owner_repair_status_history TO authenticated;
REVOKE ALL ON TABLE public.public_showcase_posts, public.public_showcase_media,
  public.public_approved_comments, public.owner_showcase_posts,
  public.owner_showcase_media, public.owner_comments,
  public.owner_repair_status_history FROM PUBLIC;

CREATE VIEW public.published_post_reaction_counts
WITH (security_barrier = true)
AS
SELECT
  reaction.post_id,
  reaction.reaction,
  count(*)::bigint AS reaction_count
FROM public.post_reactions AS reaction
JOIN public.repair_posts AS post ON post.id = reaction.post_id
WHERE post.status = 'published'
GROUP BY reaction.post_id, reaction.reaction;
COMMENT ON VIEW public.published_post_reaction_counts IS 'Public aggregate counts only; does not expose reaction actor identifiers.';
REVOKE ALL ON TABLE public.published_post_reaction_counts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.published_post_reaction_counts TO anon, authenticated;
GRANT SELECT ON TABLE public.published_post_reaction_counts TO service_role;

DO $realtime$
DECLARE
  table_name text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    RAISE NOTICE 'Publication supabase_realtime is not present; add selected tables after enabling Realtime.';
    RETURN;
  END IF;

  FOREACH table_name IN ARRAY ARRAY[
    'repair_requests',
    'repair_services',
    'notifications',
    'admin_activity_logs'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_publication_tables AS published
      WHERE published.pubname = 'supabase_realtime'
        AND published.schemaname = 'public'
        AND published.tablename = table_name
    ) THEN
      EXECUTE pg_catalog.format(
        'ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',
        table_name
      );
    END IF;
  END LOOP;
END;
$realtime$;

COMMIT;
