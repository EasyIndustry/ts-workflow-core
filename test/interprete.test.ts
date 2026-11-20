import { describe, expect, it } from "vitest";
import { ErrorFlujo, evaluar, type DefinicionFlujo } from "../src/index.js";
import { ctx, definicion, f, registro } from "./ayudas.js";

const conDecision = (): DefinicionFlujo =>
  definicion({
    estados: [
      { id: "a", nombre: "Inicio" },
      { id: "b", nombre: "Medio", alEntrar: [{ efecto: "log", params: { texto: "llegó a b" } }] },
      { id: "c", nombre: "Fin", final: true, alEntrar: [{ efecto: "ping" }, { efecto: "log", params: { texto: "con firma" }, si: f("firma") }] },
      { id: "e", nombre: "Revisión" },
    ],
    decisiones: [
      { id: "d1", nombre: "¿Pagó?", ramas: [{ si: f("pago"), hacia: "c" }, { si: f("firma"), hacia: "d2" }], sino: "e" },
      { id: "d2", nombre: "¿Urgente?", ramas: [{ si: f("urgente"), hacia: "c" }], sino: "b" },
    ],
    transiciones: [
      { id: "t1", accion: "ir", desde: ["a"], hacia: "d1", efectos: [{ efecto: "log", params: { texto: "salió" } }, { efecto: "ping", si: f("nunca") }] },
      { id: "t2", accion: "cerrar", desde: ["b", "e"], hacia: "c" },
      { id: "t3", accion: "anotar", desde: "*", excepto: ["c"], sugerencias: f("firma") },
    ],
  });

