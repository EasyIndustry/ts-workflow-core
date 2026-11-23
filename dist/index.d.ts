/**
 * ts-workflow-core: motor de flujos configurables, puro y sin dependencias de la app.
 * Diseño: docs/diseno.md.
 */
export { condicionSchema, decisionSchema, definicionJsonSchema, definicionSchema, efectoSchema, estadoSchema, reaccionSchema, parsearDefinicion, transicionSchema, type Condicion, type Decision, type DefinicionFlujo, type Efecto, type Estado, type Params, type Reaccion, type Transicion, } from "./esquema.js";
export { crearRegistro, type Capacidad, type CapacidadCondicion, type CapacidadSinEvaluacion, type DescriptorCapacidad, type EsquemaJson, type FuenteDescriptores, type Proveedor, type Registro, type TipoCapacidad, } from "./registro.js";
export { validarDefinicion, type CodigoProblema, type OpcionesValidacion, type Problema, type ResultadoValidacion } from "./validar.js";
export { evaluar, type AccionBloqueada, type AccionPermitida, type EfectoResuelto, type PasoRecorrido, type ResultadoEvaluacion } from "./interprete.js";
export { reaccionar, suscripciones, type EventoFlujo, type PlanReaccion, type Suscripcion } from "./reacciones.js";
export { casilleros, describir, motivos, type Casillero, type ResultadoCondicion } from "./condiciones.js";
export { explicar, type Explicacion } from "./explicar.js";
export { simular, type Escenario, type PasoEscenario, type PasoSimulado, type ResultadoSimulacion } from "./simular.js";
export { elegirVersion, iniciarInstancia, ultimaVersion, type FuenteFlujo, type Instancia } from "./versiones.js";
export { validarJsonSchema } from "./jsonSchema.js";
export { huella, jsonCanonico } from "./huella.js";
export { compararCapacidades, compararEsquemas, compararFlujos, type Cambio, type CodigoCambio, type Comparacion, type NivelCambio } from "./comparar.js";
export { verificarReferencias, type Comparador, type EstadoRevision, type Referencia, type ReferenciaHuerfana, type ReferenciaObsoleta, type ReferenciaVigente, type ResultadoReferencias, type Revisionado, } from "./referencias.js";
export { ErrorFlujo, type CodigoError } from "./errores.js";
