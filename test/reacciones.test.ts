import { describe, expect, it } from "vitest";
import { compararCapacidades, compararFlujos, crearRegistro, ErrorFlujo, reaccionar, suscripciones, validarDefinicion, type DefinicionFlujo, type Reaccion } from "../src/index.js";
import { ctx, definicion, f, registro as base, type Ctx } from "./ayudas.js";

const registro = crearRegistro<Ctx>([
  {
    nombre: "todo",
    capacidades: [
      ...base.descriptores("accion").map((d) => ({ ...d, tipo: "accion" as const })),
      ...base.descriptores("efecto").map((d) => ({ ...d, tipo: "efecto" as const })),
      { id: "flag", nombre: "Bandera", tipo: "condicion", texto: { cumple: "Está {nombre}", noCumple: "Falta {nombre}" }, evaluar: (p, c) => c.flags[String(p.nombre)] === true },
      { id: "sin-texto", nombre: "Sin texto", tipo: "condicion", evaluar: () => false },
      {
        id: "dato.cambio",
        nombre: "Cambió un dato",
        tipo: "evento",
        schemaEntrada: { type: "object", properties: { tabla: { type: "string" } }, required: ["tabla"], additionalProperties: false },
      },
      { id: "reloj.tick", nombre: "Tick", tipo: "evento" },
    ],
  },
]);

const ev = { evento: "dato.cambio", params: { tabla: "pagos" } };
const reaccion = (cambios: Partial<Reaccion> = {}): Reaccion => ({ id: "r1", evento: "dato.cambio", params: { tabla: "pagos" }, desde: ["b"], transicion: "t2", ...cambios });
const con = (...reacciones: Reaccion[]): DefinicionFlujo => definicion({ reacciones });
const codigos = (d: unknown) => validarDefinicion(d, registro).errores.map((e) => e.codigo);

describe("capacidad de tipo evento", () => {
  it("se registra, se lista por tipo y viaja sin funciones", () => {
    expect(registro.descriptores("evento").map((d) => d.id)).toEqual(["dato.cambio", "reloj.tick"]);
  });

  it("una acción usada como evento es un error de tipo", () => {
    expect(codigos(con(reaccion({ evento: "ir", params: {} })))).toEqual(["tipo_de_capacidad"]);
  });

  it("un evento desconocido y params inválidos se reportan", () => {
    expect(codigos(con(reaccion({ evento: "no.existe" })))).toEqual(["capacidad_desconocida"]);
    expect(codigos(con(reaccion({ params: { otra: 1 } })))).toContain("params_invalidos");
  });

  it("compararCapacidades ve un evento quitado", () => {
    const sin = crearRegistro<Ctx>([{ nombre: "x", capacidades: registro.descriptores().filter((d) => d.id !== "reloj.tick" && d.tipo !== "condicion") as never }]);
    const con2 = crearRegistro<Ctx>([{ nombre: "x", capacidades: registro.descriptores().filter((d) => d.tipo !== "condicion") as never }]);
    expect(compararCapacidades(con2, sin).cambios.map((c) => c.codigo)).toEqual(["capacidad_quitada"]);
  });
});

describe("validación de reacciones", () => {
  it("una definición sin reacciones sigue valiendo, y una con reacciones sanas también", () => {
    expect(codigos(definicion())).toEqual([]);
    expect(codigos(con(reaccion()))).toEqual([]);
  });

  it("referencias: estados, transición e ids repetidos", () => {
    expect(codigos(con(reaccion({ desde: ["nada"] })))).toContain("referencia_inexistente");
    expect(codigos(con(reaccion({ desde: "*", excepto: ["nada"] })))).toContain("referencia_inexistente");
    expect(codigos(con(reaccion({ transicion: "nada" })))).toEqual(["referencia_inexistente"]);
    expect(codigos(con(reaccion(), reaccion({ params: { tabla: "otra" } })))).toEqual(["id_duplicado"]);
  });

  it("avisa de un excepto sin comodín", () => {
    const r = validarDefinicion(con(reaccion({ excepto: ["a"] })), registro);
    expect(r.avisos.map((a) => a.codigo)).toContain("excepto_sin_comodin");
  });

  it("una reacción tiene que hacer algo", () => {
    const { transicion: _t, ...sinNada } = reaccion();
    expect(codigos(con(sinNada))).toEqual(["reaccion_vacia"]);
    expect(codigos(con({ ...sinNada, efectos: [] }))).toEqual(["reaccion_vacia"]);
    expect(codigos(con({ ...sinNada, efectos: [{ efecto: "ping" }] }))).toEqual([]);
  });

  it("no puede escuchar en un estado desde el que su transición no sale", () => {
    expect(codigos(con(reaccion({ desde: ["a", "b"] })))).toEqual(["reaccion_fuera_de_transicion"]);
  });

  it("el mismo evento con los mismos params, dos veces en un estado, es ambiguo; con otros params no", () => {
    const { transicion: _t, ...sin } = reaccion({ efectos: [{ efecto: "ping" }] });
    expect(codigos(con(sin, { ...sin, id: "r2" }))).toEqual(["reaccion_ambigua"]);
    expect(codigos(con(sin, { ...sin, id: "r2", params: { tabla: "otra" } }))).toEqual([]);
  });

  it("valida los efectos y la condición de la reacción contra el registro", () => {
    expect(codigos(con(reaccion({ si: { condicion: "no.existe" } })))).toEqual(["capacidad_desconocida"]);
    expect(codigos(con(reaccion({ efectos: [{ efecto: "log", params: {} }] })))).toContain("params_invalidos");
  });
});

