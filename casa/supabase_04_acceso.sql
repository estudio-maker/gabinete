-- Casa · acceso solo con autorización.
-- Solo entran los mails que autoriza el administrador de Casa (desde Ajustes → Clientes autorizados).
-- Si alguien reenvía el enlace a otra persona, esa persona no puede entrar ni crear una casa.
-- El personal sigue entrando con su enlace propio, sin cuenta.
-- Correr una vez en Supabase → SQL Editor, y después agregar tu mail como administrador (última línea, comentada).

create table if not exists casa_admins(email text primary key);
create table if not exists casa_autorizados(
  email text primary key,
  nota text not null default '',
  creado timestamptz not null default now()
);
alter table casa_admins enable row level security;
alter table casa_autorizados enable row level security;
-- Sin reglas: nadie las lee directo, solo a través de las funciones de abajo.

create or replace function casa_mi_mail() returns text
language sql stable set search_path=public as $$ select lower(coalesce(auth.jwt()->>'email','')) $$;

create or replace function casa_es_admin() returns boolean
language sql security definer stable set search_path=public as $$
  select auth.uid() is not null and exists(select 1 from casa_admins where lower(email)=casa_mi_mail())
$$;

create or replace function casa_autorizado() returns boolean
language sql security definer stable set search_path=public as $$
  select casa_es_admin() or exists(select 1 from casa_autorizados where email=casa_mi_mail())
$$;

create or replace function casa_estado() returns jsonb
language sql security definer stable set search_path=public as $$
  select jsonb_build_object('admin',casa_es_admin(),'autorizado',casa_autorizado())
$$;

-- Al entrar: si está autorizado, acepta las invitaciones pendientes de su mail; devuelve sus casas.
create or replace function casa_entrar() returns table(id uuid, nombre text, pais text)
language plpgsql security definer set search_path=public as $$
declare mail text := casa_mi_mail();
begin
  if auth.uid() is null or not casa_autorizado() then return; end if;
  insert into casa_miembros(hogar_id,user_id,email)
    select i.hogar_id, auth.uid(), mail from casa_invitaciones i where lower(i.email)=mail
    on conflict do nothing;
  delete from casa_invitaciones where lower(email)=mail;
  return query select h.id,h.nombre,h.pais from casa_hogares h join casa_miembros m on m.hogar_id=h.id
    where m.user_id=auth.uid() order by h.creado;
end $$;

create or replace function casa_crear_hogar(p_nombre text, p_mi_nombre text default '') returns uuid
language plpgsql security definer set search_path=public as $$
declare h uuid;
begin
  if auth.uid() is null then raise exception 'sin sesión'; end if;
  if not casa_autorizado() then raise exception 'sin autorización'; end if;
  insert into casa_hogares(nombre) values (coalesce(nullif(trim(p_nombre),''),'Mi casa')) returning casa_hogares.id into h;
  insert into casa_miembros(hogar_id,user_id,email,nombre) values (h,auth.uid(),casa_mi_mail(),coalesce(p_mi_nombre,''));
  return h;
end $$;

-- Quien no está autorizado tampoco ve datos aunque haya sido dueño antes.
create or replace function casa_es_miembro(h uuid) returns boolean
language sql security definer stable set search_path=public as $$
  select casa_autorizado() and exists(select 1 from casa_miembros where hogar_id=h and user_id=auth.uid())
$$;

-- Administración (solo el administrador).
create or replace function casa_autorizados_ver() returns jsonb
language plpgsql security definer set search_path=public as $$
begin
  if not casa_es_admin() then raise exception 'solo el administrador'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('email',a.email,'nota',a.nota,'creado',a.creado,
    'entro',exists(select 1 from casa_miembros m where lower(m.email)=a.email)) order by a.creado desc) from casa_autorizados a),'[]'::jsonb);
end $$;

create or replace function casa_autorizar(p_email text, p_nota text default '') returns boolean
language plpgsql security definer set search_path=public as $$
declare e text := lower(trim(coalesce(p_email,'')));
begin
  if not casa_es_admin() then raise exception 'solo el administrador'; end if;
  if e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then return false; end if;
  insert into casa_autorizados(email,nota) values (e,left(coalesce(p_nota,''),120))
    on conflict (email) do update set nota=excluded.nota;
  return true;
end $$;

create or replace function casa_desautorizar(p_email text) returns boolean
language plpgsql security definer set search_path=public as $$
begin
  if not casa_es_admin() then raise exception 'solo el administrador'; end if;
  delete from casa_autorizados where email=lower(trim(coalesce(p_email,'')));
  return true;
end $$;

revoke all on function casa_estado(), casa_autorizados_ver(), casa_autorizar(text,text), casa_desautorizar(text) from public;
grant execute on function casa_mi_mail(), casa_es_admin(), casa_autorizado(), casa_estado(), casa_autorizados_ver(),
  casa_autorizar(text,text), casa_desautorizar(text), casa_entrar(), casa_crear_hogar(text,text), casa_es_miembro(uuid) to authenticated;

-- insert into casa_admins(email) values ('tu-mail@ejemplo.com') on conflict do nothing;
