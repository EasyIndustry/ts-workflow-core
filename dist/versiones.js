import { ErrorFlujo } from "./errores.js";
function listaDeVersiones(fuente) {
    const lista = Array.isArray(fuente) ? fuente : [fuente];
    if (!lista.length)
        throw new ErrorFlujo("sin_versiones", "No se pasó ninguna versión del flujo.");
    const ids = new Set(lista.map((d) => d.id));
    if (ids.size > 1)
        throw new ErrorFlujo("versiones_mezcladas", `Se mezclaron versiones de flujos distintos: ${[...ids].map((i) => `«${i}»`).join(", ")}.`);
    const vistas = new Set();
    for (const d of lista) {
        if (vistas.has(d.version))
            throw new ErrorFlujo("version_duplicada", `La versión ${d.version} de «${d.id}» está dos veces.`);
        vistas.add(d.version);
    }
    return lista;
}
/** La definición de una versión. Falla si no está: nunca se evalúa una instancia con reglas que no eran las suyas. */
export function elegirVersion(fuente, version) {
    const lista = listaDeVersiones(fuente);
    const definicion = lista.find((d) => d.version === version);
    if (!definicion) {
        const hay = lista.map((d) => d.version).sort((a, b) => a - b).join(", ");
        throw new ErrorFlujo("version_inexistente", `La instancia usa la versión ${version} de «${lista[0].id}», pero solo se pasó: ${hay}.`);
    }
    return definicion;
}
/** La versión más nueva: la que usa una instancia que arranca ahora. */
export function ultimaVersion(fuente) {
    return [...listaDeVersiones(fuente)].sort((a, b) => b.version - a.version)[0];
}
/** Una instancia nueva: con la última versión, en su estado inicial. La app guarda `version` junto al estado. */
export function iniciarInstancia(fuente) {
    const definicion = ultimaVersion(fuente);
    return { version: definicion.version, estado: definicion.estadoInicial };
}
//# sourceMappingURL=versiones.js.map