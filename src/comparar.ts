import { ErrorFlujo } from "./errores.js";
import type { Condicion, Decision, DefinicionFlujo, Estado, Transicion } from "./esquema.js";
import { jsonCanonico } from "./huella.js";
import { aplicaDesde } from "./interprete.js";
import { esObjeto } from "./jsonSchema.js";
import { mapaDeDescriptores, type EsquemaJson, type FuenteDescriptores } from "./registro.js";
import { entreComillas, enumerar } from "./textos.js";

/**
 * Comparar dos versiones (de una definición, de un JSON Schema o de un registro) y clasificar cada cambio.
 *
 * La pregunta es siempre la misma: **lo que valía con la versión vieja, ¿sigue valiendo con la nueva?** Un cambio es
 * `compatible` si sí (una instancia o un dato de la versión vieja pasa a la nueva sin que le exijan reglas nuevas) y
 * `rompe` si no, o si no se puede asegurar: la comparación es conservadora y ante la duda dice `rompe`.
 */

export type NivelCambio = "compatible" | "rompe";

export type CodigoCambio =
  // Definiciones de flujo
  | "datos_cambiados"
  | "estado_inicial_cambiado"
  | "estado_agregado"
  | "estado_quitado"
  | "estado_modificado"
  | "decision_agregada"
  | "decision_quitada"
  | "decision_modificada"
  | "transicion_agregada"
  | "transicion_quitada"
  | "transicion_modificada"
  | "accion_cambiada"
  | "desde_ampliado"
  | "desde_reducido"
  | "hacia_cambiado"
  | "requisitos_relajados"
  | "requisitos_endurecidos"
  | "sugerencias_cambiadas"
  | "efectos_cambiados"
  // JSON Schema
  | "esquema_relajado"
  | "esquema_endurecido"
  | "esquema_anotacion"
  // Registros de capacidades
  | "capacidad_agregada"
  | "capacidad_quitada"
  | "capacidad_tipo_cambiado"
  | "capacidad_modificada";

export interface Cambio {
  nivel: NivelCambio;
  codigo: CodigoCambio;
  /** Dónde, con ids en vez de posiciones (cambian entre versiones), por ejemplo `transiciones[cerrar].requisitos`. */
  ruta: string;
  mensaje: string;
}

export interface Comparacion {
  /** `true` si ningún cambio rompe. Sin cambios también es `true`. */
  compatible: boolean;
  cambios: Cambio[];
}

const iguales = (a: unknown, b: unknown) => jsonCanonico(a ?? null) === jsonCanonico(b ?? null);

function resultado(cambios: Cambio[]): Comparacion {
  return { compatible: cambios.every((c) => c.nivel === "compatible"), cambios };
}

// ---------------------------------------------------------------------------------------------------------------------
// Definiciones de flujo

/**
 * Compara dos versiones de una definición. Estados, decisiones y transiciones se emparejan por `id`: cambiarle el id a
 * algo es quitarlo y agregar otro.
 *
 * Rompe: quitar un estado, una decisión o una transición; achicar el `desde`; cambiar la acción o el `hacia` de una
 * transición; cambiar las ramas o el `sino` de una decisión; endurecer los `requisitos` (o no poder probar que no se
 * endurecieron). Lo demás es compatible: agregar, ampliar el `desde`, relajar requisitos, cambiar sugerencias, efectos,
 * nombres, `final`, el estado inicial o los metadatos.
 *
 * Falla con `ErrorFlujo` («versiones_mezcladas») si las dos definiciones son de flujos distintos.
 */
