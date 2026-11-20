import { describe, expect, it } from "vitest";
import { explicar, type DefinicionFlujo } from "../src/index.js";
import { ctx, definicion, f, registro } from "./ayudas.js";

const v1 = { version: 1 } as const;

describe("explicar: «por qué no puedo avanzar», en castellano", () => {
  it("un solo motivo va en la misma línea", () => {
    const e = explicar(definicion(), { ...v1, estado: "b" }, ctx(), registro, "ir");
    expect(e).toEqual({ accion: "ir", nombre: "Ir", permitida: false, motivos: ["Falta el pago."], sugerencias: [], texto: "No podés «Ir» desde «Medio»: falta el pago." });
  });

  it("varios motivos van en lista, y las sugerencias aparte", () => {
    const def = definicion();
    def.transiciones[1] = {
      ...def.transiciones[1]!,
      requisitos: { todas: [f("pago"), { si: f("firma"), entonces: f("sello") }] },
      sugerencias: f("foto"),
    };
    const e = explicar(def, { ...v1, estado: "b" }, ctx("firma"), registro, "ir");
    expect(e.texto).toBe(["No podés «Ir» desde «Medio»:", "- Falta el pago.", "- Como está la firma: falta sello.", "Además conviene: falta foto."].join("\n"));
    expect(e.motivos).toEqual(["Falta el pago.", "Como está la firma: falta sello."]);
    expect(e.sugerencias).toEqual(["Falta foto."]);
  });

  it("una permitida dice adónde lleva y por qué, si pasó por decisiones", () => {
    const def: DefinicionFlujo = definicion({
      decisiones: [{ id: "d", nombre: "¿Pagó?", ramas: [{ si: f("pago"), hacia: "c" }], sino: "b" }],
      transiciones: [
        { id: "t1", accion: "ir", desde: ["a"], hacia: "d", sugerencias: { todas: [f("foto"), f("firma")] } },
        { id: "t2", accion: "ir", desde: ["b"], hacia: "c" },
      ],
    });
    const e = explicar(def, { ...v1, estado: "a" }, ctx("pago"), registro, "ir");
    expect(e.permitida).toBe(true);
    expect(e.destino).toBe("c");
    expect(e.texto).toBe(["Podés «Ir»: pasa a «Fin» (¿Pagó?: está el pago).", "Además conviene:", "- Falta foto.", "- Falta la firma."].join("\n"));
  });

  it("una acción que no cambia de estado «sigue en» el actual", () => {
    const def = definicion({ transiciones: [...definicion().transiciones, { id: "n", accion: "anotar", desde: "*" }] });
    expect(explicar(def, { ...v1, estado: "c" }, ctx(), registro, "anotar").texto).toBe("Podés «Anotar»: sigue en «Fin».");
  });

  it("si la acción no existe en este estado, dice dónde sí", () => {
    const def = definicion({ transiciones: [...definicion().transiciones, { id: "x", accion: "cerrar", desde: "*", excepto: ["a", "c"], hacia: "c" }] });
    const e = explicar(def, { ...v1, estado: "a" }, ctx(), registro, "volver");
    expect(e.texto).toBe("«Volver» no se puede hacer en «Inicio». Se puede en: «Medio».");
    expect(explicar(def, { ...v1, estado: "c" }, ctx(), registro, "cerrar").texto).toBe("«Cerrar» no se puede hacer en «Fin». Se puede en: «Medio».");
    expect(explicar(def, { ...v1, estado: "c" }, ctx(), registro, "ir").texto).toBe("«Ir» no se puede hacer en «Fin». Se puede en: «Inicio» y «Medio».");
  });

  it("si la acción no está en el flujo, lo dice", () => {
    expect(explicar(definicion(), { ...v1, estado: "a" }, ctx(), registro, "anotar").texto).toBe("«Anotar» no forma parte del flujo «Prueba».");
    expect(explicar(definicion(), { ...v1, estado: "a" }, ctx(), registro, "inventada")).toMatchObject({ nombre: "inventada", permitida: false });
  });

  it("sin acción, explica todas las del estado en el orden de la definición", () => {
    const todas = explicar(definicion(), { ...v1, estado: "b" }, ctx(), registro);
    expect(todas.map((e) => [e.accion, e.permitida])).toEqual([
      ["ir", false],
      ["volver", true],
    ]);
    expect(todas[1]!.texto).toBe("Podés «Volver»: pasa a «Inicio».");
  });
});
