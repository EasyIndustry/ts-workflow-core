import type { Params } from "./esquema.js";
/**
 * Contrato del registro de capacidades. Es lo único que el motor sabe de la app: qué acciones, condiciones y efectos
 * existen, con qué parámetros y cómo se describen. La app lo llena con proveedores al arrancar.
 */
export type TipoCapacidad = "accion" | "condicion" | "efecto";
/** Un JSON Schema. El core valida un subconjunto (ver `validarJsonSchema`); el resto de las palabras se ignora. */
export type EsquemaJson = {
    readonly [clave: string]: unknown;
};
/** La parte serializable de una capacidad: la usan el validador y el editor (puede viajar como JSON). */
export interface DescriptorCapacidad {
    /** Estable y con espacio de nombres, por ejemplo «orden.cerrar» o «foto.tiene». */
    readonly id: string;
    /** Para mostrar, por ejemplo «Cerrar orden». */
    readonly nombre: string;
    readonly tipo: TipoCapacidad;
    readonly descripcion?: string | undefined;
    /** Params de la condición o del efecto, o el input de la acción. */
    readonly schemaEntrada?: EsquemaJson | undefined;
    /** Condiciones: frases con `{param}` para cuando se cumple y para cuando no. Las usan `explicar` y el editor. */
    readonly texto?: {
        readonly cumple: string;
        readonly noCumple: string;
    } | undefined;
    /** Para agrupar en la paleta del editor. */
    readonly grupo?: string | undefined;
}
/** Una condición trae su evaluación: una función pura sobre el contexto que arma la app. Sin IO. */
export interface CapacidadCondicion<C = Record<string, unknown>> extends DescriptorCapacidad {
    readonly tipo: "condicion";
    evaluar(params: Params, contexto: C): boolean;
}
/** Acciones y efectos son solo descriptores: los ejecuta la app. */
export interface CapacidadSinEvaluacion extends DescriptorCapacidad {
    readonly tipo: "accion" | "efecto";
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
/** Arma el registro. Falla si una capacidad está mal declarada o si dos proveedores usan el mismo id. */
export declare function crearRegistro<C = Record<string, unknown>>(proveedores: readonly Proveedor<C>[]): Registro<C>;
/** Lo que necesita el validador: un registro o directamente la lista de descriptores (por ejemplo, el JSON que recibe el editor). */
export type FuenteDescriptores = {
    descriptores(): readonly DescriptorCapacidad[];
} | readonly DescriptorCapacidad[];
export declare function mapaDeDescriptores(fuente: FuenteDescriptores): Map<string, DescriptorCapacidad>;