describe("suscripciones", () => {
  it("lista cada ocurrencia una vez, entre versiones y sin importar el orden de las claves", () => {
    const v1 = con(reaccion({ params: { tabla: "pagos" } }));
    const v2 = { ...con(reaccion({ id: "r9", params: { tabla: "pagos" } }), reaccion({ id: "r2", evento: "reloj.tick", params: {} })), version: 2 };
    const s = suscripciones([v1, v2]);
    expect(s.map((x) => x.evento).sort()).toEqual(["dato.cambio", "reloj.tick"]);
    expect(s.every((x) => /^[0-9a-f]{64}$/.test(x.clave))).toBe(true);
  });

  it("acepta una sola definición, sin reacciones da vacío y sin params usa {}", () => {
    expect(suscripciones(definicion())).toEqual([]);
    const { params: _p, ...sinParams } = reaccion({ evento: "reloj.tick" });
    expect(suscripciones(con(sinParams))[0]).toMatchObject({ evento: "reloj.tick", params: {} });
  });

  it("la clave es estable: no depende del orden de las claves de params", () => {
    const a = suscripciones(con(reaccion({ params: { x: 1, y: 2 } })))[0]!;
    const b = suscripciones(con(reaccion({ params: { y: 2, x: 1 } })))[0]!;
    expect(a.clave).toBe(b.clave);
  });
});

