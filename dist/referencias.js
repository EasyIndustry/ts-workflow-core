import { ErrorFlujo } from "./errores.js";
/**
 * Clasifica cada referencia contra el catálogo:
 *
 * - **vigente:** apunta a la revisión vigente de su clave;
 * - **actualizable** o **rompe:** su revisión está pero no es la vigente (está `obsoleta` o es un `borrador`), y el
 *   comparador dice si pasar de esa revisión a la vigente es compatible;
 * - **huérfana:** la revisión no está, o la clave no tiene ninguna vigente.
 *
 * Si una clave tiene más de una revisión marcada `vigente`, la vigente es la de número más alto (las otras se tratan
 * como obsoletas). Cada par de revisiones se compara una sola vez. Mantiene el orden de las referencias.
 * Falla con `ErrorFlujo` («revision_duplicada») si el catálogo tiene dos veces la misma clave y revisión.
 */
export function verificarReferencias(referencias, catalogo, comparar) {
    const porClave = new Map();
    const vigentePorClave = new Map();
    for (const r of catalogo) {
        const revisiones = porClave.get(r.clave) ?? new Map();
        if (revisiones.has(r.revision))
            throw new ErrorFlujo("revision_duplicada", `La revisión ${r.revision} de «${r.clave}» está dos veces en el catálogo.`);
        revisiones.set(r.revision, r);
        porClave.set(r.clave, revisiones);
        const vigente = vigentePorClave.get(r.clave);
        if (r.estado === "vigente" && (!vigente || r.revision > vigente.revision))
            vigentePorClave.set(r.clave, r);
    }
    const salida = { vigentes: [], actualizables: [], rompen: [], huerfanas: [] };
    const comparaciones = new Map();
    for (const referencia of referencias) {
        const revisiones = porClave.get(referencia.clave);
        const actual = revisiones?.get(referencia.revision);
        if (!revisiones) {
            salida.huerfanas.push({ referencia, motivo: `«${referencia.clave}» no está en el catálogo.` });
            continue;
        }
        if (!actual) {
            salida.huerfanas.push({ referencia, motivo: `La revisión ${referencia.revision} de «${referencia.clave}» no está en el catálogo.` });
            continue;
        }
        const vigente = vigentePorClave.get(referencia.clave);
        if (!vigente) {
            salida.huerfanas.push({ referencia, motivo: `«${referencia.clave}» no tiene ninguna revisión vigente.` });
            continue;
        }
        if (actual === vigente) {
            salida.vigentes.push({ referencia, actual });
            continue;
        }
        // Varias referencias suelen apuntar a la misma revisión: se compara una vez por par.
        const par = `${referencia.clave}\u0000${actual.revision}`;
        let comparacion = comparaciones.get(par);
        if (!comparacion) {
            const r = comparar(actual.valor, vigente.valor);
            comparacion = typeof r === "boolean" ? { compatible: r, cambios: [] } : r;
            comparaciones.set(par, comparacion);
        }
        (comparacion.compatible ? salida.actualizables : salida.rompen).push({ referencia, actual, vigente, cambios: comparacion.cambios });
    }
    return salida;
}
//# sourceMappingURL=referencias.js.map