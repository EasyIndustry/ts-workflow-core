import { motivos as motivosDe } from "./condiciones.js";
import { evaluar, nombreDeAccion, nombreDeEstado } from "./interprete.js";
import { entreComillas, enumerar, minusculaInicial, oracion } from "./textos.js";
import { elegirVersion } from "./versiones.js";
export function explicar(fuente, instancia, contexto, registro, accion) {
    const definicion = elegirVersion(fuente, instancia.version);
    const resultado = evaluar(definicion, instancia, contexto, registro);
    const estado = nombreDeEstado(definicion, instancia.estado);
    const deUna = (a) => "destino" in a ? explicarPermitida(a, estado, nombreDeEstado(definicion, a.destino)) : explicarBloqueada(a, estado);
    if (accion === undefined) {
        // En el orden de la definición, como los botones.
        const todas = [...resultado.permitidas, ...resultado.bloqueadas];
        const orden = new Map(definicion.transiciones.map((t, i) => [t.id, i]));
        return todas.sort((a, b) => orden.get(a.transicion) - orden.get(b.transicion)).map(deUna);
    }
    const encontrada = resultado.permitidas.find((a) => a.accion === accion) ?? resultado.bloqueadas.find((a) => a.accion === accion);
    if (encontrada)
        return deUna(encontrada);
    const donde = definicion.transiciones.filter((t) => t.accion === accion);
    if (!donde.length) {
        const nombre = registro.obtener(accion)?.nombre ?? accion;
        const motivo = `${entreComillas(nombre)} no forma parte del flujo ${entreComillas(definicion.nombre)}`;
        return { accion, nombre, permitida: false, motivos: [oracion(motivo)], sugerencias: [], texto: oracion(motivo) };
    }
    const nombre = nombreDeAccion(donde[0], registro);
    const estados = donde.flatMap((t) => t.desde === "*" ? definicion.estados.filter((e) => !(t.excepto ?? []).includes(e.id)).map((e) => e.id) : t.desde);
    const nombres = [...new Set(estados)].map((id) => entreComillas(nombreDeEstado(definicion, id)));
    const motivo = `${entreComillas(nombre)} no se puede hacer en ${entreComillas(estado)}. Se puede en: ${enumerar(nombres)}`;
    return { accion, nombre, permitida: false, motivos: [oracion(motivo)], sugerencias: [], texto: oracion(motivo) };
}
function explicarPermitida(a, estado, destino) {
    const sugerencias = a.sugerencias ? motivosDe(a.sugerencias).map(oracion) : [];
    const adonde = a.cambiaEstado ? `pasa a ${entreComillas(destino)}` : `sigue en ${entreComillas(estado)}`;
    const porque = a.recorrido.length ? ` (${a.recorrido.map((p) => `${p.nombre}: ${minusculaInicial(p.motivo)}`).join("; ")})` : "";
    const texto = [`Podés ${entreComillas(a.nombre)}: ${adonde}${porque}.`, ...lineasDeSugerencias(sugerencias)].join("\n");
    return { accion: a.accion, nombre: a.nombre, permitida: true, destino: a.destino, motivos: [], sugerencias, texto };
}
function explicarBloqueada(a, estado) {
    const motivos = a.motivos.map(oracion);
    const sugerencias = a.sugerencias ? motivosDe(a.sugerencias).map(oracion) : [];
    const encabezado = `No podés ${entreComillas(a.nombre)} desde ${entreComillas(estado)}`;
    const cuerpo = motivos.length === 1 ? [`${encabezado}: ${minusculaInicial(motivos[0])}`] : [`${encabezado}:`, ...motivos.map((m) => `- ${m}`)];
    return { accion: a.accion, nombre: a.nombre, permitida: false, motivos, sugerencias, texto: [...cuerpo, ...lineasDeSugerencias(sugerencias)].join("\n") };
}
function lineasDeSugerencias(sugerencias) {
    if (!sugerencias.length)
        return [];
    if (sugerencias.length === 1)
        return [`Además conviene: ${minusculaInicial(sugerencias[0])}`];
    return ["Además conviene:", ...sugerencias.map((s) => `- ${s}`)];
}
//# sourceMappingURL=explicar.js.map