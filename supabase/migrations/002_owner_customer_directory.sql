-- Additive migration for the owner UI customer directory.
-- Do not run until 001_initial_schema.sql is confirmed applied.
-- No base tables or customer data are changed by this view migration.

BEGIN;

CREATE VIEW public.owner_customer_directory (
  customer_key,
  profile_id,
  display_name,
  email,
  phone,
  created_at,
  account_status,
  repair_count
)
WITH (security_barrier = true)
AS
WITH profile_customers AS (
  SELECT
    profile.id AS customer_key,
    profile.id AS profile_id,
    profile.display_name,
    profile.email,
    profile.phone,
    profile.created_at,
    profile.account_status,
    count(request.id)::bigint AS repair_count
  FROM public.profiles AS profile
  LEFT JOIN public.repair_requests AS request
    ON request.customer_id = profile.id
  GROUP BY
    profile.id,
    profile.display_name,
    profile.email,
    profile.phone,
    profile.created_at,
    profile.account_status
),
guest_requests AS (
  SELECT
    request.*,
    CASE
      WHEN nullif(btrim(request.customer_email), '') IS NOT NULL
        THEN 'email:' || lower(btrim(request.customer_email))
      ELSE 'phone:' || coalesce(
        nullif(regexp_replace(request.customer_phone, '[^0-9]', '', 'g'), ''),
        lower(btrim(request.customer_phone))
      )
    END AS identity_key
  FROM public.repair_requests AS request
  WHERE request.customer_id IS NULL
),
guest_customers AS (
  SELECT
    (array_agg(guest.id ORDER BY guest.submitted_at, guest.id))[1] AS customer_key,
    NULL::uuid AS profile_id,
    (array_agg(guest.customer_name ORDER BY guest.submitted_at DESC, guest.id DESC))[1] AS display_name,
    (array_agg(guest.customer_email ORDER BY guest.submitted_at DESC, guest.id DESC))[1] AS email,
    (array_agg(guest.customer_phone ORDER BY guest.submitted_at DESC, guest.id DESC))[1] AS phone,
    min(guest.submitted_at) AS created_at,
    'inquiry_only'::public.customer_account_status AS account_status,
    count(*)::bigint AS repair_count
  FROM guest_requests AS guest
  GROUP BY guest.identity_key
)
SELECT
  profile_customer.customer_key,
  profile_customer.profile_id,
  profile_customer.display_name,
  profile_customer.email,
  profile_customer.phone,
  profile_customer.created_at,
  profile_customer.account_status,
  profile_customer.repair_count
FROM profile_customers AS profile_customer
WHERE app_private.is_owner()
UNION ALL
SELECT
  guest_customer.customer_key,
  guest_customer.profile_id,
  guest_customer.display_name,
  guest_customer.email,
  guest_customer.phone,
  guest_customer.created_at,
  guest_customer.account_status,
  guest_customer.repair_count
FROM guest_customers AS guest_customer
WHERE app_private.is_owner();

COMMENT ON VIEW public.owner_customer_directory IS
  'Owner-only customer directory derived from profiles and deduplicated unlinked repair-request contact snapshots.';

REVOKE ALL ON TABLE public.owner_customer_directory FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.owner_customer_directory TO authenticated;

COMMIT;
