import { explicar } from "./explicar.js";
import { evaluar, nombreDeEstado } from "./interprete.js";
import { esObjeto } from "./jsonSchema.js";
import { entreComillas } from "./textos.js";
import { elegirVersion, ultimaVersion } from "./versiones.js";
export function simular(fuente, escenario, registro) {
    const definicion = escenario.version === undefined ? ultimaVersion(fuente) : elegirVersion(fuente, escenario.version);
    let estado = escenario.estado ?? definicion.estadoInicial;
    let contexto = escenario.contexto;
    const pasos = [];
    escenario.pasos.forEach((paso, indice) => {
        if (paso.contexto)
            contexto = mezclar(contexto, paso.contexto);
        const instancia = { version: definicion.version, estado };
        const ctx = contexto;
        const resultado = evaluar(definicion, instancia, ctx, registro);
        const permitida = resultado.permitidas.find((a) => a.accion === paso.accion);
        const desde = estado;
        let simulado;
        if (permitida) {
            estado = permitida.destino;
            simulado = { indice, accion: paso.accion, nombre: permitida.nombre, desde, hasta: estado, permitida: true, motivos: [], efectos: permitida.efectos, recorrido: permitida.recorrido, fallas: [] };
        }
        else {
            const explicacion = explicar(definicion, instancia, ctx, registro, paso.accion);
            simulado = { indice, accion: paso.accion, nombre: explicacion.nombre, desde, hasta: estado, permitida: false, motivos: explicacion.motivos, efectos: [], recorrido: [], fallas: [] };
        }
        if (paso.espera?.permitida !== undefined && paso.espera.permitida !== simulado.permitida) {
            simulado.fallas.push(paso.espera.permitida ? "se esperaba que estuviera permitida y quedó bloqueada" : "se esperaba que quedara bloqueada y estuvo permitida");
        }
        if (paso.espera?.estado !== undefined && paso.espera.estado !== estado) {
            const esperado = entreComillas(nombreDeEstado(definicion, paso.espera.estado));
            simulado.fallas.push(`se esperaba terminar en ${esperado} y quedó en ${entreComillas(nombreDeEstado(definicion, estado))}`);
        }
        if (paso.nota !== undefined)
            simulado.nota = paso.nota;
        pasos.push(simulado);
    });
    return {
        ...(escenario.nombre !== undefined ? { escenario: escenario.nombre } : {}),
        flujo: definicion.id,
        version: definicion.version,
        ok: pasos.every((p) => p.fallas.length === 0),
        estadoFinal: estado,
        contextoFinal: contexto,
        pasos,
    };
}
/** Mezcla en profundidad sin modificar los originales: los objetos se combinan; listas y valores se reemplazan. */
export function mezclar(base, cambios) {
    const resultado = { ...base };
    for (const [clave, valor] of Object.entries(cambios)) {
        const previo = resultado[clave];
        resultado[clave] = esObjeto(previo) && esObjeto(valor) ? mezclar(previo, valor) : valor;
    }
    return resultado;
}
//# sourceMappingURL=simular.js.map