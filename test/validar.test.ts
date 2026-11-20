import { describe, expect, it } from "vitest";
import { validarDefinicion, type DefinicionFlujo } from "../src/index.js";
import { definicion, f, registro } from "./ayudas.js";

const codigos = (r: ReturnType<typeof validarDefinicion>) => r.errores.map((e) => e.codigo);

describe("validarDefinicion: grafo", () => {
  it("una definición sana es válida, sin errores ni avisos, y devuelve la definición parseada", () => {
    const r = validarDefinicion(definicion(), registro);
    expect(r).toMatchObject({ valido: true, errores: [], avisos: [] });
    expect(r.definicion?.id).toBe("prueba");
  });

  it("un error de schema corta ahí, con la ruta del problema", () => {
    const r = validarDefinicion({ ...definicion(), transiciones: [{ id: "t", accion: "ir", desde: [] }] });
    expect(r.valido).toBe(false);
    expect(r.definicion).toBeUndefined();
    expect(r.errores[0]).toMatchObject({ codigo: "esquema", ruta: "transiciones[0].desde" });
    expect(validarDefinicion("no es un objeto").errores[0]!.codigo).toBe("esquema");
  });

  it("ids repetidos entre estados y decisiones, y entre transiciones", () => {
    const r = validarDefinicion(
      definicion({
        decisiones: [{ id: "b", nombre: "Repetida", ramas: [{ si: f("x"), hacia: "c" }], sino: "c" }],
        transiciones: [...definicion().transiciones, { id: "t1", accion: "cerrar", desde: ["a"], hacia: "c" }],
      }),
    );
    expect(codigos(r)).toEqual(["id_duplicado", "id_duplicado"]);
    expect(r.errores[0]).toMatchObject({ ruta: "decisiones[0]" });
    expect(r.errores[1]!.mensaje).toBe("Hay dos transiciones con el id «t1».");
  });

  it("referencias que no existen, o que apuntan a una decisión donde va un estado", () => {
    const r = validarDefinicion(
      definicion({
        estadoInicial: "d",
        decisiones: [{ id: "d", nombre: "¿Algo?", ramas: [{ si: f("x"), hacia: "zz" }], sino: "yy" }],
        transiciones: [
          { id: "t1", accion: "ir", desde: ["a", "nada"], hacia: "fantasma" },
          { id: "t2", accion: "volver", desde: "*", excepto: ["otro"], hacia: "a" },
        ],
      }),
    );
    expect(r.errores.map((e) => [e.codigo, e.ruta])).toEqual([
      ["no_es_estado", "estadoInicial"],
      ["referencia_inexistente", "transiciones[0].desde[1]"],
      ["referencia_inexistente", "transiciones[0].hacia"],
      ["referencia_inexistente", "transiciones[1].excepto[0]"],
      ["referencia_inexistente", "decisiones[0].ramas[0].hacia"],
      ["referencia_inexistente", "decisiones[0].sino"],
    ]);
    expect(r.errores[0]!.mensaje).toBe("El estado inicial tiene que ser un estado y «d» es una decisión.");
    expect(r.errores[1]!.mensaje).toBe("«desde» de «t1»: el estado «nada» no existe.");
    // Con referencias rotas no se analiza el grafo (sería ruido).
    expect(codigos(r)).not.toContain("estado_inalcanzable");
  });

  it("avisa de un «excepto» sin desde \"*\"", () => {
    const def = definicion();
    def.transiciones[0] = { ...def.transiciones[0]!, excepto: ["b"] };
    const r = validarDefinicion(def);
    expect(r.valido).toBe(true);
    expect(r.avisos.map((a) => a.codigo)).toEqual(["excepto_sin_comodin"]);
  });

  it("ciclo entre decisiones", () => {
    const r = validarDefinicion(
      definicion({
        decisiones: [
          { id: "d1", nombre: "Uno", ramas: [{ si: f("x"), hacia: "d2" }], sino: "c" },
          { id: "d2", nombre: "Dos", ramas: [{ si: f("y"), hacia: "c" }], sino: "d1" },
        ],
        transiciones: [...definicion().transiciones.filter((t) => t.id !== "t1"), { id: "t1", accion: "ir", desde: ["a"], hacia: "d1" }],
      }),
    );
    expect(codigos(r)).toContain("ciclo_de_decisiones");
    expect(r.errores.find((e) => e.codigo === "ciclo_de_decisiones")!.mensaje).toBe("Las decisiones forman un ciclo: «Uno» → «Dos» → «Uno».");
  });

  it("transición ambigua: la misma acción dos veces desde un estado, también vía \"*\"", () => {
    const r = validarDefinicion(definicion({ transiciones: [...definicion().transiciones, { id: "t4", accion: "volver", desde: "*", excepto: ["a"], hacia: "a" }] }));
    expect(codigos(r)).toEqual(["transicion_ambigua"]);
    expect(r.errores[0]!.mensaje).toBe("Desde «Medio» la acción «volver» tiene 2 transiciones («t3» y «t4»). Usá una sola con un nodo de decisión.");
  });

  it("estado inalcanzable desde el inicial", () => {
    const def = definicion({ estados: [...definicion().estados, { id: "isla", nombre: "Isla", final: true }] });
    const r = validarDefinicion(def);
    expect(r.errores).toEqual([{ codigo: "estado_inalcanzable", mensaje: "No se llega nunca a «Isla» desde el estado inicial.", ruta: "estados[3]" }]);
  });

  it("callejón: un estado no final desde el que no se llega a un final", () => {
    const def = definicion({
      estados: [...definicion().estados, { id: "pozo", nombre: "Pozo" }],
      transiciones: [...definicion().transiciones, { id: "caer", accion: "cerrar", desde: ["a"], hacia: "pozo" }, { id: "nota", accion: "anotar", desde: ["pozo"] }],
    });
    const r = validarDefinicion(def);
    expect(r.errores).toEqual([{ codigo: "callejon", mensaje: "Desde «Pozo» no se puede llegar a ningún estado final: es un callejón.", ruta: "estados[3]" }]);
  });

  it("sin estados finales: avisa y no controla callejones", () => {
    const r = validarDefinicion(definicion({ estados: definicion().estados.map((e) => ({ id: e.id, nombre: e.nombre })) }));
    expect(r.valido).toBe(true);
    expect(r.avisos.map((a) => a.codigo)).toEqual(["sin_estado_final"]);
  });

  it("las decisiones cuentan para alcanzar estados; una decisión sin entrada es aviso", () => {
    const def = definicion({
      estados: [...definicion().estados, { id: "e", nombre: "Extra", final: true }],
      decisiones: [
        { id: "d", nombre: "¿Pagó?", ramas: [{ si: f("pago"), hacia: "c" }], sino: "e" },
        { id: "suelta", nombre: "Suelta", ramas: [{ si: f("x"), hacia: "c" }], sino: "c" },
      ],
      transiciones: [
        { id: "t1", accion: "ir", desde: ["a"], hacia: "b" },
        { id: "t2", accion: "ir", desde: ["b"], hacia: "d" },
      ],
    });
    const r = validarDefinicion(def, registro);
    expect(r.valido).toBe(true);
    expect(r.avisos).toEqual([{ codigo: "decision_inalcanzable", mensaje: "Ninguna transición alcanzable pasa por la decisión «Suelta».", ruta: "decisiones[1]" }]);
  });
});