export function compararFlujos(antes: DefinicionFlujo, despues: DefinicionFlujo): Comparacion {
  if (antes.id !== despues.id) {
    throw new ErrorFlujo("versiones_mezcladas", `No se pueden comparar versiones de flujos distintos: ${entreComillas(antes.id)} y ${entreComillas(despues.id)}.`);
  }
  const cambios: Cambio[] = [];
  const cambio = (nivel: NivelCambio, codigo: CodigoCambio, ruta: string, mensaje: string) => cambios.push({ nivel, codigo, ruta, mensaje });

  for (const campo of ["nombre", "descripcion", "metadatos"] as const) {
    if (!iguales(antes[campo], despues[campo])) cambio("compatible", "datos_cambiados", campo, `Cambió «${campo}» del flujo.`);
  }
  if (antes.estadoInicial !== despues.estadoInicial) {
    cambio(
      "compatible",
      "estado_inicial_cambiado",
      "estadoInicial",
      `El estado inicial pasó de ${entreComillas(antes.estadoInicial)} a ${entreComillas(despues.estadoInicial)}: solo afecta a las instancias nuevas.`,
    );
  }

  // Estados.
  emparejar(antes.estados, despues.estados, {
    agregado: (e) => cambio("compatible", "estado_agregado", `estados[${e.id}]`, `Se agregó el estado ${entreComillas(e.nombre)}.`),
    quitado: (e) => cambio("rompe", "estado_quitado", `estados[${e.id}]`, `Se quitó el estado ${entreComillas(e.nombre)}: las instancias que estén ahí no tienen dónde seguir.`),
    ambos: (a, d) => {
      const distintos = camposDistintos<Estado>(a, d, ["nombre", "descripcion", "final", "alEntrar"]);
      if (distintos.length) cambio("compatible", "estado_modificado", `estados[${a.id}]`, `Cambió ${enumerar(distintos)} del estado ${entreComillas(d.nombre)}.`);
    },
  });

  // Decisiones: cambian adónde lleva una transición, así que tocar sus ramas rompe.
  emparejar(antes.decisiones ?? [], despues.decisiones ?? [], {
    agregado: (d) => cambio("compatible", "decision_agregada", `decisiones[${d.id}]`, `Se agregó la decisión ${entreComillas(d.nombre)}.`),
    quitado: (d) => cambio("rompe", "decision_quitada", `decisiones[${d.id}]`, `Se quitó la decisión ${entreComillas(d.nombre)}.`),
    ambos: (a, d) => {
      if (!iguales(sinMensajes(a.ramas), sinMensajes(d.ramas)) || a.sino !== d.sino) {
        cambio("rompe", "decision_modificada", `decisiones[${a.id}]`, `Cambiaron las ramas de la decisión ${entreComillas(d.nombre)}: puede llevar a otro lado.`);
      } else {
        const distintos = camposDistintos<Decision>(a, d, ["nombre", "descripcion", "ramas"]);
        if (distintos.length) cambio("compatible", "decision_modificada", `decisiones[${a.id}]`, `Cambió ${enumerar(distintos)} de la decisión ${entreComillas(d.nombre)}.`);
      }
    },
  });

  // Transiciones.
  const comunes = antes.estados.filter((e) => despues.estados.some((x) => x.id === e.id));
  emparejar(antes.transiciones, despues.transiciones, {
    agregado: (t) => cambio("compatible", "transicion_agregada", `transiciones[${t.id}]`, `Se agregó la transición ${entreComillas(t.id)} (${entreComillas(t.accion)}).`),
    quitado: (t) => cambio("rompe", "transicion_quitada", `transiciones[${t.id}]`, `Se quitó la transición ${entreComillas(t.id)} (${entreComillas(t.accion)}).`),
    ambos: (a, d) => {
      const ruta = `transiciones[${a.id}]`;
      const id = entreComillas(a.id);
      if (a.accion !== d.accion) {
        cambio("rompe", "accion_cambiada", `${ruta}.accion`, `La transición ${id} pasó de la acción ${entreComillas(a.accion)} a ${entreComillas(d.accion)}.`);
      }
      // `desde` se compara por los estados que están en las dos versiones; los quitados ya rompen por su cuenta.
      const perdidos = comunes.filter((e) => aplicaDesde(a, e.id) && !aplicaDesde(d, e.id));
      const ganados = comunes.filter((e) => !aplicaDesde(a, e.id) && aplicaDesde(d, e.id));
      if (perdidos.length) {
        cambio("rompe", "desde_reducido", `${ruta}.desde`, `La transición ${id} ya no se puede hacer desde ${enumerar(perdidos.map((e) => entreComillas(e.nombre)))}.`);
      }
      if (ganados.length) {
        cambio("compatible", "desde_ampliado", `${ruta}.desde`, `La transición ${id} ahora también se puede hacer desde ${enumerar(ganados.map((e) => entreComillas(e.nombre)))}.`);
      }
      if (a.hacia !== d.hacia) {
        const destino = (h: string | undefined) => (h === undefined ? "ningún lado (no cambiaba de estado)" : entreComillas(h));
        cambio("rompe", "hacia_cambiado", `${ruta}.hacia`, `La transición ${id} llevaba a ${destino(a.hacia)} y ahora lleva a ${destino(d.hacia)}.`);
      }
      if (!iguales(sinMensajes(a.requisitos), sinMensajes(d.requisitos))) {
        if (d.requisitos === undefined || (a.requisitos !== undefined && implica(a.requisitos, d.requisitos))) {
          cambio("compatible", "requisitos_relajados", `${ruta}.requisitos`, `Los requisitos de ${id} no piden nada que antes no se pidiera.`);
        } else {
          cambio("rompe", "requisitos_endurecidos", `${ruta}.requisitos`, `Los requisitos de ${id} piden algo nuevo (o no se puede asegurar que no).`);
        }
      } else if (!iguales(a.requisitos, d.requisitos)) {
        cambio("compatible", "transicion_modificada", `${ruta}.requisitos`, `Cambiaron los mensajes de los requisitos de ${id}, no lo que piden.`);
      }
      if (!iguales(a.sugerencias, d.sugerencias)) cambio("compatible", "sugerencias_cambiadas", `${ruta}.sugerencias`, `Cambiaron las sugerencias de ${id} (no bloquean).`);
      if (!iguales(a.efectos, d.efectos)) cambio("compatible", "efectos_cambiados", `${ruta}.efectos`, `Cambiaron los efectos de ${id}.`);
      if (a.nombre !== d.nombre) cambio("compatible", "transicion_modificada", `${ruta}.nombre`, `Cambió el nombre de ${id}.`);
    },
  });

  return resultado(cambios);
}

