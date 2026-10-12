BEGIN;

CREATE OR REPLACE VIEW public.public_business_profile AS
SELECT
  id,
  business_name,
  public_phone,
  public_email,
  public_address,
  business_hours,
  updated_at
FROM public.business_settings
WHERE id = 1;

REVOKE ALL ON TABLE public.public_business_profile FROM PUBLIC;
GRANT SELECT ON TABLE public.public_business_profile TO anon, authenticated;

COMMENT ON VIEW public.public_business_profile IS
  'Allowlisted public business contact fields; excludes owner notification preferences and user identifiers.';

COMMIT;
