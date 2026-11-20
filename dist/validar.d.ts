import { type DefinicionFlujo } from "./esquema.js";
import { type EsquemaJson, type FuenteDescriptores } from "./registro.js";
/**
 * Validación de una definición: el schema y después el grafo (referencias, ciclos de decisiones, ambigüedad, estados
 * alcanzables, callejones) y, si se pasa el registro, las capacidades y sus params. Mensajes en castellano con la ruta.
 */
export type CodigoProblema = "esquema" | "id_duplicado" | "referencia_inexistente" | "no_es_estado" | "excepto_sin_comodin" | "ciclo_de_decisiones" | "transicion_ambigua" | "estado_inalcanzable" | "decision_inalcanzable" | "callejon" | "sin_estado_final" | "capacidad_desconocida" | "tipo_de_capacidad" | "params_invalidos";
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
export declare function validarDefinicion(valor: unknown, registro?: FuenteDescriptores, opciones?: OpcionesValidacion): ResultadoValidacion;
