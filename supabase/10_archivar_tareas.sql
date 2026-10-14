-- Gabinete · archivar tareas terminadas
-- Ejecutar una vez en Supabase (SQL Editor). Se puede volver a ejecutar sin problema.

alter table public.tasks add column if not exists archived boolean not null default false;

select 'ok' as resultado, (select count(*) from public.tasks where archived) as archivadas;
