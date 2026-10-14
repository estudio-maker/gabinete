-- Gabinete · hora opcional en el vencimiento de las tareas
-- Ejecutar una vez en Supabase (SQL Editor). Se puede volver a ejecutar sin problema.

alter table public.tasks add column if not exists due_time text;
alter table public.tasks drop constraint if exists tasks_due_time_ok;
alter table public.tasks add constraint tasks_due_time_ok
  check (due_time is null or due_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

-- Google Calendar: avisar también cuando cambia la hora
create or replace function public.gcal_tarea_cambio() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare r record;
begin
  if tg_op = 'DELETE' then r := old; else r := new; end if;
  if tg_op = 'UPDATE' and (old.title, old.notes, old.due, old.due_time, old.status, old.private, old.project_id, old.assignee_id, old.co_assignees)
     is not distinct from (new.title, new.notes, new.due, new.due_time, new.status, new.private, new.project_id, new.assignee_id, new.co_assignees) then
    return null;
  end if;
  if not exists (select 1 from public.gcal_cuentas) then return null; end if;
  perform net.http_post(
    url := 'https://upvcwajccsmnqqvltgxp.supabase.co/functions/v1/gcal',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := jsonb_build_object('action', 'task', 'id', r.id, 'secret', (select secret from public.push_cron where id = 1)),
    timeout_milliseconds := 30000
  );
  return null;
end $$;
revoke all on function public.gcal_tarea_cambio() from public, anon, authenticated;

select 'ok' as resultado, (select count(*) from public.tasks) as tareas;
