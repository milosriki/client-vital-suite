-- Schedule proactive hourly audits to keep the intelligence suite running.
DO $$
DECLARE
  project_url text := current_setting('app.settings.ptd_project_url', true);
  service_key text := current_setting('app.settings.service_role_key', true);
BEGIN
  IF project_url IS NULL OR service_key IS NULL THEN
    RAISE NOTICE 'Skipping ptd-proactive-audit schedule (missing app.settings.ptd_project_url or app.settings.service_role_key)';
    RETURN;
  END IF;

  PERFORM cron.schedule(
    'ptd-proactive-audit',
    '0 * * * *',
    format($cron$
      SELECT net.http_post(
        url := '%s/functions/v1/ptd-agent-gemini',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer %s"}'::jsonb,
        body := '{"query": "Run a full business audit and build one feature to improve revenue."}'::jsonb
      );
    $cron$, project_url, service_key)
  );
END $$;
