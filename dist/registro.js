import { ErrorFlujo } from "./errores.js";
const TIPOS = ["accion", "condicion", "efecto", "evento"];
/** Arma el registro. Falla si una capacidad está mal declarada o si dos proveedores usan el mismo id. */
export function crearRegistro(proveedores) {
    const porId = new Map();
    for (const proveedor of proveedores) {
        for (const capacidad of proveedor.capacidades) {
            const problema = problemaDeCapacidad(capacidad);
            if (problema)
                throw new ErrorFlujo("registro_invalido", `${proveedor.nombre}: ${problema}`);
            const previa = porId.get(capacidad.id);
            if (previa) {
                throw new ErrorFlujo("registro_invalido", `La capacidad «${capacidad.id}» está dos veces: en «${previa.proveedor}» y en «${proveedor.nombre}».`);
            }
            porId.set(capacidad.id, { capacidad, proveedor: proveedor.nombre });
        }
    }
    return {
        obtener: (id) => porId.get(id)?.capacidad,
        descriptores: (tipo) => [...porId.values()].map(({ capacidad }) => descriptorDe(capacidad)).filter((d) => tipo === undefined || d.tipo === tipo),
    };
}
function problemaDeCapacidad(c) {
    const id = typeof c.id === "string" && c.id.trim() ? c.id : null;
    if (!id)
        return "hay una capacidad sin id.";
    if (typeof c.nombre !== "string" || !c.nombre.trim())
        return `la capacidad «${id}» no tiene nombre.`;
    if (!TIPOS.includes(c.tipo))
        return `la capacidad «${id}» tiene un tipo desconocido («${String(c.tipo)}»).`;
    if (c.tipo === "condicion" && typeof c.evaluar !== "function") {
        return `la condición «${id}» no tiene la función evaluar.`;
    }
    return null;
}
function descriptorDe(c) {
    const { id, nombre, tipo, descripcion, schemaEntrada, texto, grupo } = c;
    return {
        id,
        nombre,
        tipo,
        ...(descripcion !== undefined ? { descripcion } : {}),
        ...(schemaEntrada !== undefined ? { schemaEntrada } : {}),
        ...(texto !== undefined ? { texto } : {}),
        ...(grupo !== undefined ? { grupo } : {}),
    };
}
export function mapaDeDescriptores(fuente) {
    const lista = "descriptores" in fuente ? fuente.descriptores() : fuente;
    return new Map(lista.map((d) => [d.id, d]));
}
//# sourceMappingURL=registro.js.map