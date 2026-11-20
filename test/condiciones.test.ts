import { describe, expect, it } from "vitest";
import { casilleros, describir, ErrorFlujo, motivos, type Condicion } from "../src/index.js";
import { evaluarCondicion } from "../src/condiciones.js";
import { ctx, f, registro, type Ctx } from "./ayudas.js";

const ev = (c: Condicion, contexto: Ctx = ctx()) => evaluarCondicion(c, contexto, registro, "r");

describe("condiciones compuestas", () => {
  it("hoja: usa la plantilla del registro con el rótulo del schema", () => {
    expect(ev(f("pago"))).toMatchObject({ tipo: "hoja", cumple: false, texto: "Falta el pago", ruta: "r" });
    expect(ev(f("pago"), ctx("pago"))).toMatchObject({ cumple: true, texto: "Está el pago" });
    expect(ev(f("otra"))).toMatchObject({ texto: "Falta otra" });
  });

  it("hoja sin plantilla: frase genérica con el nombre y los params", () => {
    expect(ev({ condicion: "sin-texto", params: { valor: false, lista: [1, 2] } })).toMatchObject({ texto: "No se cumple «Sin texto» (valor: false, lista: 1, 2)" });
    expect(ev({ condicion: "sin-texto", params: { valor: true } })).toMatchObject({ texto: "Se cumple «Sin texto» (valor: true)" });
    expect(ev({ condicion: "sin-texto" })).toMatchObject({ texto: "No se cumple «Sin texto»" });
  });

  it("todas: evalúa todo y junta todo lo que falta", () => {
    const r = ev({ todas: [f("pago"), f("firma"), f("x")] }, ctx("firma"));
    expect(r.cumple).toBe(false);
    expect(motivos(r)).toEqual(["Falta el pago", "Falta x"]);
    expect(describir(ev({ todas: [f("pago"), f("firma")] }, ctx("pago", "firma")))).toBe("Está el pago y está la firma");
  });

  it("alguna: alcanza con una; si no, ofrece las alternativas", () => {
    expect(ev({ alguna: [f("pago"), f("firma")] }, ctx("firma")).cumple).toBe(true);
    const r = ev({ alguna: [f("pago"), { todas: [f("firma"), f("x")] }] });
    expect(motivos(r)).toEqual(["Hace falta al menos una de estas: falta el pago o falta la firma y falta x"]);
    expect(motivos(ev({ alguna: [f("pago")] }))).toEqual(["Falta el pago"]);
    expect(describir(ev({ alguna: [f("pago"), f("firma"), f("x")] }, ctx("pago", "x")))).toBe("Está el pago y está x");
  });

  it("no: el motivo es lo que no debería pasar", () => {
    const r = ev({ no: f("pago") }, ctx("pago"));
    expect(r.cumple).toBe(false);
    expect(motivos(r)).toEqual(["Está el pago"]);
    expect(describir(ev({ no: f("pago") }))).toBe("Falta el pago");
  });

  it("si/entonces: no aplica si la premisa no se cumple (y no evalúa la consecuencia)", () => {
    const c: Condicion = { si: f("firma"), entonces: { condicion: "rompe" } };
    const r = ev(c);
    expect(r).toMatchObject({ tipo: "si", cumple: true, aplica: false, entonces: null });
    expect(describir(r)).toBe("Falta la firma");
  });

  it("si/entonces: con la premisa cumplida, explica con «Como…»", () => {
    const r = ev({ si: f("firma"), entonces: { todas: [f("pago"), f("x")] } }, ctx("firma"));
    expect(r.cumple).toBe(false);
    expect(motivos(r)).toEqual(["Como está la firma: falta el pago", "Como está la firma: falta x"]);
    expect(describir(ev({ si: f("firma"), entonces: f("pago") }, ctx("firma", "pago")))).toBe("Está la firma y está el pago");
  });

  it("un mensaje propio reemplaza al generado, en cualquier nivel", () => {
    expect(motivos(ev(f("pago", "Cobrale antes de entregar")))).toEqual(["Cobrale antes de entregar"]);
    expect(motivos(ev({ todas: [f("pago"), f("firma")], mensaje: "Faltan pago y firma" }))).toEqual(["Faltan pago y firma"]);
    expect(motivos(ev(f("pago", "no se usa"), ctx("pago")))).toEqual([]);
  });

  it("describir de algo que no se cumple usa los motivos", () => {
    expect(describir(ev({ todas: [f("pago"), f("firma")] }))).toBe("Falta el pago y falta la firma");
  });

  it("casilleros: las hojas que aplican, sin premisas ni consecuencias que no aplican", () => {
    const c: Condicion = {
      todas: [f("pago"), { si: f("firma"), entonces: f("x") }, { si: f("nada"), entonces: f("y") }, { no: f("bloqueado") }, { alguna: [f("z")] }],
    };
    const lista = casilleros(ev(c, ctx("firma", "pago")));
    expect(lista.map((l) => [l.texto, l.cumple])).toEqual([
      ["Está el pago", true],
      ["Falta x", false],
      ["Falta bloqueado", true],
      ["Falta z", false],
    ]);
    expect(lista[0]).toMatchObject({ condicion: "flag", params: { nombre: "pago" }, ruta: "r.todas[0]" });
    expect(casilleros(undefined)).toEqual([]);
  });

  it("errores de uso: condición desconocida, de otro tipo o que se cae al evaluar", () => {
    expect(() => ev({ condicion: "nada" })).toThrow(/«nada» \(r\) no está en el registro/);
    expect(() => ev({ condicion: "ir" })).toThrow(/es una capacidad de tipo accion/);
    try {
      ev({ todas: [f("x"), { condicion: "rompe" }] });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ErrorFlujo);
      expect((e as ErrorFlujo).codigo).toBe("condicion_fallo");
      expect((e as ErrorFlujo).message).toBe("La condición «rompe» (r.todas[1]) falló al evaluarse: se cayó la consulta");
      expect((e as ErrorFlujo).cause).toBeInstanceOf(Error);
    }
    expect(() => ev({ condicion: "rompe-raro" })).toThrow(/falló al evaluarse: texto suelto/);
  });
});
