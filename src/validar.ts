import { parsearDefinicion, type Condicion, type DefinicionFlujo, type Efecto, type Params } from "./esquema.js";
import { jsonCanonico } from "./huella.js";
import { aplicaDesde } from "./interprete.js";
import { validarJsonSchema } from "./jsonSchema.js";
import { mapaDeDescriptores, type DescriptorCapacidad, type EsquemaJson, type FuenteDescriptores, type TipoCapacidad } from "./registro.js";
import { entreComillas, enumerar } from "./textos.js";

/**
 * Validación de una definición: el schema y después el grafo (referencias, ciclos de decisiones, ambigüedad, estados
 * alcanzables, callejones) y, si se pasa el registro, las capacidades y sus params. Mensajes en castellano con la ruta.
 */

export type CodigoProblema =
  | "esquema"
  | "id_duplicado"
  | "referencia_inexistente"
  | "no_es_estado"
  | "excepto_sin_comodin"
  | "ciclo_de_decisiones"
  | "transicion_ambigua"
  | "reaccion_vacia"
  | "reaccion_ambigua"
  | "reaccion_fuera_de_transicion"
  | "estado_inalcanzable"
  | "decision_inalcanzable"
  | "callejon"
  | "sin_estado_final"
  | "capacidad_desconocida"
  | "tipo_de_capacidad"
  | "params_invalidos";

export interface Problema {
  codigo: CodigoProblema;
  mensaje: string;
  /** Dónde, por ejemplo «transiciones[2].requisitos.todas[1]». Vacío si es de toda la definición. */
  ruta: string;
}

export interface ResultadoValidacion {
  valido: boolean;
  errores: Problema[];
  avisos: Problema[];
  /** La definición parseada, si pasó el schema (aunque tenga errores de grafo). */
  definicion?: DefinicionFlujo;
}

export interface OpcionesValidacion {
  /** Reemplaza al validador de JSON Schema del core (un subconjunto) por uno completo, como ajv. Devuelve los problemas. */
  validarEsquema?: (valor: unknown, esquema: EsquemaJson) => string[];
}

