-- Casa · personal por WhatsApp y pedidos de compras.
-- 1) Invitar al personal con un enlace por WhatsApp: la persona completa su nombre y su número y queda agregada sola.
-- 2) Pedidos de compras: el personal marca desde su enlace lo que compró y el pedido queda en el historial.
-- Correr una vez en Supabase → SQL Editor (después de casa/supabase.sql).

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
    'recordatorios', coalesce((select jsonb_agg(datos||jsonb_build_object('id',id)) from casa_items
       where hogar_id=p.hogar_id and tipo='recordatorio' and datos->>'resp'=p.id::text),'[]'::jsonb),
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

revoke all on function casa_personal_alta(text,text,text) from public;
grant execute on function casa_personal_alta(text,text,text) to anon, authenticated;

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

revoke all on function casa_personal_comprar(text,uuid,text,boolean) from public;
grant execute on function casa_personal_comprar(text,uuid,text,boolean) to anon, authenticated;
