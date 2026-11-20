import { crearRegistro, type Condicion, type DefinicionFlujo } from "../src/index.js";

/** Contexto de las pruebas: banderas prendidas por nombre. */
export type Ctx = { flags: Record<string, boolean> };

export const ctx = (...prendidas: string[]): Ctx => ({ flags: Object.fromEntries(prendidas.map((n) => [n, true])) });

/** Hoja «flag»: se cumple si la bandera está prendida. */
export const f = (nombre: string, mensaje?: string): Condicion => ({ condicion: "flag", params: { nombre }, ...(mensaje ? { mensaje } : {}) });

export const registro = crearRegistro<Ctx>([
  {
    nombre: "acciones de prueba",
    capacidades: [
      { id: "ir", nombre: "Ir", tipo: "accion" },
      { id: "volver", nombre: "Volver", tipo: "accion" },
      { id: "anotar", nombre: "Anotar", tipo: "accion" },
      { id: "cerrar", nombre: "Cerrar", tipo: "accion" },
    ],
  },
  {
    nombre: "condiciones y efectos de prueba",
    capacidades: [
      {
        id: "flag",
        nombre: "Bandera",
        tipo: "condicion",
        schemaEntrada: {
          type: "object",
          properties: { nombre: { type: "string", oneOf: [{ const: "pago", title: "el pago" }, { const: "firma", title: "la firma" }, { type: "string" }] } },
          required: ["nombre"],
          additionalProperties: false,
        },
        texto: { cumple: "Está {nombre}", noCumple: "Falta {nombre}" },
        evaluar: (p, c) => c.flags[String(p.nombre)] === true,
      },
      { id: "sin-texto", nombre: "Sin texto", tipo: "condicion", evaluar: (p) => p.valor === true },
      {
        id: "rompe",
        nombre: "Rompe",
        tipo: "condicion",
        evaluar: () => {
          throw new Error("se cayó la consulta");
        },
      },
      {
        id: "rompe-raro",
        nombre: "Rompe raro",
        tipo: "condicion",
        evaluar: () => {
          throw "texto suelto";
        },
      },
      {
        id: "log",
        nombre: "Log",
        tipo: "efecto",
        schemaEntrada: { type: "object", properties: { texto: { type: "string" } }, required: ["texto"], additionalProperties: false },
      },
      { id: "ping", nombre: "Ping", tipo: "efecto" },
    ],
  },
]);

/** Una definición válida y chica: a → b → c (final), con «volver» de b a a. Se pisa lo que haga falta. */
export function definicion(cambios: Partial<DefinicionFlujo> = {}): DefinicionFlujo {
  return {
    id: "prueba",
    version: 1,
    nombre: "Prueba",
    estadoInicial: "a",
    estados: [
      { id: "a", nombre: "Inicio" },
      { id: "b", nombre: "Medio" },
      { id: "c", nombre: "Fin", final: true },
    ],
    transiciones: [
      { id: "t1", accion: "ir", desde: ["a"], hacia: "b" },
      { id: "t2", accion: "ir", desde: ["b"], hacia: "c", requisitos: f("pago") },
      { id: "t3", accion: "volver", desde: ["b"], hacia: "a" },
    ],
    ...cambios,
  };
}