export function validarDefinicion(valor: unknown, registro?: FuenteDescriptores, opciones: OpcionesValidacion = {}): ResultadoValidacion {
  const parseo = parsearDefinicion(valor);
  if (!parseo.success) {
    const errores = parseo.error.issues.map((i) => ({ codigo: "esquema" as const, mensaje: i.message, ruta: formatearRuta(i.path) }));
    return { valido: false, errores, avisos: [] };
  }
  const def = parseo.data;
  const errores: Problema[] = [];
  const avisos: Problema[] = [];
  const error = (codigo: CodigoProblema, mensaje: string, ruta = "") => errores.push({ codigo, mensaje, ruta });
  const aviso = (codigo: CodigoProblema, mensaje: string, ruta = "") => avisos.push({ codigo, mensaje, ruta });

  const estados = new Set(def.estados.map((e) => e.id));
  const decisiones = new Map((def.decisiones ?? []).map((d) => [d.id, d]));

  // --- Ids repetidos: estados y decisiones comparten espacio (los dos son destinos); las transiciones van aparte.
  const nodos = [...def.estados.map((e, i) => ({ id: e.id, ruta: `estados[${i}]` })), ...(def.decisiones ?? []).map((d, i) => ({ id: d.id, ruta: `decisiones[${i}]` }))];
  repetidos(nodos).forEach(({ id, ruta }) => error("id_duplicado", `El id ${entreComillas(id)} está repetido entre estados y decisiones.`, ruta));
  repetidos(def.transiciones.map((t, i) => ({ id: t.id, ruta: `transiciones[${i}]` }))).forEach(({ id, ruta }) =>
    error("id_duplicado", `Hay dos transiciones con el id ${entreComillas(id)}.`, ruta),
  );

  // --- Referencias.
  const debeSerEstado = (id: string, ruta: string, que: string) => {
    if (estados.has(id)) return;
    if (decisiones.has(id)) error("no_es_estado", `${que} tiene que ser un estado y ${entreComillas(id)} es una decisión.`, ruta);
    else error("referencia_inexistente", `${que}: el estado ${entreComillas(id)} no existe.`, ruta);
  };
  const debeExistir = (id: string, ruta: string, que: string) => {
    if (!estados.has(id) && !decisiones.has(id)) error("referencia_inexistente", `${que}: ${entreComillas(id)} no es un estado ni una decisión.`, ruta);
  };
  debeSerEstado(def.estadoInicial, "estadoInicial", "El estado inicial");
  def.transiciones.forEach((t, i) => {
    const ruta = `transiciones[${i}]`;
    if (t.desde !== "*") t.desde.forEach((d, j) => debeSerEstado(d, `${ruta}.desde[${j}]`, `«desde» de ${entreComillas(t.id)}`));
    (t.excepto ?? []).forEach((d, j) => debeSerEstado(d, `${ruta}.excepto[${j}]`, `«excepto» de ${entreComillas(t.id)}`));
    if (t.excepto && t.desde !== "*") aviso("excepto_sin_comodin", `${entreComillas(t.id)} tiene «excepto» pero no usa desde "*": no tiene efecto.`, `${ruta}.excepto`);
    if (t.hacia !== undefined) debeExistir(t.hacia, `${ruta}.hacia`, `«hacia» de ${entreComillas(t.id)}`);
  });
  (def.decisiones ?? []).forEach((d, i) => {
    d.ramas.forEach((r, j) => debeExistir(r.hacia, `decisiones[${i}].ramas[${j}].hacia`, `La rama ${j + 1} de ${entreComillas(d.nombre)}`));
    debeExistir(d.sino, `decisiones[${i}].sino`, `El «sino» de ${entreComillas(d.nombre)}`);
  });

  const transiciones = new Map(def.transiciones.map((t) => [t.id, t]));
  repetidos((def.reacciones ?? []).map((r, i) => ({ id: r.id, ruta: `reacciones[${i}]` }))).forEach(({ id, ruta }) =>
    error("id_duplicado", `Hay dos reacciones con el id ${entreComillas(id)}.`, ruta),
  );
  (def.reacciones ?? []).forEach((r, i) => {
    const ruta = `reacciones[${i}]`;
    if (r.desde !== "*") r.desde.forEach((d, j) => debeSerEstado(d, `${ruta}.desde[${j}]`, `«desde» de la reacción ${entreComillas(r.id)}`));
    (r.excepto ?? []).forEach((d, j) => debeSerEstado(d, `${ruta}.excepto[${j}]`, `«excepto» de la reacción ${entreComillas(r.id)}`));
    if (r.excepto && r.desde !== "*") aviso("excepto_sin_comodin", `La reacción ${entreComillas(r.id)} tiene «excepto» pero no usa desde "*": no tiene efecto.`, `${ruta}.excepto`);
    if (r.transicion === undefined && !r.efectos?.length) error("reaccion_vacia", `La reacción ${entreComillas(r.id)} no hace nada: necesita una transición o algún efecto.`, ruta);
    if (r.transicion !== undefined && !transiciones.has(r.transicion)) {
      error("referencia_inexistente", `La reacción ${entreComillas(r.id)} usa la transición ${entreComillas(r.transicion)}, que no existe.`, `${ruta}.transicion`);
    }
  });

  const referenciasSanas = errores.length === 0;

  // --- Ambigüedad: desde un mismo estado, una acción tiene a lo sumo una transición.
  for (const estado of def.estados) {
    const porAccion = new Map<string, string[]>();
    for (const t of def.transiciones) {
      if (aplicaDesde(t, estado.id)) porAccion.set(t.accion, [...(porAccion.get(t.accion) ?? []), t.id]);
    }
    for (const [accion, ids] of porAccion) {
      if (ids.length > 1) {
        error(
          "transicion_ambigua",
          `Desde ${entreComillas(estado.nombre)} la acción ${entreComillas(accion)} tiene ${ids.length} transiciones (${enumerar(ids.map(entreComillas))}). Usá una sola con un nodo de decisión.`,
          `estados[${def.estados.indexOf(estado)}]`,
        );
      }
    }
  }

  // --- Reacciones: en cada estado, una ocurrencia de un evento tiene a lo sumo una reacción, y su transición se puede intentar.
  for (const estado of def.estados) {
    const porOcurrencia = new Map<string, string[]>();
    for (const r of def.reacciones ?? []) {
      if (!aplicaDesde(r, estado.id)) continue;
      const clave = jsonCanonico({ evento: r.evento, params: r.params ?? {} });
      porOcurrencia.set(clave, [...(porOcurrencia.get(clave) ?? []), r.id]);
      const t = r.transicion === undefined ? undefined : transiciones.get(r.transicion);
      if (t && !aplicaDesde(t, estado.id)) {
        error(
          "reaccion_fuera_de_transicion",
          `La reacción ${entreComillas(r.id)} escucha en ${entreComillas(estado.nombre)}, pero la transición ${entreComillas(t.id)} no se puede hacer desde ahí.`,
          `reacciones[${def.reacciones!.indexOf(r)}].transicion`,
        );
      }
    }
    for (const ids of porOcurrencia.values()) {
      if (ids.length > 1) {
        error(
          "reaccion_ambigua",
          `En ${entreComillas(estado.nombre)} el mismo evento dispara ${ids.length} reacciones (${enumerar(ids.map(entreComillas))}). Usá una sola con un nodo de decisión.`,
          `estados[${def.estados.indexOf(estado)}]`,
        );
      }
    }
  }

  // El análisis del grafo necesita referencias sanas: si no, solo agrega ruido.
  if (referenciasSanas) analizarGrafo(def, estados, decisiones, error, aviso);

  if (registro) validarCapacidades(def, mapaDeDescriptores(registro), opciones.validarEsquema ?? ((v, s) => validarJsonSchema(v, s)), error);

  return { valido: errores.length === 0, errores, avisos, definicion: def };
}

