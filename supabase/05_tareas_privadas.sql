-- Gabinete · Actualización: tareas privadas
-- Una tarea privada solo la ven (en cualquier pantalla, también el historial) quien la creó y sus responsables.
-- La regla la aplica la base de datos: el resto del equipo directamente no la recibe.
-- Solo AGREGA una columna y reemplaza las reglas de acceso de tareas e historial. No borra datos.

alter table public.tasks add column if not exists private boolean not null default false;

-- ¿Puede la persona que consulta ver esta tarea?
create or replace function public.can_see_task(p_private boolean, p_created_by uuid, p_assignee uuid, p_co uuid[])
returns boolean language sql stable security definer set search_path = public as $$
  select not coalesce(p_private, false)
      or public.current_member_id() = p_created_by
      or public.current_member_id() = p_assignee
      or public.current_member_id() = any(coalesce(p_co, '{}'::uuid[]))
$$;

-- ¿Puede ver este movimiento del historial?
create or replace function public.history_visible(p_task uuid, p_actor uuid, p_data jsonb)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when p_task is null then true
    when exists (select 1 from public.tasks where id = p_task) then
      exists (select 1 from public.tasks t where t.id = p_task and public.can_see_task(t.private, t.created_by, t.assignee_id, t.co_assignees))
    else coalesce((p_data ->> 'priv')::boolean, false) = false or p_actor = public.current_member_id()
  end
$$;
grant execute on function public.can_see_task(boolean, uuid, uuid, uuid[]), public.history_visible(uuid, uuid, jsonb) to authenticated;
revoke execute on function public.can_see_task(boolean, uuid, uuid, uuid[]), public.history_visible(uuid, uuid, jsonb) from anon;

-- Reglas de acceso a tareas
drop policy if exists tasks_all on public.tasks;
drop policy if exists tasks_select on public.tasks;
drop policy if exists tasks_insert on public.tasks;
drop policy if exists tasks_update on public.tasks;
drop policy if exists tasks_delete on public.tasks;
create policy tasks_select on public.tasks for select to authenticated
  using (public.is_member() and public.can_see_task(private, created_by, assignee_id, co_assignees));
create policy tasks_insert on public.tasks for insert to authenticated
  with check (public.is_member());
create policy tasks_update on public.tasks for update to authenticated
  using (public.is_member() and public.can_see_task(private, created_by, assignee_id, co_assignees))
  with check (public.is_member());
create policy tasks_delete on public.tasks for delete to authenticated
  using (public.is_member() and public.can_see_task(private, created_by, assignee_id, co_assignees));

-- Reglas de acceso al historial
drop policy if exists history_read on public.history;
create policy history_read on public.history for select to authenticated
  using (public.is_member() and public.history_visible(task_id, actor, data));

select 'ok' as resultado, (select count(*) from public.tasks) as tareas_intactas;
