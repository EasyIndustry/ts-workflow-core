import { aplicaDesde, estadoDe, evaluar, resolverEfectos } from "./interprete.js";
import { evaluarCondicion, motivos } from "./condiciones.js";
import { huella, jsonCanonico } from "./huella.js";
import { elegirVersion } from "./versiones.js";
const claveDeOcurrencia = (evento, params) => jsonCanonico({ evento, params: params ?? {} });
/**
 * Los eventos que usan estas definiciones, sin repetir. Para no dejar de escuchar lo que todavía hace falta, pasá también
 * las versiones viejas que tengan instancias activas.
 */
export function suscripciones(definiciones) {
    const lista = Array.isArray(definiciones) ? definiciones : [definiciones];
    const porClave = new Map();
    for (const definicion of lista) {
        for (const r of definicion.reacciones ?? []) {
            const clave = huella({ evento: r.evento, params: r.params ?? {} });
            if (!porClave.has(clave))
                porClave.set(clave, { clave, evento: r.evento, params: r.params ?? {} });
        }
    }
    return [...porClave.values()].sort((a, b) => a.clave.localeCompare(b.clave));
}
/**
 * Qué hay que hacer con esta instancia ante este evento. Devuelve `null` si en su estado nadie lo escucha. Se evalúa con
 * la versión de la instancia. Si la definición pasó `validarDefinicion`, a lo sumo una reacción coincide.
 */
export function reaccionar(fuente, instancia, evento, contexto, registro) {
    const definicion = elegirVersion(fuente, instancia.version);
    estadoDe(definicion, instancia.estado);
    const buscada = claveDeOcurrencia(evento.evento, evento.params);
    const indice = (definicion.reacciones ?? []).findIndex((r) => aplicaDesde(r, instancia.estado) && claveDeOcurrencia(r.evento, r.params) === buscada);
    if (indice === -1)
        return null;
    const r = definicion.reacciones[indice];
    const ruta = `reacciones[${indice}]`;
    const base = planBase(definicion, instancia, r);
    if (r.si) {
        const si = evaluarCondicion(r.si, contexto, registro, `${ruta}.si`);
        if (!si.cumple)
            return { ...base, motivos: motivos(si) };
    }
    const propios = resolverEfectos(r.efectos, `reaccion:${r.id}`, `${ruta}.efectos`, contexto, registro);
    if (r.transicion === undefined)
        return { ...base, aplica: true, efectos: propios };
    // La transición se resuelve con `evaluar`: mismos requisitos, destino y efectos que si la hiciera una persona.
    const evaluacion = evaluar(definicion, instancia, contexto, registro);
    const bloqueada = evaluacion.bloqueadas.find((b) => b.transicion === r.transicion);
    if (bloqueada)
        return { ...base, transicion: bloqueada.transicion, accion: bloqueada.accion, motivos: bloqueada.motivos };
    const permitida = evaluacion.permitidas.find((p) => p.transicion === r.transicion);
    if (!permitida) {
        return { ...base, transicion: r.transicion, motivos: [`La transición «${r.transicion}» no se puede hacer desde «${instancia.estado}».`] };
    }
    return {
        ...base,
        aplica: true,
        transicion: permitida.transicion,
        accion: permitida.accion,
        destino: permitida.destino,
        cambiaEstado: permitida.cambiaEstado,
        recorrido: permitida.recorrido,
        efectos: [...propios, ...permitida.efectos],
    };
}
function planBase(definicion, instancia, r) {
    return {
        flujo: definicion.id,
        version: definicion.version,
        estado: instancia.estado,
        reaccion: r.id,
        evento: r.evento,
        aplica: false,
        motivos: [],
        destino: instancia.estado,
        cambiaEstado: false,
        recorrido: [],
        efectos: [],
    };
}
//# sourceMappingURL=reacciones.js.map