function emparejar<T extends { id: string }>(
  antes: readonly T[],
  despues: readonly T[],
  que: { agregado: (x: T) => void; quitado: (x: T) => void; ambos: (a: T, d: T) => void },
) {
  const nuevos = new Map(despues.map((x) => [x.id, x]));
  for (const a of antes) {
    const d = nuevos.get(a.id);
    if (d) que.ambos(a, d);
    else que.quitado(a);
  }
  const viejos = new Set(antes.map((x) => x.id));
  for (const d of despues) if (!viejos.has(d.id)) que.agregado(d);
}

function camposDistintos<T>(a: T, d: T, campos: readonly (keyof T & string)[]): string[] {
  return campos.filter((c) => !iguales(a[c], d[c])).map((c) => `«${c}»`);
}

/** Copia sin los `mensaje` (cambian el texto, no la regla) y sin `params` vacíos (es lo mismo que no tenerlos). */
function sinMensajes(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(sinMensajes);
  if (!esObjeto(valor)) return valor;
  const salida: Record<string, unknown> = {};
  for (const [clave, v] of Object.entries(valor)) {
    if (clave === "mensaje" || (clave === "params" && esObjeto(v) && !Object.keys(v).length)) continue;
    salida[clave] = clave === "params" ? v : sinMensajes(v);
  }
  return salida;
}

/**
 * ¿Todo contexto que cumple `a` cumple también `b`? Prueba sintáctica y conservadora: si devuelve `true` es seguro; si
 * devuelve `false`, puede ser que sí pero no se pudo probar.
 */
export function implica(a: Condicion, b: Condicion): boolean {
  if (iguales(sinMensajes(a), sinMensajes(b))) return true;
  if ("todas" in b) return b.todas.every((x) => implica(a, x));
  if ("alguna" in a) return a.alguna.every((x) => implica(x, b));
  if ("todas" in a && a.todas.some((x) => implica(x, b))) return true;
  if ("alguna" in b && b.alguna.some((x) => implica(a, x))) return true;
  if ("si" in b) {
    // a ⇒ q alcanza para a ⇒ (p → q); y (p → q) ⇒ (p' → q') si p' ⇒ p y q ⇒ q'.
    if (implica(a, b.entonces)) return true;
    if ("si" in a && implica(b.si, a.si) && implica(a.entonces, b.entonces)) return true;
  }
  if ("no" in a && "no" in b) return implica(b.no, a.no);
  return false;
}

