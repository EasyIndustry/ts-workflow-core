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
export function validarJsonSchema(valor: unknown, esquema: EsquemaJson, ruta = "params"): string[] {
  const problemas: string[] = [];
  const s = esquema as Record<string, unknown>;

  if (s.type !== undefined) {
    const tipos = Array.isArray(s.type) ? (s.type as string[]) : [s.type as string];
    if (!tipos.some((t) => esDelTipo(valor, t))) {
      return [`${ruta}: se esperaba ${tipos.map(nombreDeTipo).join(" o ")} y llegó ${describirValor(valor)}`];
    }
  }
  if (Array.isArray(s.enum) && !s.enum.some((v) => iguales(v, valor))) {
    problemas.push(`${ruta}: ${describirValor(valor)} no es uno de los valores permitidos (${s.enum.map((v) => JSON.stringify(v)).join(", ")})`);
  }
  if ("const" in s && !iguales(s.const, valor)) {
    problemas.push(`${ruta}: tiene que ser ${JSON.stringify(s.const)}`);
  }
  for (const clave of ["oneOf", "anyOf"] as const) {
    const opciones = s[clave];
    if (Array.isArray(opciones) && opciones.length && !opciones.some((o) => validarJsonSchema(valor, o as EsquemaJson, ruta).length === 0)) {
      const constantes = opciones.filter((o): o is { const: unknown } => typeof o === "object" && o !== null && "const" in o);
      problemas.push(
        constantes.length === opciones.length
          ? `${ruta}: ${describirValor(valor)} no es uno de los valores permitidos (${constantes.map((o) => JSON.stringify(o.const)).join(", ")})`
          : `${ruta}: no cumple ninguna de las opciones permitidas`,
      );
    }
  }

  if (typeof valor === "string") {
    if (typeof s.minLength === "number" && valor.length < s.minLength) problemas.push(`${ruta}: tiene que tener al menos ${s.minLength} caracteres`);
    if (typeof s.maxLength === "number" && valor.length > s.maxLength) problemas.push(`${ruta}: tiene que tener como mucho ${s.maxLength} caracteres`);
    if (typeof s.pattern === "string" && !new RegExp(s.pattern, "u").test(valor)) problemas.push(`${ruta}: no tiene el formato esperado`);
  }
  if (typeof valor === "number") {
    if (typeof s.minimum === "number" && valor < s.minimum) problemas.push(`${ruta}: tiene que ser al menos ${s.minimum}`);
    if (typeof s.maximum === "number" && valor > s.maximum) problemas.push(`${ruta}: tiene que ser como mucho ${s.maximum}`);
  }
  if (Array.isArray(valor)) {
    if (typeof s.minItems === "number" && valor.length < s.minItems) problemas.push(`${ruta}: tiene que tener al menos ${s.minItems} elementos`);
    if (typeof s.maxItems === "number" && valor.length > s.maxItems) problemas.push(`${ruta}: tiene que tener como mucho ${s.maxItems} elementos`);
    if (esObjeto(s.items)) valor.forEach((v, i) => problemas.push(...validarJsonSchema(v, s.items as EsquemaJson, `${ruta}[${i}]`)));
  }
  if (esObjeto(valor)) {
    const propiedades = esObjeto(s.properties) ? (s.properties as Record<string, EsquemaJson>) : {};
    if (Array.isArray(s.required)) {
      for (const clave of s.required as string[]) if (!(clave in valor)) problemas.push(`${ruta}.${clave}: falta y es obligatorio`);
    }
    for (const [clave, v] of Object.entries(valor)) {
      const propio = propiedades[clave];
      if (propio) problemas.push(...validarJsonSchema(v, propio, `${ruta}.${clave}`));
      else if (s.additionalProperties === false) problemas.push(`${ruta}.${clave}: no es un parámetro conocido`);
      else if (esObjeto(s.additionalProperties)) problemas.push(...validarJsonSchema(v, s.additionalProperties as EsquemaJson, `${ruta}.${clave}`));
    }
  }
  return problemas;
}

/** El rótulo de un valor según el schema: el `title` de su `const` en un `oneOf`/`anyOf`, o null si no hay. */
export function rotuloDeValor(esquema: EsquemaJson | undefined, valor: unknown): string | null {
  if (!esquema) return null;
  for (const clave of ["oneOf", "anyOf"] as const) {
    const opciones = (esquema as Record<string, unknown>)[clave];
    if (!Array.isArray(opciones)) continue;
    for (const o of opciones) {
      if (esObjeto(o) && "const" in o && iguales(o.const, valor) && typeof o.title === "string") return o.title;
    }
  }
  return null;
}

export function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function esDelTipo(v: unknown, tipo: string): boolean {
  switch (tipo) {
    case "string":
      return typeof v === "string";
    case "number":
      return typeof v === "number" && Number.isFinite(v);
    case "integer":
      return typeof v === "number" && Number.isInteger(v);
    case "boolean":
      return typeof v === "boolean";
    case "array":
      return Array.isArray(v);
    case "object":
      return esObjeto(v);
    case "null":
      return v === null;
    default:
      return true;
  }
}

const NOMBRES: Record<string, string> = {
  string: "un texto",
  number: "un número",
  integer: "un número entero",
  boolean: "verdadero o falso",
  array: "una lista",
  object: "un objeto",
  null: "null",
};

function nombreDeTipo(t: string) {
  return NOMBRES[t] ?? t;
}

function describirValor(v: unknown): string {
  if (v === undefined) return "nada";
  if (Array.isArray(v)) return "una lista";
  if (esObjeto(v)) return "un objeto";
  return JSON.stringify(v);
}

function iguales(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
