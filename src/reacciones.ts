import type { PasoRecorrido, EfectoResuelto } from "./interprete.js";
import { aplicaDesde, estadoDe, evaluar, resolverEfectos } from "./interprete.js";
import { evaluarCondicion, motivos } from "./condiciones.js";
import type { DefinicionFlujo, Params, Reaccion } from "./esquema.js";
import { huella, jsonCanonico } from "./huella.js";
import type { Registro } from "./registro.js";
import { elegirVersion, type FuenteFlujo, type Instancia } from "./versiones.js";

/**
 * Reacciones: qué hace un flujo cuando llega un evento de afuera. Igual que `evaluar`, es puro: no escucha nada, no
 * ejecuta nada y no guarda nada. La app (o un plugin) recibe el evento, arma el contexto y ejecuta el plan.
 *
 * Una reacción no habilita: si intenta una transición, pasa por los requisitos de esa transición.
 */

/** Una ocurrencia de un evento. `params` dice cuál (se compara entera con los de la reacción). Los datos van en el contexto. */
export interface EventoFlujo {
  readonly evento: string;
  readonly params?: Params | undefined;
}

/** Algo que hay que escuchar para que las definiciones funcionen. `clave` es estable: sirve para reconciliar. */
export interface Suscripcion {
  readonly clave: string;
  readonly evento: string;
  readonly params: Params;
}

export interface PlanReaccion {
  flujo: string;
  version: number;
  estado: string;
  reaccion: string;
  evento: string;
  /** `false` si la condición de la reacción o los requisitos de la transición no se cumplen: no hay nada que ejecutar. */
  aplica: boolean;
  motivos: string[];
  transicion?: string;
  accion?: string;
  destino: string;
  cambiaEstado: boolean;
  recorrido: PasoRecorrido[];
  /** En orden: los de la reacción, los de la transición y los `alEntrar` del destino. Vacío si no aplica. */
  efectos: EfectoResuelto[];
}

const claveDeOcurrencia = (evento: string, params: Params | undefined) => jsonCanonico({ evento, params: params ?? {} });

/**
 * Los eventos que usan estas definiciones, sin repetir. Para no dejar de escuchar lo que todavía hace falta, pasá también
 * las versiones viejas que tengan instancias activas.
 */
export function suscripciones(definiciones: DefinicionFlujo | readonly DefinicionFlujo[]): Suscripcion[] {
  const lista: readonly DefinicionFlujo[] = Array.isArray(definiciones) ? definiciones : [definiciones as DefinicionFlujo];
  const porClave = new Map<string, Suscripcion>();
  for (const definicion of lista) {
    for (const r of definicion.reacciones ?? []) {
      const clave = huella({ evento: r.evento, params: r.params ?? {} });
      if (!porClave.has(clave)) porClave.set(clave, { clave, evento: r.evento, params: r.params ?? {} });
    }
  }
  return [...porClave.values()].sort((a, b) => a.clave.localeCompare(b.clave));
}

/**
 * Qué hay que hacer con esta instancia ante este evento. Devuelve `null` si en su estado nadie lo escucha. Se evalúa con
 * la versión de la instancia. Si la definición pasó `validarDefinicion`, a lo sumo una reacción coincide.
 */
export function reaccionar<C>(fuente: FuenteFlujo, instancia: Instancia, evento: EventoFlujo, contexto: C, registro: Registro<C>): PlanReaccion | null {
  const definicion = elegirVersion(fuente, instancia.version);
  estadoDe(definicion, instancia.estado);
  const buscada = claveDeOcurrencia(evento.evento, evento.params);
  const indice = (definicion.reacciones ?? []).findIndex((r) => aplicaDesde(r, instancia.estado) && claveDeOcurrencia(r.evento, r.params) === buscada);
  if (indice === -1) return null;
  const r = definicion.reacciones![indice]!;
  const ruta = `reacciones[${indice}]`;
  const base = planBase(definicion, instancia, r);

  if (r.si) {
    const si = evaluarCondicion(r.si, contexto, registro, `${ruta}.si`);
    if (!si.cumple) return { ...base, motivos: motivos(si) };
  }
  const propios = resolverEfectos(r.efectos, `reaccion:${r.id}`, `${ruta}.efectos`, contexto, registro);
  if (r.transicion === undefined) return { ...base, aplica: true, efectos: propios };

  // La transición se resuelve con `evaluar`: mismos requisitos, destino y efectos que si la hiciera una persona.
  const evaluacion = evaluar(definicion, instancia, contexto, registro);
  const bloqueada = evaluacion.bloqueadas.find((b) => b.transicion === r.transicion);
  if (bloqueada) return { ...base, transicion: bloqueada.transicion, accion: bloqueada.accion, motivos: bloqueada.motivos };
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

function planBase(definicion: DefinicionFlujo, instancia: Instancia, r: Reaccion): PlanReaccion {
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
