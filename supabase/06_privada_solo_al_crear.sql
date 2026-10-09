-- Gabinete · Las tareas solo pueden ser privadas desde que se crean.
-- Una tarea visible (incluidas todas las que ya existían) nunca puede pasar a privada.
-- Una privada sí puede hacerse visible.
create or replace function public.guard_private_flag() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.private and not coalesce(old.private, false) then
    new.private := false;
  end if;
  return new;
end $$;
drop trigger if exists tasks_guard_private on public.tasks;
create trigger tasks_guard_private before update on public.tasks for each row execute function public.guard_private_flag();

-- Comprobación: intentar ocultar una tarea existente no debe tener efecto
update public.tasks set private = true where id = (select id from public.tasks order by created_at limit 1);
select 'ok' as resultado, (select count(*) from public.tasks) as tareas, (select count(*) from public.tasks where private) as privadas;
