-- Gabinete · Actualización: aviso diario de tareas por vencer (3 días antes y hasta el día del vencimiento)
-- Solo AGREGA tablas y una tarea programada. No borra ni modifica datos existentes.
-- Se puede ejecutar más de una vez sin problema.
-- Requisito: la función "push" ya actualizada y con "Verify JWT" desactivado (ella misma controla quién la llama).

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- Clave que usa la tarea programada para llamar a la función (solo la lee el servidor)
create table if not exists public.push_cron (
  id int primary key default 1 check (id = 1),
  secret text not null default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
);
insert into public.push_cron (id) values (1) on conflict (id) do nothing;
alter table public.push_cron enable row level security;
revoke all on public.push_cron from anon, authenticated;
grant select on public.push_cron to service_role;

-- Registro de avisos enviados: una persona recibe un solo aviso por día
create table if not exists public.push_avisos (
  dia date not null,
  member_id uuid not null references public.members(id) on delete cascade,
  sent_at timestamptz not null default now(),
  primary key (dia, member_id)
);
alter table public.push_avisos enable row level security;
revoke all on public.push_avisos from anon, authenticated;
grant select, insert, delete on public.push_avisos to service_role;

-- Todos los días a las 8:00 de Paraguay (11:00 UTC)
select cron.unschedule(jobid) from cron.job where jobname = 'gabinete-vencimientos';
select cron.schedule('gabinete-vencimientos', '0 11 * * *', $job$
  delete from public.push_avisos where dia < current_date - 30;
  select net.http_post(
    url := 'https://upvcwajccsmnqqvltgxp.supabase.co/functions/v1/push',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := jsonb_build_object('action', 'due_daily', 'secret', (select secret from public.push_cron where id = 1)),
    timeout_milliseconds := 60000
  );
$job$);

select 'ok' as resultado, (select count(*) from cron.job where jobname = 'gabinete-vencimientos') as aviso_programado;
