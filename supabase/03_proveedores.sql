-- Gabinete · Actualización: proveedores y contratistas
-- Solo AGREGA una tabla y una columna. No borra ni modifica datos existentes.
-- Se puede ejecutar más de una vez sin problema.

-- Agenda compartida de proveedores / contratistas (personas externas al sistema)
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  rubro text default '',
  phone text default '',
  email text default '',
  notes text default '',
  created_by uuid references public.members(id) on delete set null,
  created_at timestamptz not null default now()
);

-- En cada tarea: a quiénes se les pidió (lista de {c: id del contacto, ok: respondió, at: fecha})
alter table public.tasks add column if not exists providers jsonb not null default '[]'::jsonb;

-- Cualquier persona del equipo puede crear, editar y quitar proveedores (sin autorización del admin)
alter table public.contacts enable row level security;
drop policy if exists contacts_all on public.contacts;
create policy contacts_all on public.contacts for all to authenticated using (public.is_member()) with check (public.is_member());
revoke all on public.contacts from anon;
grant select, insert, update, delete on public.contacts to authenticated;

-- Tiempo real
do $$ begin
  begin alter publication supabase_realtime add table public.contacts; exception when duplicate_object then null; end;
end $$;

select 'ok' as resultado, (select count(*) from public.tasks) as tareas_intactas;