// ---------------------------------------------------------------------------------------------------------------------
// JSON Schema

/** Palabras que solo describen y no cambian qué valores se aceptan. */
const ANOTACIONES = new Set(["title", "description", "default", "examples", "$comment", "deprecated", "readOnly", "writeOnly", "$schema", "$id"]);

/** Palabras que el comparador entiende (las mismas que valida `validarJsonSchema`). */
const ENTENDIDAS = new Set([
  "type",
  "enum",
  "const",
  "oneOf",
  "anyOf",
  "properties",
  "required",
  "additionalProperties",
  "items",
  "minLength",
  "maxLength",
  "minItems",
  "maxItems",
  "minimum",
  "maximum",
  "pattern",
]);

/**
 * Compara dos JSON Schema (por ejemplo, el `schemaEntrada` de una capacidad en dos versiones de la app). Es compatible si
 * todo valor que aceptaba el viejo lo acepta el nuevo; si no se puede asegurar, rompe.
 *
 * Entiende el mismo subconjunto que `validarJsonSchema`. Cambiar una anotación (`title`, `description`, `default`…) es
 * compatible; cambiar cualquier otra palabra que no entiende (`$ref`, `allOf`, `format`, `if`…) rompe, por las dudas.
 * `undefined` es «sin schema»: acepta cualquier cosa.
 */
export function compararEsquemas(antes: EsquemaJson | undefined, despues: EsquemaJson | undefined, ruta = "schema"): Comparacion {
  const cambios: Cambio[] = [];
  compararNodo(antes ?? {}, despues ?? {}, ruta, cambios);
  return resultado(cambios);
}

