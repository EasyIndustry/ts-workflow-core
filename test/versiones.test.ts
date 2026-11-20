import { describe, expect, it } from "vitest";
import { elegirVersion, ErrorFlujo, iniciarInstancia, ultimaVersion } from "../src/index.js";
import { definicion } from "./ayudas.js";

const codigo = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return (e as ErrorFlujo).codigo;
  }
  return null;
};

describe("versionado", () => {
  const v1 = definicion();
  const v3 = definicion({ version: 3, estadoInicial: "b" });

  it("elige por número entre varias versiones, o acepta una sola", () => {
    expect(elegirVersion([v3, v1], 1)).toBe(v1);
    expect(elegirVersion(v1, 1)).toBe(v1);
  });

  it("la última versión es la de las instancias nuevas, en su estado inicial", () => {
    expect(ultimaVersion([v1, v3]).version).toBe(3);
    expect(iniciarInstancia([v3, v1])).toEqual({ version: 3, estado: "b" });
    expect(iniciarInstancia(v1)).toEqual({ version: 1, estado: "a" });
  });

  it("falla si falta la versión, si se mezclan flujos, si una versión se repite o si no hay ninguna", () => {
    expect(() => elegirVersion([v1, v3], 2)).toThrow("La instancia usa la versión 2 de «prueba», pero solo se pasó: 1, 3.");
    expect(codigo(() => elegirVersion([v1, v3], 2))).toBe("version_inexistente");
    expect(codigo(() => elegirVersion([v1, definicion({ id: "otro", version: 2 })], 1))).toBe("versiones_mezcladas");
    expect(codigo(() => ultimaVersion([v1, definicion()]))).toBe("version_duplicada");
    expect(codigo(() => ultimaVersion([]))).toBe("sin_versiones");
  });
});
