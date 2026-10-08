-- Gabinete · Pérez Ramírez Arquitectura
-- Esquema de base de datos para Supabase (Postgres)

create extension if not exists pgcrypto;

-- Personas habilitadas para usar el sistema
create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text not null,
  role text default '',
  color int default 0,
  is_admin boolean not null default false,
  user_id uuid unique references auth.users(id) on delete set null,
  sort_order double precision default extract(epoch from now()),
  created_at timestamptz not null default now()
);

-- Tableros: obras y proyectos
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'obra' check (kind in ('obra','proyecto')),
  code text default '',
  client text default '',
  place text default '',
  color int default 0,
  archived boolean not null default false,
  sort_order double precision default extract(epoch from now()),
  team uuid[] not null default '{}',
  lead uuid references public.members(id) on delete set null,
  created_by uuid references public.members(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Tareas
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  notes text default '',
  project_id uuid references public.projects(id) on delete set null,
  assignee_id uuid references public.members(id) on delete set null,
  status text not null default 'todo' check (status in ('todo','doing','review','done')),
  prio int not null default 0 check (prio between 0 and 2),
  due date,
  etapa text default '',
  checklist jsonb not null default '[]'::jsonb,
  sort_order double precision default extract(epoch from now()) * 1000,
  created_by uuid references public.members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  done_at timestamptz
);
create index if not exists tasks_project_idx on public.tasks(project_id);
create index if not exists tasks_assignee_idx on public.tasks(assignee_id);
create index if not exists tasks_due_idx on public.tasks(due);

-- Historial de movimientos
create table if not exists public.history (
  id bigint generated always as identity primary key,
  ts timestamptz not null default now(),
  actor uuid references public.members(id) on delete set null,
  actor_name text default '',
  type text not null,
  task_id uuid,
  title text default '',
  project_id uuid,
  data jsonb not null default '{}'::jsonb
);
create index if not exists history_ts_idx on public.history(ts desc);

-- ¿Quién está mirando? (por el mail de su sesión)
create or replace function public.current_member_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.members where lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')) limit 1
$$;
create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')))
$$;
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')) and is_admin)
$$;

-- Al entrar por primera vez, vincula la cuenta con su ficha del equipo
create or replace function public.link_member() returns uuid
language plpgsql security definer set search_path = public as $$
declare mid uuid;
begin
  update public.members set user_id = auth.uid()
   where lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')) and (user_id is null or user_id = auth.uid())
  returning id into mid;
  return mid;
end $$;

-- Seguridad por fila
alter table public.members enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.history enable row level security;

drop policy if exists members_read on public.members;
create policy members_read on public.members for select to authenticated using (public.is_member());
drop policy if exists members_admin_insert on public.members;
create policy members_admin_insert on public.members for insert to authenticated with check (public.is_admin());
drop policy if exists members_update on public.members;
create policy members_update on public.members for update to authenticated
  using (public.is_admin() or lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')))
  with check (public.is_admin() or (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')) and is_admin = false));
drop policy if exists members_admin_delete on public.members;
create policy members_admin_delete on public.members for delete to authenticated using (public.is_admin());

drop policy if exists projects_all on public.projects;
create policy projects_all on public.projects for all to authenticated using (public.is_member()) with check (public.is_member());
drop policy if exists tasks_all on public.tasks;
create policy tasks_all on public.tasks for all to authenticated using (public.is_member()) with check (public.is_member());
drop policy if exists history_read on public.history;
create policy history_read on public.history for select to authenticated using (public.is_member());
drop policy if exists history_insert on public.history;
create policy history_insert on public.history for insert to authenticated with check (public.is_member());

-- Un miembro que no es admin no puede convertirse en admin
create or replace function public.guard_admin_flag() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.is_admin is distinct from old.is_admin and not public.is_admin() then
    new.is_admin := old.is_admin;
  end if;
  return new;
end $$;
drop trigger if exists members_guard_admin on public.members;
create trigger members_guard_admin before update on public.members for each row execute function public.guard_admin_flag();

-- Permisos de acceso a la API (solo usuarios con sesión iniciada)
revoke all on public.members, public.projects, public.tasks, public.history from anon;
grant select, insert, update, delete on public.members, public.projects, public.tasks to authenticated;
grant select, insert on public.history to authenticated;
grant execute on function public.is_member(), public.is_admin(), public.current_member_id(), public.link_member() to authenticated;
revoke execute on function public.is_member(), public.is_admin(), public.current_member_id(), public.link_member() from anon;

-- Actualizaciones en tiempo real
do $$ begin
  begin alter publication supabase_realtime add table public.members; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.projects; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.tasks; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.history; exception when duplicate_object then null; end;
end $$;

-- Primer administrador
insert into public.members (email, name, role, color, is_admin)
values ('estudio@perezramirezarquitectura.com', 'Estudio Pérez Ramírez', 'Administración', 0, true)
on conflict (email) do update set is_admin = true;
