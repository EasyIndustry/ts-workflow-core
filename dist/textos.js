import { esObjeto, rotuloDeValor } from "./jsonSchema.js";
/** Completa `{param}` con el valor de los params, usando el rótulo del schema si lo hay («FUNCIONANDO» → «Funcionando»). */
export function completarPlantilla(plantilla, params, descriptor) {
    return plantilla.replace(/\{([A-Za-z0-9_]+)\}/g, (entero, clave) => (clave in params ? valorLegible(params[clave], clave, descriptor) : entero));
}
/** La frase de una condición según se cumpla o no: la plantilla del registro o, si no tiene, una genérica con su nombre. */
export function fraseDeCondicion(descriptor, id, params, cumple) {
    if (descriptor?.texto)
        return completarPlantilla(cumple ? descriptor.texto.cumple : descriptor.texto.noCumple, params, descriptor);
    const nombre = descriptor?.nombre ?? id;
    const claves = Object.keys(params);
    const detalle = claves.length ? ` (${claves.map((k) => `${k}: ${valorLegible(params[k], k, descriptor)}`).join(", ")})` : "";
    return `${cumple ? "Se cumple" : "No se cumple"} «${nombre}»${detalle}`;
}
function valorLegible(valor, clave, descriptor) {
    const propiedades = descriptor?.schemaEntrada?.properties;
    const esquema = esObjeto(propiedades) && esObjeto(propiedades[clave]) ? propiedades[clave] : undefined;
    if (Array.isArray(valor)) {
        const items = esquema && esObjeto(esquema.items) ? esquema.items : undefined;
        return valor.map((v) => rotuloDeValor(items, v) ?? simple(v)).join(", ");
    }
    return rotuloDeValor(esquema, valor) ?? simple(valor);
}
function simple(v) {
    return typeof v === "string" ? v : JSON.stringify(v);
}
export function minusculaInicial(s) {
    return s.charAt(0).toLowerCase() + s.slice(1);
}
export function mayusculaInicial(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}
/** Con mayúscula inicial y punto final. */
export function oracion(s) {
    const t = mayusculaInicial(s.trim());
    return /[.!?:]$/.test(t) ? t : `${t}.`;
}
/** «a», «a y b», «a, b y c» (o con «o»). */
export function enumerar(partes, conjuncion = "y") {
    if (partes.length <= 1)
        return partes.join("");
    return `${partes.slice(0, -1).join(", ")} ${conjuncion} ${partes[partes.length - 1]}`;
}
export function entreComillas(s) {
    return `«${s}»`;
}
//# sourceMappingURL=textos.js.map