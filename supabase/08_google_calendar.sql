-- Gabinete · Actualización: sincronización con Google Calendar (cada persona conecta su cuenta)
-- Solo AGREGA tablas, un disparador y una tarea programada. No borra ni modifica datos existentes.
-- Se puede ejecutar más de una vez sin problema.
-- Requisitos: 07_avisos_vencimiento.sql ya ejecutado (usa su clave push_cron) y la función "gcal"
-- publicada con "Verify JWT" desactivado y los secretos GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- Cuenta de Google conectada por cada persona (solo la lee el servidor: guarda el permiso de Google)
create table if not exists public.gcal_cuentas (
  member_id uuid primary key references public.members(id) on delete cascade,
  google_email text not null default '',
  refresh_token text not null,
  calendar_id text,
  connected_at timestamptz not null default now(),
  last_sync timestamptz,
  last_error text
);
alter table public.gcal_cuentas enable row level security;
revoke all on public.gcal_cuentas from anon, authenticated;
grant select, insert, update, delete on public.gcal_cuentas to service_role;

-- Qué evento de Google corresponde a cada tarea en el calendario de cada persona
create table if not exists public.gcal_eventos (
  task_id uuid not null,
  member_id uuid not null references public.members(id) on delete cascade,
  event_id text,
  huella text,
  updated_at timestamptz not null default now(),
  primary key (task_id, member_id)
);
alter table public.gcal_eventos enable row level security;
revoke all on public.gcal_eventos from anon, authenticated;
grant select, insert, update, delete on public.gcal_eventos to service_role;

-- Cuando cambia algo de una tarea que se ve en Google, avisa a la función (solo si alguien conectó su cuenta)
create or replace function public.gcal_tarea_cambio() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare r record;
begin
  if tg_op = 'DELETE' then r := old; else r := new; end if;
  if tg_op = 'UPDATE' and (old.title, old.notes, old.due, old.status, old.private, old.project_id, old.assignee_id, old.co_assignees)
     is not distinct from (new.title, new.notes, new.due, new.status, new.private, new.project_id, new.assignee_id, new.co_assignees) then
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

drop trigger if exists gcal_tarea on public.tasks;
create trigger gcal_tarea after insert or update or delete on public.tasks
  for each row execute function public.gcal_tarea_cambio();

-- Red de seguridad: cada 30 minutos revisa todo (cambios de nombre de tableros, llamadas perdidas, etc.)
select cron.unschedule(jobid) from cron.job where jobname = 'gabinete-gcal';
select cron.schedule('gabinete-gcal', '*/30 * * * *', $job$
  select net.http_post(
    url := 'https://upvcwajccsmnqqvltgxp.supabase.co/functions/v1/gcal',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := jsonb_build_object('action', 'sync_all', 'secret', (select secret from public.push_cron where id = 1)),
    timeout_milliseconds := 120000
  ) where exists (select 1 from public.gcal_cuentas);
$job$);

select 'ok' as resultado, (select count(*) from public.tasks) as tareas_intactas,
  (select count(*) from cron.job where jobname = 'gabinete-gcal') as sincronizacion_programada;
