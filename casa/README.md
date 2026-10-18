# Casa · manejo del hogar

App para el celular de los dueños de una casa: el personal doméstico, sus tareas, recordatorios,
control del jardinero y el piscinero, y las listas de compras. Misma base y diseño que Gabinete
(un solo `index.html`, se publica con GitHub Pages en `/casa/`).

## Qué tiene

- **Personal**: se agrega solo con nombre y número de WhatsApp (sin mail). Días y horario de cada persona.
- **Tareas**: tablero con una columna por persona. Tareas de una vez o que se repiten (todos los días,
  ciertos días de la semana, cada mes). Botón para mandarle a cada persona sus tareas del día por WhatsApp.
- **Jardín y piscina**: quién viene y qué días, registro de cada visita (horario, qué hizo, pH y cloro
  de la piscina, productos, monto y si se pagó). Avisa cuando un día que tocaba no se registró la visita.
- **Compras**: listas (Súper, Verdulería, Farmacia, Ferretería y las que quieras), lo que comprás seguido
  a un toque, y envío de la lista por WhatsApp.
- **Recordatorios**: pagos, mantenimiento, cumpleaños; se repiten cada semana, mes o año y se pueden
  agregar al calendario del celular (archivo .ics con aviso).
- **Calendario** e **Historial**.

## Dos formas de usarla

1. **Sin cuenta**: todo queda guardado en ese celular. Sirve para probarla ya (hay datos de ejemplo en Ajustes).
2. **Con cuenta** (los dueños entran con su mail y un código, como en Gabinete): los datos se comparten
   entre los dueños de la casa y cada persona del personal recibe un **enlace propio** por WhatsApp donde ve
   sus tareas y las marca como hechas, sin cuenta ni mail.

Para activar la opción con cuenta hay que correr una vez `casa/supabase.sql` en el SQL Editor de Supabase.
Usa el mismo proyecto de Gabinete: todas las tablas empiezan con `casa_` y no tocan nada de Gabinete.
La plantilla del mail de acceso tiene que mandar el código (`{{ .Token }}`), igual que en Gabinete.
