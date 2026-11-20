import { esObjeto, rotuloDeValor } from "./jsonSchema.js";
import type { Params } from "./esquema.js";
import type { DescriptorCapacidad } from "./registro.js";

/** Completa `{param}` con el valor de los params, usando el rótulo del schema si lo hay («FUNCIONANDO» → «Funcionando»). */
export function completarPlantilla(plantilla: string, params: Params, descriptor: DescriptorCapacidad | undefined): string {
  return plantilla.replace(/\{([A-Za-z0-9_]+)\}/g, (entero, clave: string) => (clave in params ? valorLegible(params[clave], clave, descriptor) : entero));
}

/** La frase de una condición según se cumpla o no: la plantilla del registro o, si no tiene, una genérica con su nombre. */
export function fraseDeCondicion(descriptor: DescriptorCapacidad | undefined, id: string, params: Params, cumple: boolean): string {
  if (descriptor?.texto) return completarPlantilla(cumple ? descriptor.texto.cumple : descriptor.texto.noCumple, params, descriptor);
  const nombre = descriptor?.nombre ?? id;
  const claves = Object.keys(params);
  const detalle = claves.length ? ` (${claves.map((k) => `${k}: ${valorLegible(params[k], k, descriptor)}`).join(", ")})` : "";
  return `${cumple ? "Se cumple" : "No se cumple"} «${nombre}»${detalle}`;
}

function valorLegible(valor: unknown, clave: string, descriptor: DescriptorCapacidad | undefined): string {
  const propiedades = descriptor?.schemaEntrada?.properties;
  const esquema = esObjeto(propiedades) && esObjeto(propiedades[clave]) ? propiedades[clave] : undefined;
  if (Array.isArray(valor)) {
    const items = esquema && esObjeto(esquema.items) ? esquema.items : undefined;
    return valor.map((v) => rotuloDeValor(items, v) ?? simple(v)).join(", ");
  }
  return rotuloDeValor(esquema, valor) ?? simple(valor);
}

function simple(v: unknown): string {
  return typeof v === "string" ? v : JSON.stringify(v);
}

export function minusculaInicial(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

export function mayusculaInicial(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Con mayúscula inicial y punto final. */
export function oracion(s: string): string {
  const t = mayusculaInicial(s.trim());
  return /[.!?:]$/.test(t) ? t : `${t}.`;
}

/** «a», «a y b», «a, b y c» (o con «o»). */
export function enumerar(partes: readonly string[], conjuncion: "y" | "o" = "y"): string {
  if (partes.length <= 1) return partes.join("");
  return `${partes.slice(0, -1).join(", ")} ${conjuncion} ${partes[partes.length - 1]}`;
}

export function entreComillas(s: string): string {
  return `«${s}»`;
}
