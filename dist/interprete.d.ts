import { type ResultadoCondicion } from "./condiciones.js";
import type { DefinicionFlujo, Estado, Params, Transicion } from "./esquema.js";
import type { Registro } from "./registro.js";
import { type FuenteFlujo, type Instancia } from "./versiones.js";
/**
 * El intérprete: puro y sin IO. Con la definición (de la versión de la instancia), el estado, el contexto y el registro,
 * dice qué acciones se pueden hacer, adónde lleva cada una y qué efectos produce, y por qué las otras no.
 *
 * La app suma esto a sus propias reglas (permisos, facturación, stock): una acción se hace si la permiten las dos.
 */
/** Una decisión atravesada camino al destino: qué rama tomó y por qué. `rama` es null cuando fue por el «sino». */
export interface PasoRecorrido {
    decision: string;
    nombre: string;
    rama: number | null;
    hacia: string;
    motivo: string;
}
export interface EfectoResuelto {
    efecto: string;
    params: Params;
    /** De dónde sale: «transicion:<id>» o «estado:<id>» (los `alEntrar` del destino). */
    origen: string;
}
export interface AccionPermitida {
    accion: string;
    nombre: string;
    transicion: string;
    desde: string;
    destino: string;
    cambiaEstado: boolean;
    recorrido: PasoRecorrido[];
    efectos: EfectoResuelto[];
    requisitos?: ResultadoCondicion;
    sugerencias?: ResultadoCondicion;
}
export interface AccionBloqueada {
    accion: string;
    nombre: string;
    transicion: string;
    desde: string;
    motivos: string[];
    requisitos: ResultadoCondicion;
    sugerencias?: ResultadoCondicion;
}
export interface ResultadoEvaluacion {
    flujo: string;
    version: number;
    estado: string;
    permitidas: AccionPermitida[];
    bloqueadas: AccionBloqueada[];
}
export declare function evaluar<C>(fuente: FuenteFlujo, instancia: Instancia, contexto: C, registro: Registro<C>): ResultadoEvaluacion;
/** ¿La transición se puede intentar desde este estado? */
export declare function aplicaDesde(t: Transicion, estado: string): boolean;
export declare function estadoDe(definicion: DefinicionFlujo, id: string): Estado;
export declare function nombreDeEstado(definicion: DefinicionFlujo, id: string): string;
export declare function nombreDeAccion<C>(t: Transicion, registro: Registro<C>): string;