describe("reaccionar", () => {
  const b = { version: 1, estado: "b" };

  it("sin reacción en ese estado o para ese evento devuelve null", () => {
    expect(reaccionar(con(reaccion()), { version: 1, estado: "a" }, ev, ctx("pago"), registro)).toBeNull();
    expect(reaccionar(con(reaccion()), b, { evento: "dato.cambio", params: { tabla: "otra" } }, ctx("pago"), registro)).toBeNull();
    expect(reaccionar(definicion(), b, ev, ctx(), registro)).toBeNull();
  });

  it("los params se comparan sin importar el orden de las claves; sin params es lo mismo que {}", () => {
    const d = con(reaccion({ params: { x: 1, y: 2 }, evento: "reloj.tick" }));
    expect(reaccionar(d, b, { evento: "reloj.tick", params: { y: 2, x: 1 } }, ctx("pago"), registro)?.aplica).toBe(true);
    const { params: _p, ...sinParams } = reaccion({ evento: "reloj.tick" });
    expect(reaccionar(con(sinParams), b, { evento: "reloj.tick" }, ctx("pago"), registro)?.aplica).toBe(true);
  });

  it("intenta la transición: destino y efectos en orden (reacción, transición, alEntrar)", () => {
    const d = definicion({
      estados: [{ id: "a", nombre: "A" }, { id: "b", nombre: "B" }, { id: "c", nombre: "C", final: true, alEntrar: [{ efecto: "ping", params: { n: 3 } }] }],
      transiciones: [
        { id: "t1", accion: "ir", desde: ["a"], hacia: "b" },
        { id: "t2", accion: "ir", desde: ["b"], hacia: "c", requisitos: f("pago"), efectos: [{ efecto: "ping", params: { n: 2 } }] },
      ],
      reacciones: [reaccion({ efectos: [{ efecto: "ping", params: { n: 1 } }, { efecto: "ping", params: { n: 9 }, si: f("nunca") }] })],
    });
    const plan = reaccionar(d, b, ev, ctx("pago"), registro)!;
    expect(plan).toMatchObject({ flujo: "prueba", version: 1, estado: "b", reaccion: "r1", aplica: true, transicion: "t2", accion: "ir", destino: "c", cambiaEstado: true, motivos: [] });
    expect(plan.efectos.map((e) => [e.params.n, e.origen])).toEqual([[1, "reaccion:r1"], [2, "transicion:t2"], [3, "estado:c"]]);
  });

  it("no habilita: si la transición está bloqueada no aplica y no produce efectos", () => {
    const plan = reaccionar(con(reaccion({ efectos: [{ efecto: "ping" }] })), b, ev, ctx(), registro)!;
    expect(plan).toMatchObject({ aplica: false, transicion: "t2", accion: "ir", destino: "b", cambiaEstado: false, efectos: [] });
    expect(plan.motivos).toEqual(["Falta pago"]);
  });

  it("si la condición de la reacción no se cumple, no aplica y dice por qué", () => {
    const plan = reaccionar(con(reaccion({ si: f("firma") })), b, ev, ctx("pago"), registro)!;
    expect(plan).toMatchObject({ aplica: false, motivos: ["Falta firma"], efectos: [] });
    expect(plan.transicion).toBeUndefined();
  });

  it("solo efectos: aplica sin cambiar de estado", () => {
    const { transicion: _t, ...solo } = reaccion({ efectos: [{ efecto: "ping" }] });
    expect(reaccionar(con(solo), b, ev, ctx(), registro)).toMatchObject({ aplica: true, destino: "b", cambiaEstado: false, efectos: [{ efecto: "ping", params: {}, origen: "reaccion:r1" }] });
  });

  it("una definición sin validar con una transición que no sale de ahí no aplica", () => {
    const plan = reaccionar(con(reaccion({ transicion: "t1" })), b, ev, ctx("pago"), registro)!;
    expect(plan).toMatchObject({ aplica: false, transicion: "t1" });
    expect(plan.motivos[0]).toContain("no se puede hacer");
  });

  it("usa la versión de la instancia y falla si no está o si el estado no existe", () => {
    const v1 = con(reaccion());
    const v2 = { ...definicion(), version: 2 };
    expect(reaccionar([v1, v2], b, ev, ctx("pago"), registro)?.version).toBe(1);
    expect(reaccionar([v1, v2], { version: 2, estado: "b" }, ev, ctx("pago"), registro)).toBeNull();
    expect(() => reaccionar(v1, { version: 7, estado: "b" }, ev, ctx(), registro)).toThrow(ErrorFlujo);
    expect(() => reaccionar(v1, { version: 1, estado: "nada" }, ev, ctx(), registro)).toThrow(ErrorFlujo);
  });

  it("no modifica la definición ni el contexto", () => {
    const d = con(reaccion());
    const c = ctx("pago");
    const copia = JSON.stringify([d, c]);
    reaccionar(d, b, ev, c, registro);
    expect(JSON.stringify([d, c])).toBe(copia);
  });
});

describe("compararFlujos con reacciones", () => {
  const cod = (a: DefinicionFlujo, d: DefinicionFlujo) => compararFlujos(a, d).cambios.map((c) => `${c.nivel} ${c.codigo}`);
  const { transicion: _t, ...soloEfectos } = reaccion({ efectos: [{ efecto: "ping" }] });

  it("agregar: rompe si mueve de estado, compatible si solo produce efectos", () => {
    expect(cod(definicion(), con(reaccion()))).toEqual(["rompe reaccion_agregada"]);
    expect(cod(definicion(), con(soloEfectos))).toEqual(["compatible reaccion_agregada"]);
  });

  it("quitar rompe", () => {
    expect(cod(con(reaccion()), definicion())).toEqual(["rompe reaccion_quitada"]);
  });

  it("cambiar cuándo dispara rompe; cambiar efectos o un mensaje, no", () => {
    expect(cod(con(reaccion()), con(reaccion({ params: { tabla: "otra" } })))).toEqual(["rompe reaccion_modificada"]);
    expect(cod(con(reaccion()), con(reaccion({ desde: "*", excepto: ["a", "c"], si: f("pago") })))).toEqual(["rompe reaccion_modificada"]);
    expect(cod(con(soloEfectos), con({ ...soloEfectos, efectos: [{ efecto: "log", params: { texto: "x" } }] }))).toEqual(["compatible efectos_cambiados"]);
    expect(cod(con(reaccion({ si: f("pago", "uno") })), con(reaccion({ si: f("pago", "otro") })))).toEqual([]);
  });
});
