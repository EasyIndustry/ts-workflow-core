import { motivos as motivosDe } from "./condiciones.js";
import { evaluar, nombreDeAccion, nombreDeEstado, type AccionBloqueada, type AccionPermitida } from "./interprete.js";
import type { Registro } from "./registro.js";
import { entreComillas, enumerar, minusculaInicial, oracion } from "./textos.js";
import { elegirVersion, type FuenteFlujo, type Instancia } from "./versiones.js";

/** «Por qué no puedo avanzar», en castellano, armado con lo mismo que devuelve `evaluar`. */
export interface Explicacion {
  accion: string;
  nombre: string;
  permitida: boolean;
  /** Si está permitida: el estado al que lleva. */
  destino?: string;
  /** Si está bloqueada (o no existe en este estado): una frase por cosa que falta. */
  motivos: string[];
  /** Lo que conviene completar aunque no bloquee. */
  sugerencias: string[];
  /** Todo junto, listo para mostrar. */
  texto: string;
}

/** Sin `accion`: explica todas las acciones del estado actual. Con `accion`: solo esa, aunque no exista en este estado. */
export function explicar<C>(fuente: FuenteFlujo, instancia: Instancia, contexto: C, registro: Registro<C>): Explicacion[];
export function explicar<C>(fuente: FuenteFlujo, instancia: Instancia, contexto: C, registro: Registro<C>, accion: string): Explicacion;
export function explicar<C>(fuente: FuenteFlujo, instancia: Instancia, contexto: C, registro: Registro<C>, accion?: string): Explicacion | Explicacion[] {
  const definicion = elegirVersion(fuente, instancia.version);
  const resultado = evaluar(definicion, instancia, contexto, registro);
  const estado = nombreDeEstado(definicion, instancia.estado);
  const deUna = (a: AccionPermitida | AccionBloqueada) =>
    "destino" in a ? explicarPermitida(a, estado, nombreDeEstado(definicion, a.destino)) : explicarBloqueada(a, estado);

  if (accion === undefined) {
    // En el orden de la definición, como los botones.
    const todas = [...resultado.permitidas, ...resultado.bloqueadas];
    const orden = new Map(definicion.transiciones.map((t, i) => [t.id, i]));
    return todas.sort((a, b) => orden.get(a.transicion)! - orden.get(b.transicion)!).map(deUna);
  }

  const encontrada = resultado.permitidas.find((a) => a.accion === accion) ?? resultado.bloqueadas.find((a) => a.accion === accion);
  if (encontrada) return deUna(encontrada);

  const donde = definicion.transiciones.filter((t) => t.accion === accion);
  if (!donde.length) {
    const nombre = registro.obtener(accion)?.nombre ?? accion;
    const motivo = `${entreComillas(nombre)} no forma parte del flujo ${entreComillas(definicion.nombre)}`;
    return { accion, nombre, permitida: false, motivos: [oracion(motivo)], sugerencias: [], texto: oracion(motivo) };
  }
  const nombre = nombreDeAccion(donde[0]!, registro);
  const estados = donde.flatMap((t) =>
    t.desde === "*" ? definicion.estados.filter((e) => !(t.excepto ?? []).includes(e.id)).map((e) => e.id) : t.desde,
  );
  const nombres = [...new Set(estados)].map((id) => entreComillas(nombreDeEstado(definicion, id)));
  const motivo = `${entreComillas(nombre)} no se puede hacer en ${entreComillas(estado)}. Se puede en: ${enumerar(nombres)}`;
  return { accion, nombre, permitida: false, motivos: [oracion(motivo)], sugerencias: [], texto: oracion(motivo) };
}

function explicarPermitida(a: AccionPermitida, estado: string, destino: string): Explicacion {
  const sugerencias = a.sugerencias ? motivosDe(a.sugerencias).map(oracion) : [];
  const adonde = a.cambiaEstado ? `pasa a ${entreComillas(destino)}` : `sigue en ${entreComillas(estado)}`;
  const porque = a.recorrido.length ? ` (${a.recorrido.map((p) => `${p.nombre}: ${minusculaInicial(p.motivo)}`).join("; ")})` : "";
  const texto = [`Podés ${entreComillas(a.nombre)}: ${adonde}${porque}.`, ...lineasDeSugerencias(sugerencias)].join("\n");
  return { accion: a.accion, nombre: a.nombre, permitida: true, destino: a.destino, motivos: [], sugerencias, texto };
}

function explicarBloqueada(a: AccionBloqueada, estado: string): Explicacion {
  const motivos = a.motivos.map(oracion);
  const sugerencias = a.sugerencias ? motivosDe(a.sugerencias).map(oracion) : [];
  const encabezado = `No podés ${entreComillas(a.nombre)} desde ${entreComillas(estado)}`;
  const cuerpo = motivos.length === 1 ? [`${encabezado}: ${minusculaInicial(motivos[0]!)}`] : [`${encabezado}:`, ...motivos.map((m) => `- ${m}`)];
  return { accion: a.accion, nombre: a.nombre, permitida: false, motivos, sugerencias, texto: [...cuerpo, ...lineasDeSugerencias(sugerencias)].join("\n") };
}

function lineasDeSugerencias(sugerencias: string[]): string[] {
  if (!sugerencias.length) return [];
  if (sugerencias.length === 1) return [`Además conviene: ${minusculaInicial(sugerencias[0]!)}`];
  return ["Además conviene:", ...sugerencias.map((s) => `- ${s}`)];
}
