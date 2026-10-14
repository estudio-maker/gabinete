-- Gabinete · tableros privados
-- Un tablero privado solo lo ven quien lo creó, su responsable, las personas designadas y los administradores.
-- Sus tareas tampoco le llegan al resto, salvo a quien sea responsable de una tarea (esa tarea sí la ve).
-- La regla la aplica la base de datos. Solo AGREGA una columna y reemplaza reglas de acceso. No borra datos.
-- Ejecutar una vez en Supabase (SQL Editor). Se puede volver a ejecutar sin problema.

alter table public.projects add column if not exists private boolean not null default false;

-- ¿Puede la persona que consulta ver este tablero?
create or replace function public.can_see_project(p_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_id is null
      or not exists (select 1 from public.projects where id = p_id and private)
      or public.is_admin()
      or exists (select 1 from public.projects p where p.id = p_id
                 and (public.current_member_id() = p.created_by
                      or public.current_member_id() = p.lead
                      or public.current_member_id() = any(coalesce(p.team, '{}'::uuid[]))))
$$;

-- ¿Es responsable o creador de la tarea?
create or replace function public.in_task(p_created_by uuid, p_assignee uuid, p_co uuid[])
returns boolean language sql stable security definer set search_path = public as $$
  select public.current_member_id() = p_created_by
      or public.current_member_id() = p_assignee
      or public.current_member_id() = any(coalesce(p_co, '{}'::uuid[]))
$$;

-- Historial: además de las tareas privadas, respeta los tableros privados
create or replace function public.history_visible2(p_task uuid, p_project uuid, p_actor uuid, p_data jsonb)
returns boolean language sql stable security definer set search_path = public as $$
  select public.history_visible(p_task, p_actor, p_data) and (
    public.can_see_project(p_project)
    or p_actor = public.current_member_id()
    or exists (select 1 from public.tasks t where t.id = p_task and public.in_task(t.created_by, t.assignee_id, t.co_assignees))
  )
$$;
grant execute on function public.can_see_project(uuid), public.in_task(uuid, uuid, uuid[]), public.history_visible2(uuid, uuid, uuid, jsonb) to authenticated;
revoke execute on function public.can_see_project(uuid), public.in_task(uuid, uuid, uuid[]), public.history_visible2(uuid, uuid, uuid, jsonb) from anon;

-- Reglas de acceso a tableros
drop policy if exists projects_all on public.projects;
drop policy if exists projects_select on public.projects;
drop policy if exists projects_insert on public.projects;
drop policy if exists projects_update on public.projects;
drop policy if exists projects_delete on public.projects;
create policy projects_select on public.projects for select to authenticated
  using (public.is_member() and public.can_see_project(id));
create policy projects_insert on public.projects for insert to authenticated
  with check (public.is_member());
create policy projects_update on public.projects for update to authenticated
  using (public.is_member() and public.can_see_project(id))
  with check (public.is_member());
create policy projects_delete on public.projects for delete to authenticated
  using (public.is_member() and public.can_see_project(id));

-- Reglas de acceso a tareas (privadas + tableros privados)
drop policy if exists tasks_select on public.tasks;
drop policy if exists tasks_update on public.tasks;
drop policy if exists tasks_delete on public.tasks;
create policy tasks_select on public.tasks for select to authenticated
  using (public.is_member() and public.can_see_task(private, created_by, assignee_id, co_assignees)
         and (public.can_see_project(project_id) or public.in_task(created_by, assignee_id, co_assignees)));
create policy tasks_update on public.tasks for update to authenticated
  using (public.is_member() and public.can_see_task(private, created_by, assignee_id, co_assignees)
         and (public.can_see_project(project_id) or public.in_task(created_by, assignee_id, co_assignees)))
  with check (public.is_member());
create policy tasks_delete on public.tasks for delete to authenticated
  using (public.is_member() and public.can_see_task(private, created_by, assignee_id, co_assignees)
         and (public.can_see_project(project_id) or public.in_task(created_by, assignee_id, co_assignees)));

-- Reglas de acceso al historial
drop policy if exists history_read on public.history;
create policy history_read on public.history for select to authenticated
  using (public.is_member() and public.history_visible2(task_id, project_id, actor, data));

select 'ok' as resultado, (select count(*) from public.projects) as tableros, (select count(*) from public.tasks) as tareas;
