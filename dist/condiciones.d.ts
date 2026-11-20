import type { Condicion, Params } from "./esquema.js";
import type { Registro } from "./registro.js";
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
export type ResultadoCondicion = (Base & {
    tipo: "hoja";
    condicion: string;
    params: Params;
    texto: string;
}) | (Base & {
    tipo: "todas" | "alguna";
    hijos: ResultadoCondicion[];
}) | (Base & {
    tipo: "no";
    hijo: ResultadoCondicion;
}) | (Base & {
    tipo: "si";
    aplica: boolean;
    si: ResultadoCondicion;
    entonces: ResultadoCondicion | null;
});
export declare function evaluarCondicion<C>(condicion: Condicion, contexto: C, registro: Registro<C>, ruta: string): ResultadoCondicion;
/** Por qué no se cumple, en frases cortas (una por cosa que falta). Vacío si se cumple. */
export declare function motivos(r: ResultadoCondicion): string[];
/** Lo que es verdad de un resultado, en una frase: para la premisa de un «si» o para lo que un «no» rechaza. */
export declare function describir(r: ResultadoCondicion): string;
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
export declare function casilleros(r: ResultadoCondicion | undefined): Casillero[];
export {};
