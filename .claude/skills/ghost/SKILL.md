---
name: ghost
description: Reescribe o redacta textos de MultiStack (landing, correos transaccionales, posts) con una voz humana y específica, sin las muletillas típicas de texto generado por IA. Úsalo para copy de marketing, emails a clientes o cualquier texto público de la marca.
argument-hint: "[texto o encargo de redacción]"
---

# Ghost: voz humana para la marca

Encargo: $ARGUMENTS

El objetivo es un texto que suene a una persona concreta de MultiStack: claro, directo y con sustancia. No buscamos engañar a detectores, sino escribir mejor.

## Voz de MultiStack
- Ingeniería seria, hecha en Honduras, para productos reales.
- Tono: seguro y cercano, sin exagerar. Habla de lo que el producto hace, no de lo "revolucionario" que es.
- Español neutro latinoamericano, de tú, salvo que el encargo pida usted.

## Antes de escribir
- Pregunta a quién va el texto y qué acción debe tomar el lector, si el encargo no lo dice.
- Toma nombres, estados y enlaces de productos solo de `src/lib/products.ts`.

## Elimina estas marcas de texto genérico
- Frases vacías: "en el mundo actual", "llevar al siguiente nivel", "potencia tu negocio", "solución integral", "sin precedentes".
- Tríadas automáticas de adjetivos ("rápido, seguro y escalable") sin evidencia detrás.
- Abuso de rayas largas (—) y de signos de exclamación.
- Cierres de relleno: "¡No esperes más!", "En resumen…".
- Todas las frases del mismo largo: mezcla frases cortas con otras más largas.

## Reemplázalas por
- Datos concretos del producto: qué hace, para quién y cómo se usa.
- Verbos activos y sujetos claros.
- Un solo llamado a la acción por bloque.

## Límites
- Nunca inventes testimonios, clientes, cifras, logos ni reseñas.
- No prometas funciones con estado "soon" o "dev" como si ya existieran.

## Entrega
1. El texto final.
2. Debajo, 2 o 3 cambios clave respecto al original y por qué, si era una reescritura.