function compararNodo(antesValor: unknown, despuesValor: unknown, ruta: string, cambios: Cambio[]): void {
  // `true` y `{}` aceptan todo; `false` no acepta nada.
  const a = normalizar(antesValor);
  const d = normalizar(despuesValor);
  const relajado = (donde: string, mensaje: string): void => void cambios.push({ nivel: "compatible", codigo: "esquema_relajado", ruta: donde, mensaje });
  const endurecido = (donde: string, mensaje: string): void => void cambios.push({ nivel: "rompe", codigo: "esquema_endurecido", ruta: donde, mensaje });
  if (a === false) {
    if (d !== false) relajado(ruta, "Antes no aceptaba ningún valor.");
    return;
  }
  if (d === false) return endurecido(ruta, "Ahora no acepta ningún valor.");
  if (iguales(a, d)) return;

  // type
  if (!iguales(a.type, d.type)) {
    const tiposA = listaDeTipos(a.type);
    const tiposD = listaDeTipos(d.type);
    const cubre = tiposD === null || (tiposA !== null && tiposA.every((t) => tiposD.includes(t) || (t === "integer" && tiposD.includes("number"))));
    if (cubre) relajado(`${ruta}.type`, "Acepta más tipos.");
    else endurecido(`${ruta}.type`, tiposA === null ? "Antes aceptaba cualquier tipo." : "Dejó de aceptar algún tipo.");
  }

  // enum y const: listas de valores permitidos.
  if (!iguales(a.enum, d.enum)) compararValores(a.enum, d.enum, `${ruta}.enum`, relajado, endurecido);
  if ("const" in a !== "const" in d || !iguales(a.const, d.const)) {
    compararValores("const" in a ? [a.const] : undefined, "const" in d ? [d.const] : undefined, `${ruta}.const`, relajado, endurecido);
  }

  // oneOf / anyOf: con todas constantes se comparan como listas de valores; si no, solo si quedan iguales.
  for (const clave of ["oneOf", "anyOf"] as const) {
    if (iguales(a[clave], d[clave])) continue;
    const valoresA = constantes(a[clave]);
    const valoresD = constantes(d[clave]);
    if (d[clave] === undefined) relajado(`${ruta}.${clave}`, `Ya no tiene «${clave}».`);
    else if (valoresA && valoresD) compararValores(valoresA, valoresD, `${ruta}.${clave}`, relajado, endurecido);
    else if (iguales(sinAnotaciones(a[clave]), sinAnotaciones(d[clave]))) anotacion(`${ruta}.${clave}`, cambios);
    else endurecido(`${ruta}.${clave}`, `Cambió «${clave}» y no se puede asegurar que acepte lo mismo.`);
  }

  // required
  if (!iguales(a.required, d.required)) {
    const reqA = listaDeTextos(a.required);
    const nuevos = listaDeTextos(d.required).filter((r) => !reqA.includes(r));
    if (nuevos.length) endurecido(`${ruta}.required`, `Ahora es obligatorio: ${enumerar(nuevos.map((r) => `«${r}»`))}.`);
    else relajado(`${ruta}.required`, "Pide menos campos obligatorios.");
  }

  // properties y additionalProperties: cada propiedad, con el schema que la cubría antes y el que la cubre ahora.
  const propsA = esObjeto(a.properties) ? a.properties : {};
  const propsD = esObjeto(d.properties) ? d.properties : {};
  for (const clave of new Set([...Object.keys(propsA), ...Object.keys(propsD)])) {
    const viejo = clave in propsA ? propsA[clave] : (a.additionalProperties ?? true);
    const nuevo = clave in propsD ? propsD[clave] : (d.additionalProperties ?? true);
    compararNodo(viejo, nuevo, `${ruta}.properties.${clave}`, cambios);
  }
  if (!iguales(a.additionalProperties, d.additionalProperties)) {
    compararNodo(a.additionalProperties ?? true, d.additionalProperties ?? true, `${ruta}.additionalProperties`, cambios);
  }

  // items
  if (!iguales(a.items, d.items)) compararNodo(a.items ?? true, d.items ?? true, `${ruta}.items`, cambios);

  // Mínimos y máximos.
  for (const [clave, esMinimo] of [
    ["minLength", true],
    ["maxLength", false],
    ["minItems", true],
    ["maxItems", false],
    ["minimum", true],
    ["maximum", false],
  ] as const) {
    const va = a[clave];
    const vd = d[clave];
    if (va === vd) continue;
    if (typeof vd !== "number") relajado(`${ruta}.${clave}`, `Ya no tiene «${clave}».`);
    else if (typeof va === "number" && (esMinimo ? vd <= va : vd >= va)) relajado(`${ruta}.${clave}`, `«${clave}» pasó de ${va} a ${vd}.`);
    else endurecido(`${ruta}.${clave}`, typeof va === "number" ? `«${clave}» pasó de ${va} a ${vd}.` : `Ahora tiene «${clave}»: ${vd}.`);
  }

  if (a.pattern !== d.pattern) {
    if (d.pattern === undefined) relajado(`${ruta}.pattern`, "Ya no tiene «pattern».");
    else endurecido(`${ruta}.pattern`, "Cambió «pattern» y no se puede asegurar que acepte lo mismo.");
  }

  // Lo que no entiende: las anotaciones no cambian nada; lo demás, por las dudas, rompe.
  for (const clave of new Set([...Object.keys(a), ...Object.keys(d)])) {
    if (ENTENDIDAS.has(clave) || iguales(a[clave], d[clave])) continue;
    if (ANOTACIONES.has(clave)) anotacion(`${ruta}.${clave}`, cambios);
    else endurecido(`${ruta}.${clave}`, `Cambió «${clave}», que el comparador no entiende: no se puede asegurar que acepte lo mismo.`);
  }
}

function normalizar(valor: unknown): Record<string, unknown> | false {
  if (valor === false) return false;
  return esObjeto(valor) ? valor : {};
}

function anotacion(ruta: string, cambios: Cambio[]) {
  cambios.push({ nivel: "compatible", codigo: "esquema_anotacion", ruta, mensaje: "Cambió una anotación (no cambia qué valores acepta)." });
}

