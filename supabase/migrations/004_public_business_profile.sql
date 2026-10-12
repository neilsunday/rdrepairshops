BEGIN;

INSERT INTO public.business_settings (
  id,
  business_name,
  public_phone,
  public_email,
  public_address,
  business_hours
)
VALUES (
  1,
  'R&D Cellphone Repair',
  E'09503223584\n09487336461',
  E'lhadylovely09@gmail.com\nraymonsumicad434@gmail.com',
  'H54M+JRV R&D cellphone repairshop, J. Señido, Angono, Rizal',
  '9am-8pm'
)
ON CONFLICT (id) DO NOTHING;

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
