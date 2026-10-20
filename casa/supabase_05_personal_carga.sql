-- Casa · 05: el personal carga compras y marca las visitas del jardinero y el piscinero desde su enlace.
-- Se puede correr varias veces.

-- El enlace del personal ahora también trae las listas con lo que falta comprar y las visitas de los últimos días.
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
    'compras', coalesce((select jsonb_agg(jsonb_build_object('id',id,'lista',datos->>'lista','txt',datos->>'txt','cant',datos->>'cant','por',datos->>'por')
         order by coalesce((datos->>'orden')::numeric,0)) from casa_items
       where hogar_id=p.hogar_id and tipo='compra' and not coalesce((datos->>'ok')::boolean,false)),'[]'::jsonb),
    'servicios', coalesce((select jsonb_agg(jsonb_build_object('clave',s.datos->>'clave','persona',pp.datos->>'nombre')) from casa_items s
       left join casa_items pp on pp.hogar_id=s.hogar_id and pp.tipo='personal' and pp.id::text=s.datos->>'persona'
       where s.hogar_id=p.hogar_id and s.tipo='servicio'),'[]'::jsonb),
    'visitas', coalesce((select jsonb_agg(jsonb_build_object('id',id,'servicio',datos->>'servicio','fecha',datos->>'fecha','llegada',datos->>'llegada','por',datos->>'por')
         order by datos->>'fecha' desc) from casa_items
       where hogar_id=p.hogar_id and tipo='visita' and datos->>'fecha'>=to_char(current_date-7,'YYYY-MM-DD')),'[]'::jsonb));
end $$;

-- Agrega algo a la lista de compras de la casa. Si la casa no tiene listas, crea «Supermercado».
create or replace function casa_personal_agregar_compra(p_token text, p_lista uuid, p_txt text, p_cant text) returns boolean
language plpgsql security definer set search_path=public as $$
declare p casa_items; l uuid; t text := left(trim(coalesce(p_txt,'')),80); c text := left(trim(coalesce(p_cant,'')),20);
  ms bigint := (extract(epoch from now())*1000)::bigint; ln text;
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
    'lista',l,'txt',t,'cant',c,'ok',false,'orden',ms,'por',p.datos->>'nombre','u',ms));
  insert into casa_items(id,hogar_id,tipo,datos) values (gen_random_uuid(),p.hogar_id,'hist',jsonb_build_object(
    'ts',ms,'k','new','quien',p.datos->>'nombre','txt','agregó «'||t||'» a la lista de '||coalesce(ln,'compras')));
  return true;
end $$;

-- Marca que vino el jardinero o el piscinero (hoy o hasta 3 días atrás). Queda como visita, igual que si la cargara el dueño.
create or replace function casa_personal_visita(p_token text, p_servicio text, p_fecha text, p_llegada text, p_nota text) returns boolean
language plpgsql security definer set search_path=public as $$
declare p casa_items; sp text; ms bigint := (extract(epoch from now())*1000)::bigint; f date;
  hr text := coalesce(p_llegada,''); n text := left(trim(coalesce(p_nota,'')),300);
begin
  if coalesce(length(p_token),0)<16 or p_servicio not in ('jardin','piscina') or coalesce(p_fecha,'') !~ '^\d{4}-\d{2}-\d{2}$' then return false; end if;
  f := p_fecha::date;
  if f>current_date+1 or f<current_date-4 then return false; end if;
  if hr !~ '^([01]\d|2[0-3]):[0-5]\d$' then hr := ''; end if;
  select * into p from casa_items where tipo='personal' and datos->>'token'=p_token and coalesce((datos->>'activo')::boolean,true)
    and not coalesce((datos->>'pendiente')::boolean,false) limit 1;
  if not found then return false; end if;
  if exists(select 1 from casa_items where hogar_id=p.hogar_id and tipo='visita' and datos->>'servicio'=p_servicio and datos->>'fecha'=p_fecha) then return true; end if;
  select datos->>'persona' into sp from casa_items where hogar_id=p.hogar_id and tipo='servicio' and datos->>'clave'=p_servicio limit 1;
  insert into casa_items(id,hogar_id,tipo,datos) values (gen_random_uuid(),p.hogar_id,'visita',jsonb_build_object(
    'servicio',p_servicio,'persona',coalesce(sp,''),'fecha',p_fecha,'llegada',hr,'salida','','trabajos','[]'::jsonb,
    'monto','','pagado',false,'nota',n,'por',p.datos->>'nombre','u',ms));
  insert into casa_items(id,hogar_id,tipo,datos) values (gen_random_uuid(),p.hogar_id,'hist',jsonb_build_object(
    'ts',ms,'k','vis','quien',p.datos->>'nombre',
    'txt','marcó que vino '||case when p_servicio='jardin' then 'el jardinero' else 'el piscinero' end||' el '||to_char(f,'DD/MM')));
  return true;
end $$;

revoke all on function casa_personal_agregar_compra(text,uuid,text,text) from public;
grant execute on function casa_personal_agregar_compra(text,uuid,text,text) to anon, authenticated;
revoke all on function casa_personal_visita(text,text,text,text,text) from public;
grant execute on function casa_personal_visita(text,text,text,text,text) to anon, authenticated;
