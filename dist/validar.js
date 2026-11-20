import { parsearDefinicion } from "./esquema.js";
import { aplicaDesde } from "./interprete.js";
import { validarJsonSchema } from "./jsonSchema.js";
import { mapaDeDescriptores } from "./registro.js";
import { entreComillas, enumerar } from "./textos.js";
export function validarDefinicion(valor, registro, opciones = {}) {
    const parseo = parsearDefinicion(valor);
    if (!parseo.success) {
        const errores = parseo.error.issues.map((i) => ({ codigo: "esquema", mensaje: i.message, ruta: formatearRuta(i.path) }));
        return { valido: false, errores, avisos: [] };
    }
    const def = parseo.data;
    const errores = [];
    const avisos = [];
    const error = (codigo, mensaje, ruta = "") => errores.push({ codigo, mensaje, ruta });
    const aviso = (codigo, mensaje, ruta = "") => avisos.push({ codigo, mensaje, ruta });
    const estados = new Set(def.estados.map((e) => e.id));
    const decisiones = new Map((def.decisiones ?? []).map((d) => [d.id, d]));
    // --- Ids repetidos: estados y decisiones comparten espacio (los dos son destinos); las transiciones van aparte.
    const nodos = [...def.estados.map((e, i) => ({ id: e.id, ruta: `estados[${i}]` })), ...(def.decisiones ?? []).map((d, i) => ({ id: d.id, ruta: `decisiones[${i}]` }))];
    repetidos(nodos).forEach(({ id, ruta }) => error("id_duplicado", `El id ${entreComillas(id)} está repetido entre estados y decisiones.`, ruta));
    repetidos(def.transiciones.map((t, i) => ({ id: t.id, ruta: `transiciones[${i}]` }))).forEach(({ id, ruta }) => error("id_duplicado", `Hay dos transiciones con el id ${entreComillas(id)}.`, ruta));
    // --- Referencias.
    const debeSerEstado = (id, ruta, que) => {
        if (estados.has(id))
            return;
        if (decisiones.has(id))
            error("no_es_estado", `${que} tiene que ser un estado y ${entreComillas(id)} es una decisión.`, ruta);
        else
            error("referencia_inexistente", `${que}: el estado ${entreComillas(id)} no existe.`, ruta);
    };
    const debeExistir = (id, ruta, que) => {
        if (!estados.has(id) && !decisiones.has(id))
            error("referencia_inexistente", `${que}: ${entreComillas(id)} no es un estado ni una decisión.`, ruta);
    };
    debeSerEstado(def.estadoInicial, "estadoInicial", "El estado inicial");
    def.transiciones.forEach((t, i) => {
        const ruta = `transiciones[${i}]`;
        if (t.desde !== "*")
            t.desde.forEach((d, j) => debeSerEstado(d, `${ruta}.desde[${j}]`, `«desde» de ${entreComillas(t.id)}`));
        (t.excepto ?? []).forEach((d, j) => debeSerEstado(d, `${ruta}.excepto[${j}]`, `«excepto» de ${entreComillas(t.id)}`));
        if (t.excepto && t.desde !== "*")
            aviso("excepto_sin_comodin", `${entreComillas(t.id)} tiene «excepto» pero no usa desde "*": no tiene efecto.`, `${ruta}.excepto`);
        if (t.hacia !== undefined)
            debeExistir(t.hacia, `${ruta}.hacia`, `«hacia» de ${entreComillas(t.id)}`);
    });
    (def.decisiones ?? []).forEach((d, i) => {
        d.ramas.forEach((r, j) => debeExistir(r.hacia, `decisiones[${i}].ramas[${j}].hacia`, `La rama ${j + 1} de ${entreComillas(d.nombre)}`));
        debeExistir(d.sino, `decisiones[${i}].sino`, `El «sino» de ${entreComillas(d.nombre)}`);
    });
    const referenciasSanas = errores.length === 0;
    // --- Ambigüedad: desde un mismo estado, una acción tiene a lo sumo una transición.
    for (const estado of def.estados) {
        const porAccion = new Map();
        for (const t of def.transiciones) {
            if (aplicaDesde(t, estado.id))
                porAccion.set(t.accion, [...(porAccion.get(t.accion) ?? []), t.id]);
        }
        for (const [accion, ids] of porAccion) {
            if (ids.length > 1) {
                error("transicion_ambigua", `Desde ${entreComillas(estado.nombre)} la acción ${entreComillas(accion)} tiene ${ids.length} transiciones (${enumerar(ids.map(entreComillas))}). Usá una sola con un nodo de decisión.`, `estados[${def.estados.indexOf(estado)}]`);
            }
        }
    }
    // El análisis del grafo necesita referencias sanas: si no, solo agrega ruido.
    if (referenciasSanas)
        analizarGrafo(def, estados, decisiones, error, aviso);
    if (registro)
        validarCapacidades(def, mapaDeDescriptores(registro), opciones.validarEsquema ?? ((v, s) => validarJsonSchema(v, s)), error);
    return { valido: errores.length === 0, errores, avisos, definicion: def };
}
function analizarGrafo(def, estados, decisiones, error, aviso) {
    // Ciclos entre decisiones (decisión → decisión → … → la primera): una decisión tiene que llegar a un estado.
    const color = new Map();
    const pila = [];
    const visitar = (id) => {
        color.set(id, "visitando");
        pila.push(id);
        const d = decisiones.get(id);
        for (const destino of [...d.ramas.map((r) => r.hacia), d.sino]) {
            if (!decisiones.has(destino))
                continue;
            if (color.get(destino) === "visitando") {
                const ciclo = [...pila.slice(pila.indexOf(destino)), destino].map((x) => entreComillas(decisiones.get(x).nombre));
                error("ciclo_de_decisiones", `Las decisiones forman un ciclo: ${ciclo.join(" → ")}.`, `decisiones[${[...decisiones.keys()].indexOf(destino)}]`);
            }
            else if (!color.has(destino))
                visitar(destino);
        }
        pila.pop();
        color.set(id, "listo");
    };
    for (const id of decisiones.keys())
        if (!color.has(id))
            visitar(id);
    // Aristas estado → estado (atravesando decisiones), y qué decisiones se tocan desde cada estado.
    const destinosDe = (nodo, vistos) => {
        if (estados.has(nodo))
            return [nodo];
        if (vistos.has(nodo))
            return [];
        vistos.add(nodo);
        const d = decisiones.get(nodo);
        return [...d.ramas.map((r) => r.hacia), d.sino].flatMap((x) => destinosDe(x, vistos));
    };
    const salidas = new Map();
    const decisionesTocadas = new Set();
    for (const estado of def.estados) {
        const destinos = new Set();
        for (const t of def.transiciones) {
            if (!aplicaDesde(t, estado.id) || t.hacia === undefined)
                continue;
            const vistos = new Set();
            destinosDe(t.hacia, vistos).forEach((d) => destinos.add(d));
            vistos.forEach((d) => decisionesTocadas.add(d));
        }
        destinos.delete(estado.id);
        salidas.set(estado.id, destinos);
    }
    // Alcanzables desde el inicial.
    const alcanzables = recorrer([def.estadoInicial], (id) => salidas.get(id) ?? []);
    const decisionesAlcanzables = new Set();
    for (const estado of alcanzables) {
        for (const t of def.transiciones) {
            if (aplicaDesde(t, estado) && t.hacia !== undefined && decisiones.has(t.hacia)) {
                const vistos = new Set();
                destinosDe(t.hacia, vistos);
                vistos.forEach((d) => decisionesAlcanzables.add(d));
            }
        }
    }
    def.estados.forEach((e, i) => {
        if (!alcanzables.has(e.id))
            error("estado_inalcanzable", `No se llega nunca a ${entreComillas(e.nombre)} desde el estado inicial.`, `estados[${i}]`);
    });
    (def.decisiones ?? []).forEach((d, i) => {
        if (!decisionesAlcanzables.has(d.id))
            aviso("decision_inalcanzable", `Ninguna transición alcanzable pasa por la decisión ${entreComillas(d.nombre)}.`, `decisiones[${i}]`);
    });
    // Callejones: desde un estado no final tiene que poder llegarse a algún final.
    const finales = def.estados.filter((e) => e.final).map((e) => e.id);
    if (!finales.length) {
        aviso("sin_estado_final", "El flujo no tiene estados finales, así que no se controlan callejones.");
        return;
    }
    const entradas = new Map();
    for (const [desde, destinos] of salidas)
        for (const d of destinos)
            entradas.set(d, [...(entradas.get(d) ?? []), desde]);
    const llegan = recorrer(finales, (id) => entradas.get(id) ?? []);
    def.estados.forEach((e, i) => {
        if (!e.final && alcanzables.has(e.id) && !llegan.has(e.id)) {
            error("callejon", `Desde ${entreComillas(e.nombre)} no se puede llegar a ningún estado final: es un callejón.`, `estados[${i}]`);
        }
    });
}
function recorrer(inicio, vecinos) {
    const vistos = new Set(inicio);
    const cola = [...inicio];
    while (cola.length) {
        for (const v of vecinos(cola.shift())) {
            if (!vistos.has(v)) {
                vistos.add(v);
                cola.push(v);
            }
        }
    }
    return vistos;
}
function validarCapacidades(def, mapa, validarEsquema, error) {
    const usar = (id, tipo, ruta, params) => {
        const d = mapa.get(id);
        if (!d)
            return error("capacidad_desconocida", `${NOMBRE_TIPO[tipo]} ${entreComillas(id)} no está en el registro.`, ruta);
        if (d.tipo !== tipo)
            return error("tipo_de_capacidad", `${entreComillas(id)} es ${ARTICULO_TIPO[d.tipo]}, no ${ARTICULO_TIPO[tipo]}.`, ruta);
        if (tipo === "accion" || !d.schemaEntrada)
            return;
        for (const p of validarEsquema(params ?? {}, d.schemaEntrada))
            error("params_invalidos", `${entreComillas(d.nombre)}: ${p}`, `${ruta}.params`);
    };
    const condicion = (c, ruta) => {
        if ("condicion" in c)
            usar(c.condicion, "condicion", ruta, c.params);
        else if ("todas" in c)
            c.todas.forEach((h, i) => condicion(h, `${ruta}.todas[${i}]`));
        else if ("alguna" in c)
            c.alguna.forEach((h, i) => condicion(h, `${ruta}.alguna[${i}]`));
        else if ("no" in c)
            condicion(c.no, `${ruta}.no`);
        else {
            condicion(c.si, `${ruta}.si`);
            condicion(c.entonces, `${ruta}.entonces`);
        }
    };
    const efectos = (lista, ruta) => (lista ?? []).forEach((e, i) => {
        usar(e.efecto, "efecto", `${ruta}[${i}]`, e.params);
        if (e.si)
            condicion(e.si, `${ruta}[${i}].si`);
    });
    def.estados.forEach((e, i) => efectos(e.alEntrar, `estados[${i}].alEntrar`));
    (def.decisiones ?? []).forEach((d, i) => d.ramas.forEach((r, j) => condicion(r.si, `decisiones[${i}].ramas[${j}].si`)));
    def.transiciones.forEach((t, i) => {
        const ruta = `transiciones[${i}]`;
        usar(t.accion, "accion", `${ruta}.accion`);
        if (t.requisitos)
            condicion(t.requisitos, `${ruta}.requisitos`);
        if (t.sugerencias)
            condicion(t.sugerencias, `${ruta}.sugerencias`);
        efectos(t.efectos, `${ruta}.efectos`);
    });
}
const NOMBRE_TIPO = { accion: "La acción", condicion: "La condición", efecto: "El efecto" };
const ARTICULO_TIPO = { accion: "una acción", condicion: "una condición", efecto: "un efecto" };
function repetidos(items) {
    const vistos = new Set();
    return items.filter(({ id }) => (vistos.has(id) ? true : (vistos.add(id), false)));
}
function formatearRuta(path) {
    return path.reduce((acc, p) => (typeof p === "number" ? `${acc}[${p}]` : acc ? `${acc}.${String(p)}` : String(p)), "");
}
//# sourceMappingURL=validar.js.map