type Reportar = (codigo: CodigoProblema, mensaje: string, ruta?: string) => void;

function analizarGrafo(def: DefinicionFlujo, estados: Set<string>, decisiones: Map<string, NonNullable<DefinicionFlujo["decisiones"]>[number]>, error: Reportar, aviso: Reportar) {
  // Ciclos entre decisiones (decisión → decisión → … → la primera): una decisión tiene que llegar a un estado.
  const color = new Map<string, "visitando" | "listo">();
  const pila: string[] = [];
  const visitar = (id: string): void => {
    color.set(id, "visitando");
    pila.push(id);
    const d = decisiones.get(id)!;
    for (const destino of [...d.ramas.map((r) => r.hacia), d.sino]) {
      if (!decisiones.has(destino)) continue;
      if (color.get(destino) === "visitando") {
        const ciclo = [...pila.slice(pila.indexOf(destino)), destino].map((x) => entreComillas(decisiones.get(x)!.nombre));
        error("ciclo_de_decisiones", `Las decisiones forman un ciclo: ${ciclo.join(" → ")}.`, `decisiones[${[...decisiones.keys()].indexOf(destino)}]`);
      } else if (!color.has(destino)) visitar(destino);
    }
    pila.pop();
    color.set(id, "listo");
  };
  for (const id of decisiones.keys()) if (!color.has(id)) visitar(id);

  // Aristas estado → estado (atravesando decisiones), y qué decisiones se tocan desde cada estado.
  const destinosDe = (nodo: string, vistos: Set<string>): string[] => {
    if (estados.has(nodo)) return [nodo];
    if (vistos.has(nodo)) return [];
    vistos.add(nodo);
    const d = decisiones.get(nodo)!;
    return [...d.ramas.map((r) => r.hacia), d.sino].flatMap((x) => destinosDe(x, vistos));
  };
  const salidas = new Map<string, Set<string>>();
  const decisionesTocadas = new Set<string>();
  for (const estado of def.estados) {
    const destinos = new Set<string>();
    for (const t of def.transiciones) {
      if (!aplicaDesde(t, estado.id) || t.hacia === undefined) continue;
      const vistos = new Set<string>();
      destinosDe(t.hacia, vistos).forEach((d) => destinos.add(d));
      vistos.forEach((d) => decisionesTocadas.add(d));
    }
    destinos.delete(estado.id);
    salidas.set(estado.id, destinos);
  }

  // Alcanzables desde el inicial.
  const alcanzables = recorrer([def.estadoInicial], (id) => salidas.get(id) ?? []);
  const decisionesAlcanzables = new Set<string>();
  for (const estado of alcanzables) {
    for (const t of def.transiciones) {
      if (aplicaDesde(t, estado) && t.hacia !== undefined && decisiones.has(t.hacia)) {
        const vistos = new Set<string>();
        destinosDe(t.hacia, vistos);
        vistos.forEach((d) => decisionesAlcanzables.add(d));
      }
    }
  }
  def.estados.forEach((e, i) => {
    if (!alcanzables.has(e.id)) error("estado_inalcanzable", `No se llega nunca a ${entreComillas(e.nombre)} desde el estado inicial.`, `estados[${i}]`);
  });
  (def.decisiones ?? []).forEach((d, i) => {
    if (!decisionesAlcanzables.has(d.id)) aviso("decision_inalcanzable", `Ninguna transición alcanzable pasa por la decisión ${entreComillas(d.nombre)}.`, `decisiones[${i}]`);
  });

  // Callejones: desde un estado no final tiene que poder llegarse a algún final.
  const finales = def.estados.filter((e) => e.final).map((e) => e.id);
  if (!finales.length) {
    aviso("sin_estado_final", "El flujo no tiene estados finales, así que no se controlan callejones.");
    return;
  }
  const entradas = new Map<string, string[]>();
  for (const [desde, destinos] of salidas) for (const d of destinos) entradas.set(d, [...(entradas.get(d) ?? []), desde]);
  const llegan = recorrer(finales, (id) => entradas.get(id) ?? []);
  def.estados.forEach((e, i) => {
    if (!e.final && alcanzables.has(e.id) && !llegan.has(e.id)) {
      error("callejon", `Desde ${entreComillas(e.nombre)} no se puede llegar a ningún estado final: es un callejón.`, `estados[${i}]`);
    }
  });
}

