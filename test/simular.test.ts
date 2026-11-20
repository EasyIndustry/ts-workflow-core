import { describe, expect, it } from "vitest";
import { simular } from "../src/index.js";
import { mezclar } from "../src/simular.js";
import { definicion, f, registro } from "./ayudas.js";

describe("simular", () => {
  it("recorre los pasos, aplica los cambios de contexto y no mueve el estado en un paso bloqueado", () => {
    const r = simular(
      definicion(),
      {
        nombre: "camino feliz",
        contexto: { flags: {} },
        pasos: [
          { accion: "ir", espera: { estado: "b" } },
          { accion: "ir", espera: { permitida: false }, nota: "sin pago" },
          { accion: "ir", contexto: { flags: { pago: true } }, espera: { permitida: true, estado: "c" } },
        ],
      },
      registro,
    );
    expect(r).toMatchObject({ escenario: "camino feliz", flujo: "prueba", version: 1, ok: true, estadoFinal: "c", contextoFinal: { flags: { pago: true } } });
    expect(r.pasos.map((p) => [p.desde, p.hasta, p.permitida])).toEqual([
      ["a", "b", true],
      ["b", "b", false],
      ["b", "c", true],
    ]);
    expect(r.pasos[1]).toMatchObject({ motivos: ["Falta el pago."], nota: "sin pago", fallas: [] });
  });

  it("reporta lo que no coincide con lo esperado", () => {
    const r = simular(
      definicion(),
      {
        contexto: { flags: {} },
        pasos: [
          { accion: "ir", espera: { permitida: false, estado: "c" } },
          { accion: "ir", espera: { permitida: true } },
          { accion: "cerrar" },
        ],
      },
      registro,
    );
    expect(r.ok).toBe(false);
    expect(r.escenario).toBeUndefined();
    expect(r.pasos[0]!.fallas).toEqual(["se esperaba que quedara bloqueada y estuvo permitida", "se esperaba terminar en «Fin» y quedó en «Medio»"]);
    expect(r.pasos[1]!.fallas).toEqual(["se esperaba que estuviera permitida y quedó bloqueada"]);
    expect(r.pasos[2]).toMatchObject({ permitida: false, motivos: ["«Cerrar» no forma parte del flujo «Prueba»."], fallas: [] });
  });

  it("por defecto usa la última versión y el estado inicial; se puede fijar los dos", () => {
    const v1 = definicion();
    const v2 = definicion({ version: 2, transiciones: v1.transiciones.map((t) => (t.id === "t2" ? { ...t, requisitos: f("firma") } : t)) });
    const pasos = [{ accion: "ir" }];
    expect(simular([v1, v2], { contexto: { flags: { pago: true } }, estado: "b", pasos }, registro)).toMatchObject({ version: 2, estadoFinal: "b" });
    expect(simular([v1, v2], { contexto: { flags: { pago: true } }, estado: "b", version: 1, pasos }, registro)).toMatchObject({ version: 1, estadoFinal: "c" });
    expect(simular([v1, v2], { contexto: { flags: {} }, pasos }, registro).estadoFinal).toBe("b");
  });

  it("mezclar combina objetos en profundidad, reemplaza listas y valores, y no toca los originales", () => {
    const base = { a: { b: 1, c: [1, 2] }, d: "x", e: { f: 1 } };
    const r = mezclar(base, { a: { c: [3] }, d: null, e: 5, g: { h: true } });
    expect(r).toEqual({ a: { b: 1, c: [3] }, d: null, e: 5, g: { h: true } });
    expect(base).toEqual({ a: { b: 1, c: [1, 2] }, d: "x", e: { f: 1 } });
  });
});
