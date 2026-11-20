import { ErrorFlujo } from "./errores.js";
import type { Condicion, Params } from "./esquema.js";
import type { Registro } from "./registro.js";
import { enumerar, fraseDeCondicion, minusculaInicial } from "./textos.js";

/**
 * Evaluación de un árbol de condiciones. Devuelve el árbol evaluado (no solo un sí o un no), para que la app lo dibuje
 * como casilleros y para que `explicar` arme los motivos.
 *
 * - `todas` y `alguna` evalúan todos los hijos, sin cortar: así se puede decir todo lo que falta.
 * - `si/entonces` no evalúa la consecuencia si la premisa no se cumple: no aplica y no muestra casilleros.
 */

interface Base {
  /** Dónde está el nodo en la definición, por ejemplo «transiciones[3].requisitos.todas[1]». */
  ruta: string;
  cumple: boolean;
  mensaje?: string | undefined;
}

export type ResultadoCondicion =
  | (Base & { tipo: "hoja"; condicion: string; params: Params; texto: string })
  | (Base & { tipo: "todas" | "alguna"; hijos: ResultadoCondicion[] })
  | (Base & { tipo: "no"; hijo: ResultadoCondicion })
  | (Base & { tipo: "si"; aplica: boolean; si: ResultadoCondicion; entonces: ResultadoCondicion | null });

export function evaluarCondicion<C>(condicion: Condicion, contexto: C, registro: Registro<C>, ruta: string): ResultadoCondicion {
  const mensaje = condicion.mensaje;
  const extra = mensaje !== undefined ? { mensaje } : {};
  if ("condicion" in condicion) {
    const capacidad = registro.obtener(condicion.condicion);
    if (!capacidad) throw new ErrorFlujo("capacidad_desconocida", `La condición «${condicion.condicion}» (${ruta}) no está en el registro.`);
    if (capacidad.tipo !== "condicion") {
      throw new ErrorFlujo("tipo_de_capacidad", `«${condicion.condicion}» (${ruta}) es una capacidad de tipo ${capacidad.tipo}, no una condición.`);
    }
    const params = condicion.params ?? {};
    let cumple: boolean;
    try {
      cumple = capacidad.evaluar(params, contexto) === true;
    } catch (causa) {
      const detalle = causa instanceof Error ? causa.message : String(causa);
      throw new ErrorFlujo("condicion_fallo", `La condición «${condicion.condicion}» (${ruta}) falló al evaluarse: ${detalle}`, { cause: causa });
    }
    return { tipo: "hoja", ruta, cumple, condicion: condicion.condicion, params, texto: fraseDeCondicion(capacidad, condicion.condicion, params, cumple), ...extra };
  }
  if ("todas" in condicion || "alguna" in condicion) {
    const tipo = "todas" in condicion ? "todas" : "alguna";
    const lista = "todas" in condicion ? condicion.todas : condicion.alguna;
    const hijos = lista.map((c, i) => evaluarCondicion(c, contexto, registro, `${ruta}.${tipo}[${i}]`));
    const cumple = tipo === "todas" ? hijos.every((h) => h.cumple) : hijos.some((h) => h.cumple);
    return { tipo, ruta, cumple, hijos, ...extra };
  }
  if ("no" in condicion) {
    const hijo = evaluarCondicion(condicion.no, contexto, registro, `${ruta}.no`);
    return { tipo: "no", ruta, cumple: !hijo.cumple, hijo, ...extra };
  }
  const si = evaluarCondicion(condicion.si, contexto, registro, `${ruta}.si`);
  const entonces = si.cumple ? evaluarCondicion(condicion.entonces, contexto, registro, `${ruta}.entonces`) : null;
  return { tipo: "si", ruta, cumple: entonces === null || entonces.cumple, aplica: si.cumple, si, entonces, ...extra };
}

/** Por qué no se cumple, en frases cortas (una por cosa que falta). Vacío si se cumple. */
export function motivos(r: ResultadoCondicion): string[] {
  if (r.cumple) return [];
  if (r.mensaje !== undefined) return [r.mensaje];
  switch (r.tipo) {
    case "hoja":
      return [r.texto];
    case "todas":
      return r.hijos.flatMap(motivos);
    case "alguna": {
      const partes = r.hijos.map((h) => enumerar(motivos(h).map(minusculaInicial)));
      return partes.length === 1 ? motivos(r.hijos[0]!) : [`Hace falta al menos una de estas: ${enumerar(partes, "o")}`];
    }
    case "no":
      return [describir(r.hijo)];
    case "si":
      return motivos(r.entonces!).map((m) => `Como ${minusculaInicial(describir(r.si))}: ${minusculaInicial(m)}`);
  }
}

/** Lo que es verdad de un resultado, en una frase: para la premisa de un «si» o para lo que un «no» rechaza. */
export function describir(r: ResultadoCondicion): string {
  if (!r.cumple) return enumerar(motivos(r).map((m, i) => (i === 0 ? m : minusculaInicial(m))));
  switch (r.tipo) {
    case "hoja":
      return r.texto;
    case "todas":
      return enumerar(r.hijos.map((h, i) => (i === 0 ? describir(h) : minusculaInicial(describir(h)))));
    case "alguna": {
      const ciertos = r.hijos.filter((h) => h.cumple);
      return enumerar(ciertos.map((h, i) => (i === 0 ? describir(h) : minusculaInicial(describir(h)))));
    }
    case "no":
      return describir(r.hijo);
    case "si":
      return r.entonces ? `${describir(r.si)} y ${minusculaInicial(describir(r.entonces))}` : describir(r.si);
  }
}

/** Una hoja que aplica, para dibujarla como casillero: su texto y si está cumplida. */
export interface Casillero {
  condicion: string;
  params: Params;
  cumple: boolean;
  texto: string;
  ruta: string;
}

/**
 * Las hojas que aplican, en orden, para la web («casilleros»). No incluye la premisa de un «si» (no es algo que haya que
 * cumplir) ni la consecuencia de un «si» que no aplica: por eso los casilleros de una prueba que depende de una pieza
 * aparecen solo si la orden lleva esa pieza. Las hojas dentro de un «no» se devuelven con `cumple` invertido y la frase de lo que hay que evitar.
 */
export function casilleros(r: ResultadoCondicion | undefined): Casillero[] {
  if (!r) return [];
  switch (r.tipo) {
    case "hoja":
      return [{ condicion: r.condicion, params: r.params, cumple: r.cumple, texto: r.texto, ruta: r.ruta }];
    case "todas":
    case "alguna":
      return r.hijos.flatMap(casilleros);
    case "no":
      return casilleros(r.hijo).map((c) => ({ ...c, cumple: !c.cumple }));
    case "si":
      return r.entonces ? casilleros(r.entonces) : [];
  }
}
