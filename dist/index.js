/**
 * ts-workflow-core: motor de flujos configurables, puro y sin dependencias de la app.
 * Diseño: docs/diseno.md.
 */
export { condicionSchema, decisionSchema, definicionJsonSchema, definicionSchema, efectoSchema, estadoSchema, parsearDefinicion, transicionSchema, } from "./esquema.js";
export { crearRegistro, } from "./registro.js";
export { validarDefinicion } from "./validar.js";
export { evaluar } from "./interprete.js";
export { casilleros, describir, motivos } from "./condiciones.js";
export { explicar } from "./explicar.js";
export { simular } from "./simular.js";
export { elegirVersion, iniciarInstancia, ultimaVersion } from "./versiones.js";
export { validarJsonSchema } from "./jsonSchema.js";
export { ErrorFlujo } from "./errores.js";
//# sourceMappingURL=index.js.map