function listaDeTipos(type: unknown): string[] | null {
  if (type === undefined) return null;
  return Array.isArray(type) ? type.map(String) : [String(type)];
}

function listaDeTextos(valor: unknown): string[] {
  return Array.isArray(valor) ? valor.map(String) : [];
}

/** Los valores de un `oneOf`/`anyOf` hecho solo de `const`, o null si tiene otra cosa. */
function constantes(opciones: unknown): unknown[] | null {
  if (!Array.isArray(opciones) || !opciones.every((o) => esObjeto(o) && "const" in o)) return null;
  return opciones.map((o) => (o as { const: unknown }).const);
}

function sinAnotaciones(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(sinAnotaciones);
  if (!esObjeto(valor)) return valor;
  return Object.fromEntries(Object.entries(valor).filter(([k]) => !ANOTACIONES.has(k)).map(([k, v]) => [k, sinAnotaciones(v)]));
}

/** Compara listas de valores permitidos (`undefined` = sin lista, acepta todo). */
function compararValores(
  antes: unknown,
  despues: unknown,
  ruta: string,
  relajado: (ruta: string, mensaje: string) => void,
  endurecido: (ruta: string, mensaje: string) => void,
) {
  if (!Array.isArray(despues)) return relajado(ruta, "Ya no limita los valores.");
  if (!Array.isArray(antes)) return endurecido(ruta, "Ahora limita los valores.");
  const nuevos = new Set(despues.map((v) => jsonCanonico(v)));
  const perdidos = antes.filter((v) => !nuevos.has(jsonCanonico(v)));
  if (perdidos.length) endurecido(ruta, `Ya no acepta ${enumerar(perdidos.map((v) => JSON.stringify(v)))}.`);
  else relajado(ruta, "Acepta más valores.");
}

// ---------------------------------------------------------------------------------------------------------------------
// Registros de capacidades

/**
 * Compara dos registros (o listas de descriptores), por ejemplo antes y después de actualizar la app. Rompe: quitar una
 * capacidad, cambiarle el tipo o endurecer su `schemaEntrada` (ver `compararEsquemas`). Agregar capacidades o cambiar
 * nombres, textos, descripciones o grupos es compatible.
 *
 * Es una mirada general: para saber si una definición concreta sigue andando con el registro nuevo, la respuesta exacta
 * es `validarDefinicion(definicion, registroNuevo)`.
 */
export function compararCapacidades(antes: FuenteDescriptores, despues: FuenteDescriptores): Comparacion {
  const cambios: Cambio[] = [];
  const viejas = mapaDeDescriptores(antes);
  const nuevas = mapaDeDescriptores(despues);
  for (const [id, a] of viejas) {
    const ruta = `capacidades[${id}]`;
    const d = nuevas.get(id);
    if (!d) {
      cambios.push({ nivel: "rompe", codigo: "capacidad_quitada", ruta, mensaje: `Se quitó la capacidad ${entreComillas(id)}.` });
      continue;
    }
    if (a.tipo !== d.tipo) {
      cambios.push({ nivel: "rompe", codigo: "capacidad_tipo_cambiado", ruta: `${ruta}.tipo`, mensaje: `${entreComillas(id)} pasó de ser ${a.tipo} a ${d.tipo}.` });
      continue;
    }
    cambios.push(...compararEsquemas(a.schemaEntrada, d.schemaEntrada, `${ruta}.schemaEntrada`).cambios);
    const distintos = (["nombre", "descripcion", "texto", "grupo"] as const).filter((c) => !iguales(a[c], d[c]));
    if (distintos.length) {
      cambios.push({ nivel: "compatible", codigo: "capacidad_modificada", ruta, mensaje: `Cambió ${enumerar(distintos.map((c) => `«${c}»`))} de ${entreComillas(id)}.` });
    }
  }
  for (const id of nuevas.keys()) {
    if (!viejas.has(id)) cambios.push({ nivel: "compatible", codigo: "capacidad_agregada", ruta: `capacidades[${id}]`, mensaje: `Se agregó la capacidad ${entreComillas(id)}.` });
  }
  return resultado(cambios);
}
