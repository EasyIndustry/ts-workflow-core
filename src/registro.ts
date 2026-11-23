import { ErrorFlujo } from "./errores.js";
import type { Params } from "./esquema.js";

/**
 * Contrato del registro de capacidades. Es lo único que el motor sabe de la app: qué acciones, condiciones y efectos
 * existen, con qué parámetros y cómo se describen. La app lo llena con proveedores al arrancar.
 */

export type TipoCapacidad = "accion" | "condicion" | "efecto" | "evento";

/** Un JSON Schema. El core valida un subconjunto (ver `validarJsonSchema`); el resto de las palabras se ignora. */
export type EsquemaJson = { readonly [clave: string]: unknown };

/** La parte serializable de una capacidad: la usan el validador y el editor (puede viajar como JSON). */
export interface DescriptorCapacidad {
  /** Estable y con espacio de nombres, por ejemplo «orden.cerrar» o «foto.tiene». */
  readonly id: string;
  /** Para mostrar, por ejemplo «Cerrar orden». */
  readonly nombre: string;
  readonly tipo: TipoCapacidad;
  readonly descripcion?: string | undefined;
  /** Params de la condición, del efecto o del evento, o el input de la acción. */
  readonly schemaEntrada?: EsquemaJson | undefined;
  /** Condiciones: frases con `{param}` para cuando se cumple y para cuando no. Las usan `explicar` y el editor. */
  readonly texto?: { readonly cumple: string; readonly noCumple: string } | undefined;
  /** Para agrupar en la paleta del editor. */
  readonly grupo?: string | undefined;
}

/** Una condición trae su evaluación: una función pura sobre el contexto que arma la app. Sin IO. */
export interface CapacidadCondicion<C = Record<string, unknown>> extends DescriptorCapacidad {
  readonly tipo: "condicion";
  evaluar(params: Params, contexto: C): boolean;
}

/** Acciones, efectos y eventos son solo descriptores: los ejecuta o los emite la app (o un plugin suyo). */
export interface CapacidadSinEvaluacion extends DescriptorCapacidad {
  readonly tipo: "accion" | "efecto" | "evento";
}

export type Capacidad<C = Record<string, unknown>> = CapacidadCondicion<C> | CapacidadSinEvaluacion;

export interface Proveedor<C = Record<string, unknown>> {
  /** Quién aporta las capacidades, para los mensajes de error (por ejemplo «acciones de la app»). */
  readonly nombre: string;
  readonly capacidades: readonly Capacidad<C>[];
}

export interface Registro<C = Record<string, unknown>> {
  obtener(id: string): Capacidad<C> | undefined;
  /** Descriptores serializables (sin `evaluar`), opcionalmente de un solo tipo. */
  descriptores(tipo?: TipoCapacidad): DescriptorCapacidad[];
}

const TIPOS: readonly TipoCapacidad[] = ["accion", "condicion", "efecto", "evento"];

/** Arma el registro. Falla si una capacidad está mal declarada o si dos proveedores usan el mismo id. */
export function crearRegistro<C = Record<string, unknown>>(proveedores: readonly Proveedor<C>[]): Registro<C> {
  const porId = new Map<string, { capacidad: Capacidad<C>; proveedor: string }>();
  for (const proveedor of proveedores) {
    for (const capacidad of proveedor.capacidades) {
      const problema = problemaDeCapacidad(capacidad);
      if (problema) throw new ErrorFlujo("registro_invalido", `${proveedor.nombre}: ${problema}`);
      const previa = porId.get(capacidad.id);
      if (previa) {
        throw new ErrorFlujo("registro_invalido", `La capacidad «${capacidad.id}» está dos veces: en «${previa.proveedor}» y en «${proveedor.nombre}».`);
      }
      porId.set(capacidad.id, { capacidad, proveedor: proveedor.nombre });
    }
  }
  return {
    obtener: (id) => porId.get(id)?.capacidad,
    descriptores: (tipo) =>
      [...porId.values()].map(({ capacidad }) => descriptorDe(capacidad)).filter((d) => tipo === undefined || d.tipo === tipo),
  };
}

function problemaDeCapacidad(c: Capacidad<unknown>): string | null {
  const id = typeof c.id === "string" && c.id.trim() ? c.id : null;
  if (!id) return "hay una capacidad sin id.";
  if (typeof c.nombre !== "string" || !c.nombre.trim()) return `la capacidad «${id}» no tiene nombre.`;
  if (!TIPOS.includes(c.tipo)) return `la capacidad «${id}» tiene un tipo desconocido («${String(c.tipo)}»).`;
  if (c.tipo === "condicion" && typeof (c as CapacidadCondicion<unknown>).evaluar !== "function") {
    return `la condición «${id}» no tiene la función evaluar.`;
  }
  return null;
}

function descriptorDe(c: Capacidad<unknown>): DescriptorCapacidad {
  const { id, nombre, tipo, descripcion, schemaEntrada, texto, grupo } = c;
  return {
    id,
    nombre,
    tipo,
    ...(descripcion !== undefined ? { descripcion } : {}),
    ...(schemaEntrada !== undefined ? { schemaEntrada } : {}),
    ...(texto !== undefined ? { texto } : {}),
    ...(grupo !== undefined ? { grupo } : {}),
  };
}

/** Lo que necesita el validador: un registro o directamente la lista de descriptores (por ejemplo, el JSON que recibe el editor). */
export type FuenteDescriptores = { descriptores(): readonly DescriptorCapacidad[] } | readonly DescriptorCapacidad[];

export function mapaDeDescriptores(fuente: FuenteDescriptores): Map<string, DescriptorCapacidad> {
  const lista = "descriptores" in fuente ? fuente.descriptores() : fuente;
  return new Map(lista.map((d) => [d.id, d]));
}
