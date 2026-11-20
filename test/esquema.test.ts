import { describe, expect, it } from "vitest";
import { condicionSchema, definicionJsonSchema, parsearDefinicion } from "../src/index.js";
import { definicion, f } from "./ayudas.js";

describe("schema de la definición", () => {
  it("acepta una definición completa, con decisiones, efectos y metadatos", () => {
    const r = parsearDefinicion(
      definicion({
        descripcion: "x",
        metadatos: { posiciones: { a: [0, 0] } },
        decisiones: [{ id: "d", nombre: "¿Pagó?", ramas: [{ si: f("pago"), hacia: "c" }], sino: "b" }],
        estados: [
          { id: "a", nombre: "Inicio", descripcion: "arranque" },
          { id: "b", nombre: "Medio", alEntrar: [{ efecto: "log", params: { texto: "hola" }, si: f("firma") }] },
          { id: "c", nombre: "Fin", final: true },
        ],
      }),
    );
    expect(r.success).toBe(true);
  });

  it("acepta las cinco formas de condición, anidadas", () => {
    const c = { todas: [f("a"), { alguna: [f("b"), { no: f("c") }] }, { si: f("d"), entonces: f("e"), mensaje: "x" }] };
    expect(condicionSchema.safeParse(c).success).toBe(true);
  });

  it("rechaza listas vacías, claves desconocidas e ids con espacios, con mensajes en castellano", () => {
    const r = parsearDefinicion({ ...definicion(), estados: [], extra: 1, estadoInicial: "con espacio" });
    expect(r.success).toBe(false);
    const mensajes = r.error!.issues.map((i) => i.message).join(" | ");
    expect(mensajes).toMatch(/Llave desconocida/);
    expect(mensajes).toMatch(/solo letras, números/);
    expect(mensajes).toMatch(/elementos/);
  });

  it("rechaza una condición vacía o con dos formas a la vez", () => {
    expect(condicionSchema.safeParse({ todas: [] }).success).toBe(false);
    expect(condicionSchema.safeParse({ condicion: "x", todas: [f("a")] }).success).toBe(false);
    expect(condicionSchema.safeParse({}).success).toBe(false);
  });

  it("rechaza versiones que no son enteros positivos", () => {
    expect(parsearDefinicion(definicion({ version: 0 })).success).toBe(false);
    expect(parsearDefinicion(definicion({ version: 1.5 })).success).toBe(false);
  });

  it("exporta un JSON Schema serializable, con la condición recursiva en $defs", () => {
    const schema = definicionJsonSchema() as Record<string, unknown>;
    const texto = JSON.stringify(schema);
    expect(schema.type).toBe("object");
    expect(schema.required).toEqual(expect.arrayContaining(["id", "version", "estados", "transiciones", "estadoInicial"]));
    expect(texto).toContain("$defs");
    expect(texto).toContain('"entonces"');
    expect(JSON.parse(texto)).toEqual(schema);
  });
});
