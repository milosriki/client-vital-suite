
-- Enable the PG Net extension to allow calling Edge Functions from SQL
create extension if not exists pg_net;

-- Create the Trigger Function
create or replace function trigger_atlas_on_task()
returns trigger
language plpgsql
security definer
as $$
begin
  -- Call the Edge Function "ptd-atlas-trigger"
  -- Replace [PROJECT_REF] with your actual Supabase project reference if needed dynamically, 
  -- but usually it's handled by the service URL via pg_net logic or a dedicated webhook setup.
  -- For Supabase Database Webhooks, we usually use the UI, but here is the raw SQL logic:
  
  perform net.http_post(
      url := 'https://[YOUR_PROJECT_REF].supabase.co/functions/v1/ptd-atlas-trigger',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer [YOUR_SERVICE_KEY]"}'::jsonb,
      body := jsonb_build_object(
          'type', TG_OP, 
          'table', TG_TABLE_NAME, 
          'record', row_to_json(NEW)
      )
  );
  
  return NEW;
end;
$$;

-- Create the Trigger on the Table
drop trigger if exists on_task_created on agent_tasks;
create trigger on_task_created
  after insert on agent_tasks
  for each row
  execute function trigger_atlas_on_task();
