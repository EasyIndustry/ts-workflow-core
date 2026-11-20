import type { Registro } from "./registro.js";
import { type FuenteFlujo, type Instancia } from "./versiones.js";
/** «Por qué no puedo avanzar», en castellano, armado con lo mismo que devuelve `evaluar`. */
export interface Explicacion {
    accion: string;
    nombre: string;
    permitida: boolean;
    /** Si está permitida: el estado al que lleva. */
    destino?: string;
    /** Si está bloqueada (o no existe en este estado): una frase por cosa que falta. */
    motivos: string[];
    /** Lo que conviene completar aunque no bloquee. */
    sugerencias: string[];
    /** Todo junto, listo para mostrar. */
    texto: string;
}
/** Sin `accion`: explica todas las acciones del estado actual. Con `accion`: solo esa, aunque no exista en este estado. */
export declare function explicar<C>(fuente: FuenteFlujo, instancia: Instancia, contexto: C, registro: Registro<C>): Explicacion[];
export declare function explicar<C>(fuente: FuenteFlujo, instancia: Instancia, contexto: C, registro: Registro<C>, accion: string): Explicacion;
