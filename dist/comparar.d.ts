import type { Condicion, DefinicionFlujo } from "./esquema.js";
import { type EsquemaJson, type FuenteDescriptores } from "./registro.js";
/**
 * Comparar dos versiones (de una definición, de un JSON Schema o de un registro) y clasificar cada cambio.
 *
 * La pregunta es siempre la misma: **lo que valía con la versión vieja, ¿sigue valiendo con la nueva?** Un cambio es
 * `compatible` si sí (una instancia o un dato de la versión vieja pasa a la nueva sin que le exijan reglas nuevas) y
 * `rompe` si no, o si no se puede asegurar: la comparación es conservadora y ante la duda dice `rompe`.
 */
export type NivelCambio = "compatible" | "rompe";
export type CodigoCambio = "datos_cambiados" | "estado_inicial_cambiado" | "estado_agregado" | "estado_quitado" | "estado_modificado" | "decision_agregada" | "decision_quitada" | "decision_modificada" | "transicion_agregada" | "transicion_quitada" | "transicion_modificada" | "accion_cambiada" | "desde_ampliado" | "desde_reducido" | "hacia_cambiado" | "requisitos_relajados" | "requisitos_endurecidos" | "sugerencias_cambiadas" | "efectos_cambiados" | "reaccion_agregada" | "reaccion_quitada" | "reaccion_modificada" | "esquema_relajado" | "esquema_endurecido" | "esquema_anotacion" | "capacidad_agregada" | "capacidad_quitada" | "capacidad_tipo_cambiado" | "capacidad_modificada";
export interface Cambio {
    nivel: NivelCambio;
    codigo: CodigoCambio;
    /** Dónde, con ids en vez de posiciones (cambian entre versiones), por ejemplo `transiciones[cerrar].requisitos`. */
    ruta: string;
    mensaje: string;
}
export interface Comparacion {
    /** `true` si ningún cambio rompe. Sin cambios también es `true`. */
    compatible: boolean;
    cambios: Cambio[];
}
/**
 * Compara dos versiones de una definición. Estados, decisiones y transiciones se emparejan por `id`: cambiarle el id a
 * algo es quitarlo y agregar otro.
 *
 * Rompe: quitar un estado, una decisión o una transición; achicar el `desde`; cambiar la acción o el `hacia` de una
 * transición; cambiar las ramas o el `sino` de una decisión; endurecer los `requisitos` (o no poder probar que no se
 * endurecieron); quitar una reacción, agregar una que mueve de estado o cambiar cuándo dispara o adónde lleva una
 * existente (una reacción actúa sola, sin que nadie apriete un botón). Lo demás es compatible: agregar, ampliar el `desde`, relajar requisitos, cambiar sugerencias, efectos,
 * nombres, `final`, el estado inicial o los metadatos.
 *
 * Falla con `ErrorFlujo` («versiones_mezcladas») si las dos definiciones son de flujos distintos.
 */
export declare function compararFlujos(antes: DefinicionFlujo, despues: DefinicionFlujo): Comparacion;
/**
 * ¿Todo contexto que cumple `a` cumple también `b`? Prueba sintáctica y conservadora: si devuelve `true` es seguro; si
 * devuelve `false`, puede ser que sí pero no se pudo probar.
 */
export declare function implica(a: Condicion, b: Condicion): boolean;
/**
 * Compara dos JSON Schema (por ejemplo, el `schemaEntrada` de una capacidad en dos versiones de la app). Es compatible si
 * todo valor que aceptaba el viejo lo acepta el nuevo; si no se puede asegurar, rompe.
 *
 * Entiende el mismo subconjunto que `validarJsonSchema`. Cambiar una anotación (`title`, `description`, `default`…) es
 * compatible; cambiar cualquier otra palabra que no entiende (`$ref`, `allOf`, `format`, `if`…) rompe, por las dudas.
 * `undefined` es «sin schema»: acepta cualquier cosa.
 */
export declare function compararEsquemas(antes: EsquemaJson | undefined, despues: EsquemaJson | undefined, ruta?: string): Comparacion;
/**
 * Compara dos registros (o listas de descriptores), por ejemplo antes y después de actualizar la app. Rompe: quitar una
 * capacidad, cambiarle el tipo o endurecer su `schemaEntrada` (ver `compararEsquemas`). Agregar capacidades o cambiar
 * nombres, textos, descripciones o grupos es compatible.
 *
 * Es una mirada general: para saber si una definición concreta sigue andando con el registro nuevo, la respuesta exacta
 * es `validarDefinicion(definicion, registroNuevo)`.
 */
export declare function compararCapacidades(antes: FuenteDescriptores, despues: FuenteDescriptores): Comparacion;
