import { describe, expect, it } from "vitest";
import { validarJsonSchema } from "../src/index.js";
import { rotuloDeValor } from "../src/jsonSchema.js";

describe("subconjunto de JSON Schema", () => {
  const params = {
    type: "object",
    properties: {
      momento: { type: "string", enum: ["INGRESO", "FUNCIONANDO"] },
      cantidad: { type: "integer", minimum: 1, maximum: 3 },
      codigos: { type: "array", items: { type: "string", pattern: "^PZ" }, minItems: 1, maxItems: 2 },
      nota: { type: ["string", "null"], minLength: 2, maxLength: 4 },
      modo: { const: "fijo" },
      color: { oneOf: [{ const: "rojo", title: "Rojo" }, { const: "azul", title: "Azul" }] },
      libre: { anyOf: [{ type: "number" }, { type: "boolean" }] },
      extra: { type: "object", additionalProperties: { type: "number" } },
    },
    required: ["momento"],
    additionalProperties: false,
  };

  it("acepta un valor que cumple", () => {
    const ok = { momento: "INGRESO", cantidad: 2, codigos: ["PZ-1"], nota: null, modo: "fijo", color: "azul", libre: true, extra: { a: 1 } };
    expect(validarJsonSchema(ok, params)).toEqual([]);
  });

  it("reporta cada problema con su ruta, en castellano", () => {
    const mal = { cantidad: 9, codigos: ["XX", "PZ", "PZ"], nota: "x", modo: "otro", color: "verde", libre: "no", extra: { a: "uno" }, sobra: 1 };
    const problemas = validarJsonSchema(mal, params);
    expect(problemas).toEqual(
      expect.arrayContaining([
        "params.momento: falta y es obligatorio",
        "params.cantidad: tiene que ser como mucho 3",
        "params.codigos: tiene que tener como mucho 2 elementos",
        "params.codigos[0]: no tiene el formato esperado",
        "params.nota: tiene que tener al menos 2 caracteres",
        'params.modo: tiene que ser "fijo"',
        'params.color: "verde" no es uno de los valores permitidos ("rojo", "azul")',
        "params.libre: no cumple ninguna de las opciones permitidas",
        "params.extra.a: se esperaba un número y llegó \"uno\"",
        "params.sobra: no es un parámetro conocido",
      ]),
    );
  });

  it("controla tipos, mínimos y enum", () => {
    expect(validarJsonSchema("x", { type: "object" })).toEqual(['params: se esperaba un objeto y llegó "x"']);
    expect(validarJsonSchema([], { type: "object" }, "p")).toEqual(["p: se esperaba un objeto y llegó una lista"]);
    expect(validarJsonSchema(undefined, { type: ["string", "integer"] })).toEqual(["params: se esperaba un texto o un número entero y llegó nada"]);
    expect(validarJsonSchema({}, { type: "array" })).toEqual(["params: se esperaba una lista y llegó un objeto"]);
    expect(validarJsonSchema(1, { type: "boolean" })[0]).toMatch(/verdadero o falso/);
    expect(validarJsonSchema(1, { type: "null" })[0]).toMatch(/null/);
    expect(validarJsonSchema(1, { type: "raro" })).toEqual([]);
    expect(validarJsonSchema(0, { type: "number", minimum: 1 })).toEqual(["params: tiene que ser al menos 1"]);
    expect(validarJsonSchema([], { type: "array", minItems: 1 })).toEqual(["params: tiene que tener al menos 1 elementos"]);
    expect(validarJsonSchema("abcde", { type: "string", maxLength: 4 })).toEqual(["params: tiene que tener como mucho 4 caracteres"]);
    expect(validarJsonSchema("Z", { enum: ["A"] })).toEqual(['params: "Z" no es uno de los valores permitidos ("A")']);
    expect(validarJsonSchema(Number.NaN, { type: "number" })).toHaveLength(1);
  });

  it("ignora las palabras que no conoce", () => {
    expect(validarJsonSchema("x", { $ref: "#/otra", format: "email", allOf: [{ type: "number" }] })).toEqual([]);
  });

  it("da el rótulo de un valor desde oneOf/anyOf", () => {
    const esquema = { oneOf: [{ const: "FUNCIONANDO", title: "Funcionando" }, { const: "OTRO" }, "basura"] };
    expect(rotuloDeValor(esquema, "FUNCIONANDO")).toBe("Funcionando");
    expect(rotuloDeValor(esquema, "OTRO")).toBeNull();
    expect(rotuloDeValor({ anyOf: [{ const: 1, title: "Uno" }] }, 1)).toBe("Uno");
    expect(rotuloDeValor({ type: "string" }, "x")).toBeNull();
    expect(rotuloDeValor(undefined, "x")).toBeNull();
  });
});
