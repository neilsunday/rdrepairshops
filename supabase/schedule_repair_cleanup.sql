-- Run after deploying cleanup-completed-repairs and enabling pg_cron and pg_net.
-- Replace <PROJECT_REF> with the Supabase project reference.
-- Store the service-role key in Supabase Vault as
-- repair_cleanup_service_role_key before scheduling this job.

SELECT cron.schedule(
  'cleanup-completed-repairs',
  '*/15 * * * *',
  $job$
    SELECT net.http_post(
      url := 'https://<PROJECT_REF>.supabase.co/functions/v1/cleanup-completed-repairs',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret
          FROM vault.decrypted_secrets
          WHERE name = 'repair_cleanup_service_role_key'
          ORDER BY created_at DESC
          LIMIT 1
        )
      ),
      body := '{}'::jsonb
    );
  $job$
);
