-- Gabinete · Actualización: varios responsables por tarea + notificaciones push
-- Solo AGREGA columnas y tablas. No borra ni modifica datos existentes.
-- Se puede ejecutar más de una vez sin problema.

-- Responsables adicionales (el principal sigue en assignee_id)
alter table public.tasks add column if not exists co_assignees uuid[] not null default '{}';
create index if not exists tasks_co_assignees_idx on public.tasks using gin (co_assignees);

-- Dispositivos suscriptos a notificaciones (solo los lee/escribe el servidor)
create table if not exists public.push_subs (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  ua text default '',
  created_at timestamptz not null default now(),
  last_ok timestamptz
);
create index if not exists push_subs_member_idx on public.push_subs(member_id);
alter table public.push_subs enable row level security;
revoke all on public.push_subs from anon, authenticated;

-- Configuración del servidor de notificaciones (claves VAPID; las crea la función sola)
create table if not exists public.push_config (
  id int primary key default 1 check (id = 1),
  data jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.push_config enable row level security;
revoke all on public.push_config from anon, authenticated;

select 'ok' as resultado, (select count(*) from public.tasks) as tareas_intactas;

-- Permisos para la función del servidor (rol service_role)
grant select on public.members, public.projects, public.tasks to service_role;
grant select, insert, update, delete on public.push_subs, public.push_config to service_role;
