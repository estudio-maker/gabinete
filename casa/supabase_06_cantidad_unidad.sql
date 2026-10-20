-- Casa · 06: cantidad y unidad en cada cosa de las compras, editables por los dueños y por el personal desde su enlace.
-- Se puede correr varias veces.

-- El personal agrega con cantidad y unidad.
create or replace function casa_personal_agregar_compra(p_token text, p_lista uuid, p_txt text, p_cant text, p_unid text) returns boolean
language plpgsql security definer set search_path=public as $$
declare p casa_items; l uuid; t text := left(trim(coalesce(p_txt,'')),80); c text := left(trim(coalesce(p_cant,'')),20);
  un text := left(trim(coalesce(p_unid,'')),20); ms bigint := (extract(epoch from now())*1000)::bigint; ln text;
begin
  if coalesce(length(p_token),0)<16 or t='' then return false; end if;
  select * into p from casa_items where tipo='personal' and datos->>'token'=p_token and coalesce((datos->>'activo')::boolean,true)
    and not coalesce((datos->>'pendiente')::boolean,false) limit 1;
  if not found then return false; end if;
  if (select count(*) from casa_items where hogar_id=p.hogar_id and tipo='compra' and not coalesce((datos->>'ok')::boolean,false))>=300 then return false; end if;
  select id, datos->>'nombre' into l, ln from casa_items where hogar_id=p.hogar_id and tipo='lista' and (p_lista is null or id=p_lista)
    order by coalesce((datos->>'orden')::numeric,0) limit 1;
  if l is null then
    if p_lista is not null then return false; end if;
    l := gen_random_uuid(); ln := 'Supermercado';
    insert into casa_items(id,hogar_id,tipo,datos) values (l,p.hogar_id,'lista',jsonb_build_object('nombre',ln,'orden',0,'frec','{}'::jsonb,'u',ms));
  end if;
  insert into casa_items(id,hogar_id,tipo,datos) values (gen_random_uuid(),p.hogar_id,'compra',jsonb_build_object(
    'lista',l,'txt',t,'cant',c,'unid',un,'ok',false,'orden',ms,'por',p.datos->>'nombre','u',ms));
  insert into casa_items(id,hogar_id,tipo,datos) values (gen_random_uuid(),p.hogar_id,'hist',jsonb_build_object(
    'ts',ms,'k','new','quien',p.datos->>'nombre','txt','agregó «'||t||'» a la lista de '||coalesce(ln,'compras')));
  return true;
end $$;

-- El personal cambia la cantidad o la unidad de algo que falta comprar.
create or replace function casa_personal_editar_compra(p_token text, p_compra uuid, p_campo text, p_valor text) returns boolean
language plpgsql security definer set search_path=public as $$
declare p casa_items; v text := left(trim(coalesce(p_valor,'')),20); ms bigint := (extract(epoch from now())*1000)::bigint;
begin
  if coalesce(length(p_token),0)<16 or p_campo not in ('cant','unid') then return false; end if;
  select * into p from casa_items where tipo='personal' and datos->>'token'=p_token and coalesce((datos->>'activo')::boolean,true)
    and not coalesce((datos->>'pendiente')::boolean,false) limit 1;
  if not found then return false; end if;
  update casa_items set datos=datos||jsonb_build_object(p_campo,v,'u',ms)
    where id=p_compra and hogar_id=p.hogar_id and tipo='compra' and not coalesce((datos->>'ok')::boolean,false);
  if not found then return false; end if;
  -- también en los pedidos abiertos que la incluyen
  update casa_items set datos=datos||jsonb_build_object('u',ms,'items',(select jsonb_agg(case when e->>'id'=p_compra::text then e||jsonb_build_object(p_campo,v) else e end order by n)
      from jsonb_array_elements(datos->'items') with ordinality x(e,n)))
    where hogar_id=p.hogar_id and tipo='pedido' and not coalesce((datos->>'cerrado')::boolean,false)
      and jsonb_typeof(datos->'items')='array' and datos->'items' @> jsonb_build_array(jsonb_build_object('id',p_compra::text));
  return true;
end $$;

-- Las compras del enlace del personal traen la unidad.
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
         and (not coalesce((datos->>'cerrado')::boolean,false) or (datos->>'cerradoTs')::bigint>(extract(epoch from now())*1000)::bigint-86400000)),'[]'::jsonb),
    'listas', coalesce((select jsonb_agg(jsonb_build_object('id',id,'nombre',datos->>'nombre') order by coalesce((datos->>'orden')::numeric,0)) from casa_items
       where hogar_id=p.hogar_id and tipo='lista'),'[]'::jsonb),
    'compras', coalesce((select jsonb_agg(jsonb_build_object('id',id,'lista',datos->>'lista','txt',datos->>'txt','cant',datos->>'cant','unid',datos->>'unid','por',datos->>'por')
         order by coalesce((datos->>'orden')::numeric,0)) from casa_items
       where hogar_id=p.hogar_id and tipo='compra' and not coalesce((datos->>'ok')::boolean,false)),'[]'::jsonb),
    'servicios', coalesce((select jsonb_agg(jsonb_build_object('clave',s.datos->>'clave','persona',pp.datos->>'nombre')) from casa_items s
       left join casa_items pp on pp.hogar_id=s.hogar_id and pp.tipo='personal' and pp.id::text=s.datos->>'persona'
       where s.hogar_id=p.hogar_id and s.tipo='servicio'),'[]'::jsonb),
    'visitas', coalesce((select jsonb_agg(jsonb_build_object('id',id,'servicio',datos->>'servicio','fecha',datos->>'fecha','llegada',datos->>'llegada','por',datos->>'por')
         order by datos->>'fecha' desc) from casa_items
       where hogar_id=p.hogar_id and tipo='visita' and datos->>'fecha'>=to_char(current_date-7,'YYYY-MM-DD')),'[]'::jsonb));
end $$;

revoke all on function casa_personal_agregar_compra(text,uuid,text,text,text) from public;
grant execute on function casa_personal_agregar_compra(text,uuid,text,text,text) to anon, authenticated;
revoke all on function casa_personal_editar_compra(text,uuid,text,text) from public;
grant execute on function casa_personal_editar_compra(text,uuid,text,text) to anon, authenticated;
