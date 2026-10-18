-- Casa · manejo del hogar
-- Esquema para guardar los datos en Supabase y compartirlos entre los dueños de la casa.
-- Se puede correr en el mismo proyecto de Gabinete: todas las tablas empiezan con casa_ y no tocan nada de Gabinete.
-- Correr una sola vez en Supabase → SQL Editor.

create extension if not exists pgcrypto;

-- Una casa (hogar). Una persona puede ser dueña de más de una.
create table if not exists casa_hogares(
  id uuid primary key default gen_random_uuid(),
  nombre text not null default 'Mi casa',
  pais text not null default '595',
  creado timestamptz not null default now()
);

-- Dueños / administradores: entran con su mail y un código.
create table if not exists casa_miembros(
  hogar_id uuid not null references casa_hogares on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  email text not null default '',
  nombre text not null default '',
  primary key(hogar_id,user_id)
);

-- Invitaciones a otros dueños (por mail). Al entrar con ese mail quedan sumados.
create table if not exists casa_invitaciones(
  hogar_id uuid not null references casa_hogares on delete cascade,
  email text not null,
  creado timestamptz not null default now(),
  primary key(hogar_id,email)
);

-- Todo lo demás (personal, tareas, recordatorios, listas, compras, visitas de jardín y piscina, historial)
-- es una fila por cosa, con sus datos en jsonb. El personal se identifica por su número de WhatsApp, sin mail.
create table if not exists casa_items(
  id uuid primary key,
  hogar_id uuid not null references casa_hogares on delete cascade,
  tipo text not null,
  datos jsonb not null default '{}'::jsonb,
  autor uuid,
  actualizado timestamptz not null default now()
);
create index if not exists casa_items_hogar on casa_items(hogar_id,tipo);
create index if not exists casa_items_token on casa_items((datos->>'token')) where tipo='personal';

create or replace function casa_es_miembro(h uuid) returns boolean
language sql security definer stable set search_path=public as $$
  select exists(select 1 from casa_miembros where hogar_id=h and user_id=auth.uid())
$$;

alter table casa_hogares enable row level security;
alter table casa_miembros enable row level security;
alter table casa_invitaciones enable row level security;
alter table casa_items enable row level security;

drop policy if exists casa_hogares_ver on casa_hogares;
create policy casa_hogares_ver on casa_hogares for select using (casa_es_miembro(id));
drop policy if exists casa_hogares_editar on casa_hogares;
create policy casa_hogares_editar on casa_hogares for update using (casa_es_miembro(id)) with check (casa_es_miembro(id));

drop policy if exists casa_miembros_ver on casa_miembros;
create policy casa_miembros_ver on casa_miembros for select using (casa_es_miembro(hogar_id));
drop policy if exists casa_miembros_quitar on casa_miembros;
create policy casa_miembros_quitar on casa_miembros for delete using (casa_es_miembro(hogar_id));
drop policy if exists casa_miembros_editar on casa_miembros;
create policy casa_miembros_editar on casa_miembros for update using (user_id=auth.uid()) with check (user_id=auth.uid());

drop policy if exists casa_inv_todo on casa_invitaciones;
create policy casa_inv_todo on casa_invitaciones for all using (casa_es_miembro(hogar_id)) with check (casa_es_miembro(hogar_id));

drop policy if exists casa_items_todo on casa_items;
create policy casa_items_todo on casa_items for all using (casa_es_miembro(hogar_id)) with check (casa_es_miembro(hogar_id));

create or replace function casa_items_tocar() returns trigger language plpgsql as $$
begin new.actualizado:=now(); return new; end $$;
drop trigger if exists casa_items_tocar on casa_items;
create trigger casa_items_tocar before update on casa_items for each row execute function casa_items_tocar();

-- Al entrar: acepta las invitaciones pendientes de mi mail y devuelve mis casas.
create or replace function casa_entrar() returns table(id uuid, nombre text, pais text)
language plpgsql security definer set search_path=public as $$
declare mail text := lower(coalesce(auth.jwt()->>'email',''));
begin
  if auth.uid() is null then return; end if;
  insert into casa_miembros(hogar_id,user_id,email)
    select i.hogar_id, auth.uid(), mail from casa_invitaciones i where lower(i.email)=mail
    on conflict do nothing;
  delete from casa_invitaciones where lower(email)=mail;
  return query select h.id,h.nombre,h.pais from casa_hogares h join casa_miembros m on m.hogar_id=h.id
    where m.user_id=auth.uid() order by h.creado;
end $$;

