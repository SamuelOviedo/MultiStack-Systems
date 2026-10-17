---
name: bitacora
description: Registra el cierre de una sesión de trabajo en la bitácora privada del proyecto, para que la próxima sesión retome sin depender del historial de Claude. Úsala al terminar una sesión, al cambiar de tarea grande o cuando el usuario diga que cerramos.
argument-hint: "[tema corto de la sesión]"
---

# Bitácora de cierre de sesión

Tema: $ARGUMENTS

La ruta de la bitácora está en `CLAUDE.local.md` (sección "Documentación privada"). Si no existe ese archivo o no puedes escribir en la ruta, muestra la entrada completa en el chat y pide al usuario que la guarde.

## 1. Reúne el estado real
- `git branch --show-current`, `git status --short` y `git log --oneline -10`.
- Ramas con trabajo sin publicar: `git for-each-ref --sort=-committerdate --format='%(refname:short) %(upstream:track)' refs/heads | head -15`.
- Lo que se hizo en esta sesión, según la conversación: tareas, decisiones, verificaciones y sus resultados.

## 2. Escribe la entrada
Archivo nuevo: `<bitácora>/AAAA-MM-DD-HHMM-<tema-en-kebab>.md`, con la fecha y hora locales de `date`.

```markdown
# <Tema> · <AAAA-MM-DD HH:MM>

## Resultado
Una o dos frases: qué quedó hecho.

## Estado del repo
- Rama actual y último commit.
- Ramas locales con trabajo sin publicar y para qué es cada una.

## Decisiones tomadas
- Decisión, quién la tomó y por qué.

## Pendiente del propietario
- Acciones que solo el propietario puede hacer (producción, secretos, merge, Dashboard).

## Siguiente paso
- La primera cosa que debe hacer la próxima sesión, con el comando o archivo concreto.

## Referencias
- Documentos privados, PR, commits y tareas `T-*` relacionados.
```

## 3. Actualiza el índice
Agrega una línea al principio de la lista en `<bitácora>/BITACORA.md`: `- AAAA-MM-DD HH:MM · <tema> · <resultado en una línea> → <archivo>`. Si el índice no existe, créalo con el título `# Bitácora de sesiones`.

## Reglas
- Nunca escribas secretos, tokens, claves, contraseñas, IP, ni correos o teléfonos de clientes.
- Hechos verificados, no suposiciones: si algo no se comprobó, márcalo como `[sin verificar]`.
- La bitácora es privada: nunca copies su contenido a archivos del repositorio.