function recorrer(inicio: string[], vecinos: (id: string) => Iterable<string>): Set<string> {
  const vistos = new Set(inicio);
  const cola = [...inicio];
  while (cola.length) {
    for (const v of vecinos(cola.shift()!)) {
      if (!vistos.has(v)) {
        vistos.add(v);
        cola.push(v);
      }
    }
  }
  return vistos;
}

function validarCapacidades(def: DefinicionFlujo, mapa: Map<string, DescriptorCapacidad>, validarEsquema: NonNullable<OpcionesValidacion["validarEsquema"]>, error: Reportar) {
  const usar = (id: string, tipo: TipoCapacidad, ruta: string, params?: Params) => {
    const d = mapa.get(id);
    if (!d) return error("capacidad_desconocida", `${NOMBRE_TIPO[tipo]} ${entreComillas(id)} no está en el registro.`, ruta);
    if (d.tipo !== tipo) return error("tipo_de_capacidad", `${entreComillas(id)} es ${ARTICULO_TIPO[d.tipo]}, no ${ARTICULO_TIPO[tipo]}.`, ruta);
    if (tipo === "accion" || !d.schemaEntrada) return;
    for (const p of validarEsquema(params ?? {}, d.schemaEntrada)) error("params_invalidos", `${entreComillas(d.nombre)}: ${p}`, `${ruta}.params`);
  };
  const condicion = (c: Condicion, ruta: string): void => {
    if ("condicion" in c) usar(c.condicion, "condicion", ruta, c.params);
    else if ("todas" in c) c.todas.forEach((h, i) => condicion(h, `${ruta}.todas[${i}]`));
    else if ("alguna" in c) c.alguna.forEach((h, i) => condicion(h, `${ruta}.alguna[${i}]`));
    else if ("no" in c) condicion(c.no, `${ruta}.no`);
    else {
      condicion(c.si, `${ruta}.si`);
      condicion(c.entonces, `${ruta}.entonces`);
    }
  };
  const efectos = (lista: Efecto[] | undefined, ruta: string) =>
    (lista ?? []).forEach((e, i) => {
      usar(e.efecto, "efecto", `${ruta}[${i}]`, e.params);
      if (e.si) condicion(e.si, `${ruta}[${i}].si`);
    });

  def.estados.forEach((e, i) => efectos(e.alEntrar, `estados[${i}].alEntrar`));
  (def.decisiones ?? []).forEach((d, i) => d.ramas.forEach((r, j) => condicion(r.si, `decisiones[${i}].ramas[${j}].si`)));
  def.transiciones.forEach((t, i) => {
    const ruta = `transiciones[${i}]`;
    usar(t.accion, "accion", `${ruta}.accion`);
    if (t.requisitos) condicion(t.requisitos, `${ruta}.requisitos`);
    if (t.sugerencias) condicion(t.sugerencias, `${ruta}.sugerencias`);
    efectos(t.efectos, `${ruta}.efectos`);
  });
  (def.reacciones ?? []).forEach((r, i) => {
    const ruta = `reacciones[${i}]`;
    usar(r.evento, "evento", `${ruta}.evento`, r.params);
    if (r.si) condicion(r.si, `${ruta}.si`);
    efectos(r.efectos, `${ruta}.efectos`);
  });
}

const NOMBRE_TIPO: Record<TipoCapacidad, string> = { accion: "La acción", condicion: "La condición", efecto: "El efecto", evento: "El evento" };
const ARTICULO_TIPO: Record<TipoCapacidad, string> = { accion: "una acción", condicion: "una condición", efecto: "un efecto", evento: "un evento" };

function repetidos(items: { id: string; ruta: string }[]) {
  const vistos = new Set<string>();
  return items.filter(({ id }) => (vistos.has(id) ? true : (vistos.add(id), false)));
}

function formatearRuta(path: readonly PropertyKey[]): string {
  return path.reduce<string>((acc, p) => (typeof p === "number" ? `${acc}[${p}]` : acc ? `${acc}.${String(p)}` : String(p)), "");
}
