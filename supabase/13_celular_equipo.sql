-- Gabinete · celular (WhatsApp) de cada persona del equipo, para mandarle recordatorios de tareas
-- Ejecutar una vez en Supabase (SQL Editor). Se puede volver a ejecutar sin problema.

alter table public.members add column if not exists phone text default '';

select 'ok' as resultado, (select count(*) from public.members where coalesce(phone,'') <> '') as con_celular;
