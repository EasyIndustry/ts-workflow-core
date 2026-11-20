import type { DefinicionFlujo } from "./esquema.js";
/**
 * Versionado. Una versión publicada no cambia: un cambio es una versión nueva. Cada instancia guarda la versión con la
 * que arrancó y se evalúa siempre con esa, así las órdenes en curso no heredan reglas que no tenían.
 */
/** Dónde está una instancia: la versión de la definición con la que arrancó y su estado actual. */
export interface Instancia {
    readonly version: number;
    readonly estado: string;
}
/** Una definición, o todas las versiones de un mismo flujo. */
export type FuenteFlujo = DefinicionFlujo | readonly DefinicionFlujo[];
/** La definición de una versión. Falla si no está: nunca se evalúa una instancia con reglas que no eran las suyas. */
export declare function elegirVersion(fuente: FuenteFlujo, version: number): DefinicionFlujo;
/** La versión más nueva: la que usa una instancia que arranca ahora. */
export declare function ultimaVersion(fuente: FuenteFlujo): DefinicionFlujo;
/** Una instancia nueva: con la última versión, en su estado inicial. La app guarda `version` junto al estado. */
export declare function iniciarInstancia(fuente: FuenteFlujo): Instancia;