-- Crea una casa nueva con quien la crea como dueño.
create or replace function casa_crear_hogar(p_nombre text, p_mi_nombre text default '') returns uuid
language plpgsql security definer set search_path=public as $$
declare h uuid;
begin
  if auth.uid() is null then raise exception 'sin sesión'; end if;
  insert into casa_hogares(nombre) values (coalesce(nullif(trim(p_nombre),''),'Mi casa')) returning casa_hogares.id into h;
  insert into casa_miembros(hogar_id,user_id,email,nombre) values (h,auth.uid(),lower(coalesce(auth.jwt()->>'email','')),coalesce(p_mi_nombre,''));
  return h;
end $$;

-- Enlace personal del personal (sin cuenta ni mail): con el código secreto del enlace que le llega por WhatsApp
-- ve solo sus tareas y puede marcarlas como hechas. Si lo invitaron por WhatsApp y todavía no completó sus datos,
-- el enlace le pide su nombre y su número.
create or replace function casa_personal_ver(p_token text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare p casa_items; h casa_hogares;
begin
  if coalesce(length(p_token),0)<16 then return null; end if;
  select * into p from casa_items where tipo='personal' and datos->>'token'=p_token and coalesce((datos->>'activo')::boolean,true) limit 1;
  if not found then return null; end if;
  select * into h from casa_hogares where id=p.hogar_id;
  if coalesce((p.datos->>'pendiente')::boolean,false) then
    return jsonb_build_object('pendiente',true,'casa',h.nombre,'persona',jsonb_build_object('id',p.id,'rol',p.datos->>'rol'));
  end if;
  return jsonb_build_object(
    'persona', jsonb_build_object('id',p.id,'nombre',p.datos->>'nombre','rol',p.datos->>'rol'),
    'casa', h.nombre,
    'tareas', coalesce((select jsonb_agg(datos||jsonb_build_object('id',id)) from casa_items
       where hogar_id=p.hogar_id and tipo='tarea' and datos->>'resp'=p.id::text and not coalesce((datos->>'archivada')::boolean,false)),'[]'::jsonb),
    'pedidos', coalesce((select jsonb_agg(datos||jsonb_build_object('id',id) order by (datos->>'ts')::bigint desc) from casa_items
       where hogar_id=p.hogar_id and tipo='pedido' and datos->>'persona'=p.id::text
         and (not coalesce((datos->>'cerrado')::boolean,false) or (datos->>'cerradoTs')::bigint>(extract(epoch from now())*1000)::bigint-86400000)),'[]'::jsonb));
end $$;

-- La persona invitada completa su nombre y su número de WhatsApp desde el enlace y queda agregada al personal.
create or replace function casa_personal_alta(p_token text, p_nombre text, p_cel text) returns boolean
language plpgsql security definer set search_path=public as $$
declare p casa_items; n text := left(trim(coalesce(p_nombre,'')),60); c text := left(trim(coalesce(p_cel,'')),30);
begin
  if coalesce(length(p_token),0)<16 or n='' or length(regexp_replace(c,'\D','','g'))<6 then return false; end if;
  select * into p from casa_items where tipo='personal' and datos->>'token'=p_token
    and coalesce((datos->>'activo')::boolean,true) and coalesce((datos->>'pendiente')::boolean,false) limit 1;
  if not found then return false; end if;
  update casa_items set datos=datos||jsonb_build_object('nombre',n,'cel',c,'pendiente',false,'u',(extract(epoch from now())*1000)::bigint) where id=p.id;
  insert into casa_items(id,hogar_id,tipo,datos) values (gen_random_uuid(),p.hogar_id,'hist',jsonb_build_object(
    'ts',(extract(epoch from now())*1000)::bigint,'k','new','ref',p.id,'quien',n,
    'txt','se sumó al personal con el enlace de WhatsApp ('||coalesce(p.datos->>'rol','')||')'));
  return true;
end $$;

create or replace function casa_personal_marcar(p_token text, p_tarea uuid, p_fecha text, p_hecho boolean) returns boolean
language plpgsql security definer set search_path=public as $$
declare p casa_items; t casa_items;
begin
  if coalesce(length(p_token),0)<16 or p_fecha !~ '^(\d{4}-\d{2}-\d{2}|x)$' then return false; end if;
  select * into p from casa_items where tipo='personal' and datos->>'token'=p_token and coalesce((datos->>'activo')::boolean,true) limit 1;
  if not found then return false; end if;
  select * into t from casa_items where id=p_tarea and hogar_id=p.hogar_id and tipo='tarea' and datos->>'resp'=p.id::text;
  if not found then return false; end if;
  if p_hecho then
    update casa_items set datos=jsonb_set(datos,'{hechas}',coalesce(datos->'hechas','{}'::jsonb)||jsonb_build_object(p_fecha,
      jsonb_build_object('ts',(extract(epoch from now())*1000)::bigint,'por',p.datos->>'nombre')),true)
      where id=t.id;
  else
    update casa_items set datos=datos #- array['hechas',p_fecha] where id=t.id;
  end if;
  insert into casa_items(id,hogar_id,tipo,datos) values (gen_random_uuid(),p.hogar_id,'hist',jsonb_build_object(
    'ts',(extract(epoch from now())*1000)::bigint,'k',case when p_hecho then 'done' else 'reopen' end,
    'quien',p.datos->>'nombre','txt',case when p_hecho then 'marcó como hecha' else 'desmarcó' end||' «'||(t.datos->>'titulo')||'»'));
  return true;
end $$;

-- Pedidos de compras: cuando se manda una lista por WhatsApp queda guardado el pedido. La persona que hace las compras
-- marca desde su enlace cada cosa que compró; la lista de la casa se actualiza sola y el pedido queda en el historial.
create or replace function casa_personal_comprar(p_token text, p_pedido uuid, p_item text, p_hecho boolean) returns boolean
language plpgsql security definer set search_path=public as $$
declare p casa_items; pe casa_items; its jsonb; listo boolean; ms bigint := (extract(epoch from now())*1000)::bigint;
begin
  if coalesce(length(p_token),0)<16 then return false; end if;
  select * into p from casa_items where tipo='personal' and datos->>'token'=p_token and coalesce((datos->>'activo')::boolean,true)
    and not coalesce((datos->>'pendiente')::boolean,false) limit 1;
  if not found then return false; end if;
  select * into pe from casa_items where id=p_pedido and hogar_id=p.hogar_id and tipo='pedido' and datos->>'persona'=p.id::text;
  if not found then return false; end if;
  select jsonb_agg(case when e->>'id'=p_item then e||jsonb_build_object('ok',p_hecho) else e end order by n) into its
    from jsonb_array_elements(coalesce(pe.datos->'items','[]'::jsonb)) with ordinality x(e,n);
  if its is null then return false; end if;
  listo := not exists(select 1 from jsonb_array_elements(its) e where not coalesce((e->>'ok')::boolean,false));
  update casa_items set datos=datos||jsonb_build_object('items',its,'cerrado',listo,'cerradoTs',case when listo then ms else null end,'u',ms) where id=pe.id;
  update casa_items set datos=datos||jsonb_build_object('ok',p_hecho,'u',ms) where id::text=p_item and hogar_id=p.hogar_id and tipo='compra';
  if listo and not coalesce((pe.datos->>'cerrado')::boolean,false) then
    insert into casa_items(id,hogar_id,tipo,datos) values (gen_random_uuid(),p.hogar_id,'hist',jsonb_build_object(
      'ts',ms,'k','done','ref',pe.id,'quien',p.datos->>'nombre','txt','compró todo el pedido de '||coalesce(pe.datos->>'nombre','compras')));
  end if;
  return true;
end $$;

revoke all on function casa_personal_ver(text) from public;
revoke all on function casa_personal_marcar(text,uuid,text,boolean) from public;
grant execute on function casa_personal_ver(text) to anon, authenticated;
grant execute on function casa_personal_marcar(text,uuid,text,boolean) to anon, authenticated;
revoke all on function casa_personal_alta(text,text,text) from public;
grant execute on function casa_personal_alta(text,text,text) to anon, authenticated;
revoke all on function casa_personal_comprar(text,uuid,text,boolean) from public;
grant execute on function casa_personal_comprar(text,uuid,text,boolean) to anon, authenticated;
grant execute on function casa_entrar() to authenticated;
grant execute on function casa_crear_hogar(text,text) to authenticated;
-- Las tablas nuevas no quedan habilitadas solas en este proyecto: se dan a los dueños que entran con su mail.
grant select, insert, update, delete on public.casa_items, public.casa_invitaciones to authenticated;
grant select, update, delete on public.casa_miembros to authenticated;
grant select, update on public.casa_hogares to authenticated;
grant execute on function public.casa_es_miembro(uuid) to authenticated;

-- Cambios en vivo entre los dueños
do $$ begin
  alter publication supabase_realtime add table casa_items;
exception when duplicate_object then null; end $$;
