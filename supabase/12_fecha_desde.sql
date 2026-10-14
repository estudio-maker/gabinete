-- Gabinete · fecha "Desde" (inicio) opcional en las tareas
-- Ejecutar una vez en Supabase (SQL Editor). Se puede volver a ejecutar sin problema.

alter table public.tasks add column if not exists start_date date;

select 'ok' as resultado, (select count(*) from public.tasks where start_date is not null) as con_desde;
