# Casa · manejo del hogar

App para el celular de los dueños de una casa: el personal doméstico, sus tareas, recordatorios,
control del jardinero y el piscinero, y las listas de compras. Misma base y diseño que Gabinete
(un solo `index.html`, se publica con GitHub Pages en `/casa/`).

## Qué tiene

- **Personal**: se agrega solo con nombre y número de WhatsApp (sin mail), o se lo invita por WhatsApp con un enlace
  y la persona completa sus datos sola. Días y horario de cada persona, y registro de ausencias (falta, enfermedad, permiso, vacaciones).
- **Tareas**: tablero con una columna por persona. Tareas de una vez o que se repiten (todos los días,
  ciertos días de la semana, cada mes). Botón para mandarle a cada persona sus tareas del día por WhatsApp.
- **Jardín y piscina**: quién viene y qué días, registro de cada visita (horario, qué hizo, pH y cloro
  de la piscina, productos, monto y si se pagó). Avisa cuando un día que tocaba no se registró la visita.
- **Compras**: listas (Súper, Verdulería, Farmacia, Ferretería y las que quieras), lo que comprás seguido
  a un toque. Los productos quedan guardados: cada vez que se pide la lista por WhatsApp queda registrado el pedido,
  quien hace las compras marca «Comprado» desde su enlace, y «Pedir todo de nuevo» vuelve a armar la lista con lo de siempre.
- **Recordatorios**: pagos, mantenimiento, cumpleaños; se repiten cada semana, mes o año y se pueden
  agregar al calendario del celular (archivo .ics con aviso).
- **Resumen** con gráficos del mes: tareas cumplidas por día y por persona, ausencias, gastos de jardín y piscina,
  lo que más se compra y la evolución del pH y el cloro.
- **Calendario** con tareas, recordatorios, visitas, ausencias, pedidos y lo que quedó registrado cada día, e **Historial**.

## Dos formas de usarla

1. **Sin cuenta**: todo queda guardado en ese celular. Sirve para probarla ya (hay datos de ejemplo en Ajustes).
2. **Con cuenta** (los dueños entran con su mail y un código, como en Gabinete): los datos se comparten
   entre los dueños de la casa y cada persona del personal recibe un **enlace propio** por WhatsApp donde ve
   sus tareas y las marca como hechas, sin cuenta ni mail. Desde ese enlace también anota lo que falta comprar
   y marca si vino el jardinero o el piscinero.

Para activar la opción con cuenta hay que correr una vez `casa/supabase.sql` (si ya se había corrido una versión anterior, correr también `casa/supabase_02_permisos.sql` `casa/supabase_03_personal_y_compras.sql` `casa/supabase_04_acceso.sql` y `casa/supabase_05_personal_carga.sql`) en el SQL Editor de Supabase.
Usa el mismo proyecto de Gabinete: todas las tablas empiezan con `casa_` y no tocan nada de Gabinete.
La plantilla del mail de acceso tiene que mandar el código (`{{ .Token }}`), igual que en Gabinete.

## Acceso solo por invitación

Con `casa/supabase_04_acceso.sql` solo entran los mails que el administrador autoriza desde Ajustes → Clientes autorizados.
El administrador se agrega una vez en Supabase con `insert into casa_admins(email) values ('mail') on conflict do nothing;`.
