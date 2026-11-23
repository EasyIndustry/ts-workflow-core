import type { PasoRecorrido, EfectoResuelto } from "./interprete.js";
import type { DefinicionFlujo, Params } from "./esquema.js";
import type { Registro } from "./registro.js";
import { type FuenteFlujo, type Instancia } from "./versiones.js";
/**
 * Reacciones: qué hace un flujo cuando llega un evento de afuera. Igual que `evaluar`, es puro: no escucha nada, no
 * ejecuta nada y no guarda nada. La app (o un plugin) recibe el evento, arma el contexto y ejecuta el plan.
 *
 * Una reacción no habilita: si intenta una transición, pasa por los requisitos de esa transición.
 */
/** Una ocurrencia de un evento. `params` dice cuál (se compara entera con los de la reacción). Los datos van en el contexto. */
export interface EventoFlujo {
    readonly evento: string;
    readonly params?: Params | undefined;
}
/** Algo que hay que escuchar para que las definiciones funcionen. `clave` es estable: sirve para reconciliar. */
export interface Suscripcion {
    readonly clave: string;
    readonly evento: string;
    readonly params: Params;
}
export interface PlanReaccion {
    flujo: string;
    version: number;
    estado: string;
    reaccion: string;
    evento: string;
    /** `false` si la condición de la reacción o los requisitos de la transición no se cumplen: no hay nada que ejecutar. */
    aplica: boolean;
    motivos: string[];
    transicion?: string;
    accion?: string;
    destino: string;
    cambiaEstado: boolean;
    recorrido: PasoRecorrido[];
    /** En orden: los de la reacción, los de la transición y los `alEntrar` del destino. Vacío si no aplica. */
    efectos: EfectoResuelto[];
}
/**
 * Los eventos que usan estas definiciones, sin repetir. Para no dejar de escuchar lo que todavía hace falta, pasá también
 * las versiones viejas que tengan instancias activas.
 */
export declare function suscripciones(definiciones: DefinicionFlujo | readonly DefinicionFlujo[]): Suscripcion[];
/**
 * Qué hay que hacer con esta instancia ante este evento. Devuelve `null` si en su estado nadie lo escucha. Se evalúa con
 * la versión de la instancia. Si la definición pasó `validarDefinicion`, a lo sumo una reacción coincide.
 */
export declare function reaccionar<C>(fuente: FuenteFlujo, instancia: Instancia, evento: EventoFlujo, contexto: C, registro: Registro<C>): PlanReaccion | null;
