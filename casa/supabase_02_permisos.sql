-- Casa · permisos de las tablas para los dueños que entran con su mail.
-- En este proyecto de Supabase las tablas nuevas no quedan habilitadas solas: hay que darlas explícitamente
-- (lo mismo que hace Gabinete en supabase/01_esquema.sql). Correr una vez después de casa/supabase.sql.
grant select, insert, update, delete on public.casa_items, public.casa_invitaciones to authenticated;
grant select, update, delete on public.casa_miembros to authenticated;
grant select, update on public.casa_hogares to authenticated;
grant execute on function public.casa_es_miembro(uuid) to authenticated;
