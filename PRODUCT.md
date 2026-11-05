# Product

<!-- impeccable:product-schema 1 -->

<!-- Redactado a mano siguiendo reference/init.md de Impeccable, sin ejecutar su motor ni crear .impeccable/. Documento público: no incluir costos, márgenes, estrategia comercial ni datos de clientes. -->

## Platform

web

## Users

- **Administrador (propietario)**: gestiona proyectos, solicitudes, tickets y renovaciones de todos los clientes. Usa el panel varias veces al día, en escritorio, con la tarea clara: ver qué requiere atención y resolverlo.
- **Colaborador**: ve y atiende los proyectos y tickets que le asignan. Mismo uso diario, con menos permisos.
- **Cliente**: no usa el panel. Tiene su propio portal (solicitudes y acceso por enlace) con otro alcance; el rediseño del panel no lo cambia.

## Product Purpose

MultiStack Systems es un ecosistema de productos con una sola entrada. Los productos vigentes salen de `src/lib/products.ts`: TechOn (soporte técnico y gestión de solicitudes, disponible), Licensing (licencias de software, en preparación), Development (desarrollo a medida, gestionado desde MultiStack) y WhatsApp (atención por WhatsApp, en desarrollo).

El panel de administración es la herramienta interna del equipo para operar ese ecosistema: proyectos con su pipeline de etapas, servicios y renovaciones, tickets de soporte y solicitudes nuevas. Éxito: el equipo sabe en segundos qué está pendiente, qué vence y qué cliente espera respuesta.

## Operating Context

- Se usa a diario y en jornadas largas; la velocidad de lectura importa más que la expresión.
- Los datos reales viven en Supabase; la interfaz solo los presenta. Las barreras de acceso son del servidor, no de lo que la pantalla oculte.
- Idioma de la interfaz: español neutro. Fechas y números con formato `es-HN`.
- Tema claro y oscuro, elegible por la persona.

## Capabilities and Constraints

- Hoy existen: inicio con resumen, proyectos (detalle, servicios, tickets, acceso del portal, mantenimiento mensual) y bandeja de tickets.
- Los vocabularios de estado (proyecto, ticket, prioridad) son los del código; el diseño no inventa estados nuevos.
- Los módulos aún sin datos reales (por ejemplo clientes comerciales, finanzas) solo pueden mostrarse como demostración, rotulados como tales.
- El repositorio es público: ningún dato de cliente, secreto ni documentación operativa entra en archivos versionados.

## Brand Commitments

- Nombre: MultiStack Systems. Identidad continua con la landing, el inicio de sesión y el portal.
- Colores de estado siempre por tokens (`success`, `warning`, `destructive`), nunca valores sueltos.

## Product Principles

1. **Sobrio.** Superficies planas, un solo acento, sin degradados ni efectos de vidrio. La marca vive en los detalles precisos, no en la decoración.
2. **Denso pero legible.** Más información por pantalla sin apretar: 14 px de base, cifras tabulares, jerarquía clara entre título, dato y apoyo.
3. **El estado nunca depende solo del color.** Texto más indicador, con contraste AA en claro y oscuro.
4. **Honesto con lo que no existe.** Lo ficticio se rotula como demostración; lo vacío explica qué hacer; lo que falla dice qué pasó y cómo reintentar, sin mensajes técnicos crudos.
5. **Movimiento mínimo.** Se usa para confirmar una acción o mostrar un cambio, nunca para decorar lo que se ve decenas de veces al día.

## Accessibility & Inclusion

- Objetivo mínimo: WCAG 2.2 AA (contraste de texto 4,5:1, foco visible, operable por teclado, nombres accesibles).
- Respetar `prefers-reduced-motion`: menos movimiento y más suave, no cero.
- Español neutro, frases cortas y verbos claros en botones y mensajes.
