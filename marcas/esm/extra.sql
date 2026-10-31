-- ESM · lo que tiene solo ESM (se agrega al final de la instalación). Se puede volver a ejecutar sin problema.

-- Fecha de la carrera de cada tablero (se ve en el Calendario y va a Google Calendar)
alter table public.projects add column if not exists event_date date;

-- Cuando cambia la fecha (u otro dato que se ve en Google) de un tablero, avisa a la función gcal
create or replace function public.gcal_tablero_cambio() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare r record;
begin
  if tg_op = 'DELETE' then r := old; else r := new; end if;
  if tg_op = 'UPDATE' and (old.event_date, old.name, old.code, old.place, old.private, old.team, old.lead, old.archived)
     is not distinct from (new.event_date, new.name, new.code, new.place, new.private, new.team, new.lead, new.archived) then
    return null;
  end if;
  if tg_op = 'INSERT' and new.event_date is null then return null; end if;
  if not exists (select 1 from public.gcal_cuentas) then return null; end if;
  perform net.http_post(
    url := 'https://upvcwajccsmnqqvltgxp.supabase.co/functions/v1/gcal',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := jsonb_build_object('action', 'board', 'id', r.id, 'secret', (select secret from public.push_cron where id = 1)),
    timeout_milliseconds := 30000
  );
  return null;
end $$;
revoke all on function public.gcal_tablero_cambio() from public, anon, authenticated;
drop trigger if exists gcal_tablero on public.projects;
create trigger gcal_tablero after insert or update or delete on public.projects
  for each row execute function public.gcal_tablero_cambio();

select 'ok' as resultado, (select count(*) from public.projects where event_date is not null) as tableros_con_fecha;
