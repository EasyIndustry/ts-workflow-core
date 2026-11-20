import { ErrorFlujo } from "./errores.js";
import type { DefinicionFlujo } from "./esquema.js";

/**
 * Versionado. Una versión publicada no cambia: un cambio es una versión nueva. Cada instancia guarda la versión con la
 * que arrancó y se evalúa siempre con esa, así las órdenes en curso no heredan reglas que no tenían.
 */

/** Dónde está una instancia: la versión de la definición con la que arrancó y su estado actual. */
export interface Instancia {
  readonly version: number;
  readonly estado: string;
}

/** Una definición, o todas las versiones de un mismo flujo. */
export type FuenteFlujo = DefinicionFlujo | readonly DefinicionFlujo[];

function listaDeVersiones(fuente: FuenteFlujo): readonly DefinicionFlujo[] {
  const lista = Array.isArray(fuente) ? (fuente as readonly DefinicionFlujo[]) : [fuente as DefinicionFlujo];
  if (!lista.length) throw new ErrorFlujo("sin_versiones", "No se pasó ninguna versión del flujo.");
  const ids = new Set(lista.map((d) => d.id));
  if (ids.size > 1) throw new ErrorFlujo("versiones_mezcladas", `Se mezclaron versiones de flujos distintos: ${[...ids].map((i) => `«${i}»`).join(", ")}.`);
  const vistas = new Set<number>();
  for (const d of lista) {
    if (vistas.has(d.version)) throw new ErrorFlujo("version_duplicada", `La versión ${d.version} de «${d.id}» está dos veces.`);
    vistas.add(d.version);
  }
  return lista;
}

/** La definición de una versión. Falla si no está: nunca se evalúa una instancia con reglas que no eran las suyas. */
export function elegirVersion(fuente: FuenteFlujo, version: number): DefinicionFlujo {
  const lista = listaDeVersiones(fuente);
  const definicion = lista.find((d) => d.version === version);
  if (!definicion) {
    const hay = lista.map((d) => d.version).sort((a, b) => a - b).join(", ");
    throw new ErrorFlujo("version_inexistente", `La instancia usa la versión ${version} de «${lista[0]!.id}», pero solo se pasó: ${hay}.`);
  }
  return definicion;
}

/** La versión más nueva: la que usa una instancia que arranca ahora. */
export function ultimaVersion(fuente: FuenteFlujo): DefinicionFlujo {
  return [...listaDeVersiones(fuente)].sort((a, b) => b.version - a.version)[0]!;
}

/** Una instancia nueva: con la última versión, en su estado inicial. La app guarda `version` junto al estado. */
export function iniciarInstancia(fuente: FuenteFlujo): Instancia {
  const definicion = ultimaVersion(fuente);
  return { version: definicion.version, estado: definicion.estadoInicial };
}