describe("evaluar", () => {
  it("separa permitidas y bloqueadas, con motivos y el árbol de requisitos", () => {
    const r = evaluar(definicion(), { version: 1, estado: "b" }, ctx(), registro);
    expect(r).toMatchObject({ flujo: "prueba", version: 1, estado: "b" });
    expect(r.permitidas.map((a) => [a.accion, a.destino])).toEqual([["volver", "a"]]);
    expect(r.bloqueadas).toHaveLength(1);
    expect(r.bloqueadas[0]).toMatchObject({ accion: "ir", nombre: "Ir", transicion: "t2", desde: "b", motivos: ["Falta el pago"] });
    expect(r.bloqueadas[0]!.requisitos.cumple).toBe(false);
  });

  it("con los requisitos cumplidos la acción se permite y trae su árbol evaluado", () => {
    const r = evaluar(definicion(), { version: 1, estado: "b" }, ctx("pago"), registro);
    const ir = r.permitidas.find((a) => a.accion === "ir")!;
    expect(ir).toMatchObject({ destino: "c", cambiaEstado: true, recorrido: [], efectos: [] });
    expect(ir.requisitos?.cumple).toBe(true);
    expect(r.bloqueadas).toEqual([]);
  });

  it("resuelve decisiones encadenadas y cuenta el recorrido", () => {
    const r = evaluar(conDecision(), { version: 1, estado: "a" }, ctx("firma"), registro);
    const ir = r.permitidas.find((a) => a.accion === "ir")!;
    expect(ir.destino).toBe("b");
    expect(ir.recorrido).toEqual([
      { decision: "d1", nombre: "¿Pagó?", rama: 1, hacia: "d2", motivo: "Está la firma" },
      { decision: "d2", nombre: "¿Urgente?", rama: null, hacia: "b", motivo: "Falta urgente" },
    ]);
  });

  it("la primera rama que se cumple gana; el «sino» explica por qué no entró en ninguna", () => {
    const pago = evaluar(conDecision(), { version: 1, estado: "a" }, ctx("pago", "firma"), registro).permitidas[0]!;
    expect(pago).toMatchObject({ destino: "c", recorrido: [{ rama: 0, motivo: "Está el pago" }] });
    const nada = evaluar(conDecision(), { version: 1, estado: "a" }, ctx(), registro).permitidas[0]!;
    expect(nada).toMatchObject({ destino: "e", recorrido: [{ rama: null, motivo: "Falta el pago; falta la firma" }] });
  });

  it("efectos: los de la transición (con su «si») y después los alEntrar del destino", () => {
    const r = evaluar(conDecision(), { version: 1, estado: "a" }, ctx("pago", "firma"), registro);
    expect(r.permitidas[0]!.efectos).toEqual([
      { efecto: "log", params: { texto: "salió" }, origen: "transicion:t1" },
      { efecto: "ping", params: {}, origen: "estado:c" },
      { efecto: "log", params: { texto: "con firma" }, origen: "estado:c" },
    ]);
  });

  it("una acción sin «hacia» no cambia de estado ni dispara alEntrar; las sugerencias no bloquean", () => {
    const r = evaluar(conDecision(), { version: 1, estado: "b" }, ctx(), registro);
    const anotar = r.permitidas.find((a) => a.accion === "anotar")!;
    expect(anotar).toMatchObject({ destino: "b", cambiaEstado: false, efectos: [] });
    expect(anotar.sugerencias?.cumple).toBe(false);
    expect(anotar.requisitos).toBeUndefined();
  });

  it("desde \"*\" respeta «excepto»", () => {
    const enC = evaluar(conDecision(), { version: 1, estado: "c" }, ctx(), registro);
    expect(enC.permitidas).toEqual([]);
    expect(enC.bloqueadas).toEqual([]);
  });

  it("una acción bloqueada también trae sus sugerencias", () => {
    const def = definicion();
    def.transiciones[1] = { ...def.transiciones[1]!, sugerencias: f("firma") };
    const b = evaluar(def, { version: 1, estado: "b" }, ctx(), registro).bloqueadas[0]!;
    expect(b.sugerencias?.cumple).toBe(false);
  });

  it("usa el nombre de la transición si lo tiene, si no el del registro, si no el id", () => {
    const def = definicion({
      transiciones: [
        { id: "t1", accion: "ir", nombre: "Pasar a Medio", desde: ["a"], hacia: "b" },
        { id: "t2", accion: "desconocida", desde: ["a"], hacia: "c" },
        { id: "t3", accion: "volver", desde: ["b"], hacia: "a" },
      ],
    });
    const nombres = evaluar(def, { version: 1, estado: "a" }, ctx(), registro).permitidas.map((a) => a.nombre);
    expect(nombres).toEqual(["Pasar a Medio", "desconocida"]);
  });

  it("elige la versión de la instancia entre varias", () => {
    const v1 = definicion();
    const v2 = definicion({ version: 2, transiciones: definicion().transiciones.map((t) => (t.id === "t2" ? { ...t, requisitos: f("firma") } : t)) });
    expect(evaluar([v1, v2], { version: 1, estado: "b" }, ctx("pago"), registro).permitidas.map((a) => a.accion)).toContain("ir");
    expect(evaluar([v1, v2], { version: 2, estado: "b" }, ctx("pago"), registro).bloqueadas[0]!.motivos).toEqual(["Falta la firma"]);
  });

  it("falla si la definición no es de la versión de la instancia o si el estado no existe", () => {
    expect(() => evaluar(definicion(), { version: 2, estado: "a" }, ctx(), registro)).toThrow("La instancia usa la versión 2 de «prueba», pero solo se pasó: 1.");
    expect(() => evaluar(definicion(), { version: 1, estado: "zz" }, ctx(), registro)).toThrow("El estado «zz» no existe en la versión 1 de «prueba».");
  });

  it("no se cuelga con una definición sin validar que tiene un ciclo de decisiones", () => {
    const def = definicion({
      decisiones: [
        { id: "d1", nombre: "Uno", ramas: [{ si: f("x"), hacia: "c" }], sino: "d2" },
        { id: "d2", nombre: "Dos", ramas: [{ si: f("x"), hacia: "c" }], sino: "d1" },
      ],
      transiciones: [{ id: "t1", accion: "ir", desde: ["a"], hacia: "d1" }],
    });
    try {
      evaluar(def, { version: 1, estado: "a" }, ctx(), registro);
      expect.unreachable();
    } catch (e) {
      expect((e as ErrorFlujo).codigo).toBe("decision_sin_salida");
    }
  });
});
