---
name: l99
description: Análisis de máxima profundidad para decisiones de arquitectura, refactors de impacto amplio o bugs difíciles de diagnosticar. Se invoca con /l99 seguido de la pregunta.
argument-hint: "[pregunta o decisión a analizar]"
disable-model-invocation: true
effort: max
---

# L99: análisis de nivel experto

Pregunta: $ARGUMENTS

Responde a nivel de ingeniero principal, sin simplificar. Sigue estos pasos en orden.

## 1. Encuadre
- Reformula el problema en una sola frase.
- Lista los supuestos que estás haciendo.

## 2. Evidencia antes que opinión
- Lee los archivos implicados antes de afirmar nada sobre ellos.
- Ejecuta `codegraph impact <Símbolo>` sobre cada símbolo que la decisión afecte.
- Si la pregunta toca datos, revisa `src/lib/*` y los tipos de `src/integrations/supabase/`.

## 3. Alternativas
- Propón al menos 2 alternativas reales. Incluye "no hacer nada" cuando sea una opción válida.
- Compáralas en una tabla con estas columnas: costo, riesgo, reversibilidad y archivos afectados.

## 4. Recomendación
- Elige una alternativa y justifícala.
- Di qué evidencia te haría cambiar de opinión.

## 5. Cero alucinaciones
- Marca cada afirmación como `[verificado en código]`, `[inferido]` o `[no sé]`.
- Si no conoces el impacto de un cambio, dilo y propone cómo averiguarlo.
- Nunca inventes APIs, versiones de librerías ni comportamientos del repo.

## Formato de salida
1. Resumen en 3 líneas.
2. Tabla de alternativas.
3. Recomendación.
4. Incertidumbres abiertas.

No escribas código de producción. Solo un esbozo mínimo si ayuda a explicar una alternativa.
