import type { Cambio, Comparacion } from "./comparar.js";
/**
 * Trazabilidad: qué revisión de algo (una definición, un formulario, una plantilla) usa cada registro de la app, y si esa
 * revisión sigue vigente o se puede pasar a la vigente sin reglas nuevas.
 *
 * El core no guarda ni publica nada: el catálogo de revisiones, quién publicó y cuándo son de la app. Acá solo están los
 * tipos para hablar de eso y la verificación, que es pura.
 */
/** Apunta a una revisión concreta de algo: por ejemplo, la versión de un flujo con la que arrancó una instancia. */
export interface Referencia {
    readonly clave: string;
    readonly revision: number;
}
/** En qué está una revisión. Lo decide la app al publicar; el core solo lo lee. */
export type EstadoRevision = "borrador" | "vigente" | "obsoleta";
/** Una revisión del catálogo de la app, con su estado y su contenido. */
export interface Revisionado<T> extends Referencia {
    readonly estado: EstadoRevision;
    readonly valor: T;
    /** Opcional: la `huella` del valor, si la app la guarda para detectar copias que no coinciden. */
    readonly huella?: string | undefined;
}
/** Compara dos revisiones de lo mismo. Puede devolver la `Comparacion` (por ejemplo, `compararFlujos`) o solo si es compatible. */
export type Comparador<T> = (antes: T, despues: T) => Comparacion | boolean;
export interface ReferenciaVigente<T> {
    referencia: Referencia;
    actual: Revisionado<T>;
}
export interface ReferenciaObsoleta<T> {
    referencia: Referencia;
    /** La revisión a la que apunta la referencia. */
    actual: Revisionado<T>;
    /** La revisión vigente de la misma clave, a la que habría que pasarla. */
    vigente: Revisionado<T>;
    /** Los cambios entre las dos, si el comparador los da. */
    cambios: Cambio[];
}
export interface ReferenciaHuerfana {
    referencia: Referencia;
    motivo: string;
}
export interface ResultadoReferencias<T> {
    /** Apuntan a la revisión vigente. */
    vigentes: ReferenciaVigente<T>[];
    /** Apuntan a otra revisión, y pasar a la vigente no exige reglas nuevas. */
    actualizables: ReferenciaObsoleta<T>[];
    /** Apuntan a otra revisión, y pasar a la vigente rompe (o no se puede asegurar que no). */
    rompen: ReferenciaObsoleta<T>[];
    /** La revisión no está en el catálogo, o la clave no tiene ninguna vigente contra la cual comparar. */
    huerfanas: ReferenciaHuerfana[];
}
/**
 * Clasifica cada referencia contra el catálogo:
 *
 * - **vigente:** apunta a la revisión vigente de su clave;
 * - **actualizable** o **rompe:** su revisión está pero no es la vigente (está `obsoleta` o es un `borrador`), y el
 *   comparador dice si pasar de esa revisión a la vigente es compatible;
 * - **huérfana:** la revisión no está, o la clave no tiene ninguna vigente.
 *
 * Si una clave tiene más de una revisión marcada `vigente`, la vigente es la de número más alto (las otras se tratan
 * como obsoletas). Cada par de revisiones se compara una sola vez. Mantiene el orden de las referencias.
 * Falla con `ErrorFlujo` («revision_duplicada») si el catálogo tiene dos veces la misma clave y revisión.
 */
export declare function verificarReferencias<T>(referencias: readonly Referencia[], catalogo: readonly Revisionado<T>[], comparar: Comparador<T>): ResultadoReferencias<T>;
