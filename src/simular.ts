import { explicar } from "./explicar.js";
import { evaluar, nombreDeEstado, type EfectoResuelto, type PasoRecorrido } from "./interprete.js";
import { esObjeto } from "./jsonSchema.js";
import type { Registro } from "./registro.js";
import { entreComillas } from "./textos.js";
import { elegirVersion, ultimaVersion, type FuenteFlujo } from "./versiones.js";

/**
 * Simulación: recorre un escenario sin ejecutar nada. Como el core no ejecuta acciones ni efectos, cada paso dice cómo
 * cambia el contexto (por ejemplo, «se subió la foto de FUNCIONANDO»). Un paso bloqueado no cambia el estado. Con
 * `espera`, un escenario sirve de test de aceptación de una configuración.
 */

export interface PasoEscenario {
  accion: string;
  /** Se mezcla con el contexto antes de evaluar este paso: objetos en profundidad; listas y valores se reemplazan. */
  contexto?: Record<string, unknown>;
  espera?: { permitida?: boolean; estado?: string };
  nota?: string;
}

export interface Escenario {
  nombre?: string;
  /** Por defecto, la última versión. */
  version?: number;
  /** Por defecto, el estado inicial. */
  estado?: string;
  contexto: Record<string, unknown>;
  pasos: PasoEscenario[];
}

export interface PasoSimulado {
  indice: number;
  accion: string;
  nombre: string;
  desde: string;
  hasta: string;
  permitida: boolean;
  motivos: string[];
  efectos: EfectoResuelto[];
  recorrido: PasoRecorrido[];
  /** Lo que no coincidió con `espera`; vacío si coincidió o si no había `espera`. */
  fallas: string[];
  nota?: string;
}

export interface ResultadoSimulacion {
  escenario?: string;
  flujo: string;
  version: number;
  /** true si todos los pasos coincidieron con lo que esperaban. */
  ok: boolean;
  estadoFinal: string;
  contextoFinal: Record<string, unknown>;
  pasos: PasoSimulado[];
}

export function simular<C>(fuente: FuenteFlujo, escenario: Escenario, registro: Registro<C>): ResultadoSimulacion {
  const definicion = escenario.version === undefined ? ultimaVersion(fuente) : elegirVersion(fuente, escenario.version);
  let estado = escenario.estado ?? definicion.estadoInicial;
  let contexto: Record<string, unknown> = escenario.contexto;
  const pasos: PasoSimulado[] = [];

  escenario.pasos.forEach((paso, indice) => {
    if (paso.contexto) contexto = mezclar(contexto, paso.contexto);
    const instancia = { version: definicion.version, estado };
    const ctx = contexto as C;
    const resultado = evaluar(definicion, instancia, ctx, registro);
    const permitida = resultado.permitidas.find((a) => a.accion === paso.accion);
    const desde = estado;
    let simulado: PasoSimulado;
    if (permitida) {
      estado = permitida.destino;
      simulado = { indice, accion: paso.accion, nombre: permitida.nombre, desde, hasta: estado, permitida: true, motivos: [], efectos: permitida.efectos, recorrido: permitida.recorrido, fallas: [] };
    } else {
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
    if (paso.nota !== undefined) simulado.nota = paso.nota;
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
export function mezclar(base: Record<string, unknown>, cambios: Record<string, unknown>): Record<string, unknown> {
  const resultado: Record<string, unknown> = { ...base };
  for (const [clave, valor] of Object.entries(cambios)) {
    const previo = resultado[clave];
    resultado[clave] = esObjeto(previo) && esObjeto(valor) ? mezclar(previo, valor) : valor;
  }
  return resultado;
}