describe("validarDefinicion: capacidades del registro", () => {
  const conTodo = (): DefinicionFlujo =>
    definicion({
      estados: [
        { id: "a", nombre: "Inicio", alEntrar: [{ efecto: "fantasma" }] },
        { id: "b", nombre: "Medio" },
        { id: "c", nombre: "Fin", final: true },
      ],
      decisiones: [{ id: "d", nombre: "¿?", ramas: [{ si: { condicion: "ir" }, hacia: "c" }], sino: "c" }],
      transiciones: [
        { id: "t1", accion: "flag", desde: ["a"], hacia: "b" },
        {
          id: "t2",
          accion: "noexiste",
          desde: ["b"],
          hacia: "d",
          requisitos: { todas: [{ condicion: "flag", params: { nombre: 3 } }, { alguna: [{ no: { condicion: "flag" } }] }] },
          sugerencias: { si: { condicion: "otra" }, entonces: f("pago") },
          efectos: [{ efecto: "log", params: { texto: "x", sobra: true } }, { efecto: "ping", si: { condicion: "log" } }],
        },
      ],
    });

  it("reporta capacidades desconocidas, de otro tipo y params inválidos, con su ruta", () => {
    const r = validarDefinicion(conTodo(), registro);
    expect(r.errores.map((e) => [e.codigo, e.ruta])).toEqual([
      ["capacidad_desconocida", "estados[0].alEntrar[0]"],
      ["tipo_de_capacidad", "decisiones[0].ramas[0].si"],
      ["tipo_de_capacidad", "transiciones[0].accion"],
      ["capacidad_desconocida", "transiciones[1].accion"],
      ["params_invalidos", "transiciones[1].requisitos.todas[0].params"],
      ["params_invalidos", "transiciones[1].requisitos.todas[1].alguna[0].no.params"],
      ["capacidad_desconocida", "transiciones[1].sugerencias.si"],
      ["params_invalidos", "transiciones[1].efectos[0].params"],
      ["tipo_de_capacidad", "transiciones[1].efectos[1].si"],
    ]);
    const mensajes = r.errores.map((e) => e.mensaje);
    expect(mensajes).toContain("El efecto «fantasma» no está en el registro.");
    expect(mensajes).toContain("«ir» es una acción, no una condición.");
    expect(mensajes).toContain("«flag» es una condición, no una acción.");
    expect(mensajes).toContain("Bandera: params.nombre: falta y es obligatorio".replace("Bandera", "«Bandera»"));
    expect(mensajes).toContain("«Log»: params.sobra: no es un parámetro conocido");
  });

  it("acepta la lista de descriptores (el JSON que recibe el editor) en lugar del registro", () => {
    const desdeJson = JSON.parse(JSON.stringify(registro.descriptores()));
    expect(validarDefinicion(conTodo(), desdeJson).errores).toEqual(validarDefinicion(conTodo(), registro).errores);
  });

  it("usa el validador de JSON Schema que le pasen", () => {
    const vistos: unknown[] = [];
    const r = validarDefinicion(definicion(), registro, {
      validarEsquema: (valor) => {
        vistos.push(valor);
        return ["no me gusta"];
      },
    });
    expect(vistos).toEqual([{ nombre: "pago" }]);
    expect(r.errores).toEqual([{ codigo: "params_invalidos", mensaje: "«Bandera»: no me gusta", ruta: "transiciones[1].requisitos.params" }]);
  });

  it("sin registro no controla capacidades", () => {
    expect(validarDefinicion(conTodo()).valido).toBe(true);
  });
});
