import type { EsquemaJson } from "./registro.js";
/**
 * Validador de un SUBCONJUNTO de JSON Schema, para los params de las capacidades sin sumar ajv como dependencia.
 *
 * Entiende: type (también en lista, con integer), enum, const, oneOf/anyOf (alcanza con que cumpla una), properties,
 * required, additionalProperties (false o un schema), items, minItems, maxItems, minLength, maxLength, minimum,
 * maximum y pattern. Las demás palabras ($ref, allOf, format, if/then...) se ignoran. Si una app necesita el estándar
 * completo, le pasa su validador a `validarDefinicion` en `opciones.validarEsquema`.
 *
 * Devuelve la lista de problemas en castellano; vacía si el valor cumple.
 */
export declare function validarJsonSchema(valor: unknown, esquema: EsquemaJson, ruta?: string): string[];
/** El rótulo de un valor según el schema: el `title` de su `const` en un `oneOf`/`anyOf`, o null si no hay. */
export declare function rotuloDeValor(esquema: EsquemaJson | undefined, valor: unknown): string | null;
export declare function esObjeto(v: unknown): v is Record<string, unknown>;
