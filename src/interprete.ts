import { describir, evaluarCondicion, motivos, type ResultadoCondicion } from "./condiciones.js";
import { ErrorFlujo } from "./errores.js";
import type { DefinicionFlujo, Efecto, Estado, Params, Transicion } from "./esquema.js";
import type { Registro } from "./registro.js";
import { minusculaInicial } from "./textos.js";
import { elegirVersion, type FuenteFlujo, type Instancia } from "./versiones.js";

/**
 * El intérprete: puro y sin IO. Con la definición (de la versión de la instancia), el estado, el contexto y el registro,
 * dice qué acciones se pueden hacer, adónde lleva cada una y qué efectos produce, y por qué las otras no.
 *
 * La app suma esto a sus propias reglas (permisos, facturación, stock): una acción se hace si la permiten las dos.
 */

/** Una decisión atravesada camino al destino: qué rama tomó y por qué. `rama` es null cuando fue por el «sino». */
export interface PasoRecorrido {
  decision: string;
  nombre: string;
  rama: number | null;
  hacia: string;
  motivo: string;
}

export interface EfectoResuelto {
  efecto: string;
  params: Params;
  /** De dónde sale: «transicion:<id>» o «estado:<id>» (los `alEntrar` del destino). */
  origen: string;
}

export interface AccionPermitida {
  accion: string;
  nombre: string;
  transicion: string;
  desde: string;
  destino: string;
  cambiaEstado: boolean;
  recorrido: PasoRecorrido[];
  efectos: EfectoResuelto[];
  requisitos?: ResultadoCondicion;
  sugerencias?: ResultadoCondicion;
}

export interface AccionBloqueada {
  accion: string;
  nombre: string;
  transicion: string;
  desde: string;
  motivos: string[];
  requisitos: ResultadoCondicion;
  sugerencias?: ResultadoCondicion;
}

export interface ResultadoEvaluacion {
  flujo: string;
  version: number;
  estado: string;
  permitidas: AccionPermitida[];
  bloqueadas: AccionBloqueada[];
}

export function evaluar<C>(fuente: FuenteFlujo, instancia: Instancia, contexto: C, registro: Registro<C>): ResultadoEvaluacion {
  const definicion = elegirVersion(fuente, instancia.version);
  estadoDe(definicion, instancia.estado);
  const permitidas: AccionPermitida[] = [];
  const bloqueadas: AccionBloqueada[] = [];
  definicion.transiciones.forEach((t, i) => {
    if (!aplicaDesde(t, instancia.estado)) return;
    const ruta = `transiciones[${i}]`;
    const nombre = nombreDeAccion(t, registro);
    const sugerencias = t.sugerencias ? evaluarCondicion(t.sugerencias, contexto, registro, `${ruta}.sugerencias`) : undefined;
    const conSugerencias = sugerencias ? { sugerencias } : {};
    const requisitos = t.requisitos ? evaluarCondicion(t.requisitos, contexto, registro, `${ruta}.requisitos`) : undefined;
    if (requisitos && !requisitos.cumple) {
      bloqueadas.push({ accion: t.accion, nombre, transicion: t.id, desde: instancia.estado, motivos: motivos(requisitos), requisitos, ...conSugerencias });
      return;
    }
    const { destino, recorrido } = resolverDestino(definicion, t, instancia.estado, contexto, registro);
    const efectos = [
      ...resolverEfectos(t.efectos, `transicion:${t.id}`, `${ruta}.efectos`, contexto, registro),
      ...(destino !== instancia.estado ? efectosAlEntrar(definicion, destino, contexto, registro) : []),
    ];
    permitidas.push({
      accion: t.accion,
      nombre,
      transicion: t.id,
      desde: instancia.estado,
      destino,
      cambiaEstado: destino !== instancia.estado,
      recorrido,
      efectos,
      ...(requisitos ? { requisitos } : {}),
      ...conSugerencias,
    });
  });
  return { flujo: definicion.id, version: definicion.version, estado: instancia.estado, permitidas, bloqueadas };
}

/** ¿La transición se puede intentar desde este estado? */
export function aplicaDesde(t: Transicion, estado: string): boolean {
  if (t.desde === "*") return !(t.excepto ?? []).includes(estado);
  return t.desde.includes(estado);
}

export function estadoDe(definicion: DefinicionFlujo, id: string): Estado {
  const estado = definicion.estados.find((e) => e.id === id);
  if (!estado) throw new ErrorFlujo("estado_inexistente", `El estado «${id}» no existe en la versión ${definicion.version} de «${definicion.id}».`);
  return estado;
}

export function nombreDeEstado(definicion: DefinicionFlujo, id: string): string {
  return definicion.estados.find((e) => e.id === id)?.nombre ?? id;
}

export function nombreDeAccion<C>(t: Transicion, registro: Registro<C>): string {
  return t.nombre ?? registro.obtener(t.accion)?.nombre ?? t.accion;
}

function resolverDestino<C>(definicion: DefinicionFlujo, t: Transicion, estado: string, contexto: C, registro: Registro<C>) {
  const recorrido: PasoRecorrido[] = [];
  const decisiones = definicion.decisiones ?? [];
  let nodo = t.hacia ?? estado;
  // Una decisión no puede pasar dos veces: el validador rechaza los ciclos, esto es por si llega una definición sin validar.
  for (let saltos = 0; ; saltos++) {
    const indice = decisiones.findIndex((d) => d.id === nodo);
    if (indice === -1) break;
    if (saltos > decisiones.length) throw new ErrorFlujo("decision_sin_salida", `Las decisiones de «${definicion.id}» forman un ciclo (pasando por «${nodo}»).`);
    const decision = decisiones[indice]!;
    const evaluadas: ResultadoCondicion[] = [];
    let elegida: number | null = null;
    for (const [i, rama] of decision.ramas.entries()) {
      const r = evaluarCondicion(rama.si, contexto, registro, `decisiones[${indice}].ramas[${i}].si`);
      evaluadas.push(r);
      if (r.cumple) {
        elegida = i;
        break;
      }
    }
    const hacia = elegida === null ? decision.sino : decision.ramas[elegida]!.hacia;
    const motivo = elegida === null ? evaluadas.map((r, i) => (i === 0 ? describir(r) : minusculaInicial(describir(r)))).join("; ") : describir(evaluadas[elegida]!);
    recorrido.push({ decision: decision.id, nombre: decision.nombre, rama: elegida, hacia, motivo });
    nodo = hacia;
  }
  return { destino: nodo, recorrido };
}

function resolverEfectos<C>(efectos: Efecto[] | undefined, origen: string, ruta: string, contexto: C, registro: Registro<C>): EfectoResuelto[] {
  return (efectos ?? []).flatMap((e, i) => {
    if (e.si && !evaluarCondicion(e.si, contexto, registro, `${ruta}[${i}].si`).cumple) return [];
    return [{ efecto: e.efecto, params: e.params ?? {}, origen }];
  });
}

function efectosAlEntrar<C>(definicion: DefinicionFlujo, destino: string, contexto: C, registro: Registro<C>): EfectoResuelto[] {
  const indice = definicion.estados.findIndex((e) => e.id === destino);
  const estado = definicion.estados[indice];
  return estado ? resolverEfectos(estado.alEntrar, `estado:${destino}`, `estados[${indice}].alEntrar`, contexto, registro) : [];
}
