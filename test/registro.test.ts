import { describe, expect, it } from "vitest";
import { crearRegistro, ErrorFlujo, type Capacidad } from "../src/index.js";
import { registro } from "./ayudas.js";

const accion = (id: string): Capacidad => ({ id, nombre: id, tipo: "accion" });

describe("registro de capacidades", () => {
  it("encuentra por id y lista descriptores sin la función evaluar, filtrando por tipo", () => {
    expect(registro.obtener("flag")?.tipo).toBe("condicion");
    expect(registro.obtener("nada")).toBeUndefined();
    const condiciones = registro.descriptores("condicion");
    expect(condiciones.map((d) => d.id)).toEqual(["flag", "sin-texto", "rompe", "rompe-raro"]);
    expect(condiciones.every((d) => !("evaluar" in d))).toBe(true);
    expect(registro.descriptores()).toHaveLength(10);
    expect(registro.descriptores("efecto").map((d) => d.id)).toEqual(["log", "ping"]);
  });

  it("los descriptores viajan como JSON sin perder nada", () => {
    const d = registro.descriptores();
    expect(JSON.parse(JSON.stringify(d))).toEqual(d);
    const flag = d.find((x) => x.id === "flag")!;
    expect(flag.texto?.noCumple).toBe("Falta {nombre}");
    expect(flag.schemaEntrada).toBeDefined();
  });

  it("conserva descripción y grupo", () => {
    const r = crearRegistro([{ nombre: "p", capacidades: [{ id: "x", nombre: "X", tipo: "accion", descripcion: "hace x", grupo: "G" }] }]);
    expect(r.descriptores()[0]).toEqual({ id: "x", nombre: "X", tipo: "accion", descripcion: "hace x", grupo: "G" });
  });

  it("falla si dos proveedores declaran el mismo id, y nombra a los dos", () => {
    const crear = () => crearRegistro([{ nombre: "uno", capacidades: [accion("x")] }, { nombre: "dos", capacidades: [accion("x")] }]);
    expect(crear).toThrow(ErrorFlujo);
    expect(crear).toThrow(/«x» está dos veces: en «uno» y en «dos»/);
  });

  it.each([
    [{ id: "", nombre: "X", tipo: "accion" }, /sin id/],
    [{ id: "x", nombre: " ", tipo: "accion" }, /no tiene nombre/],
    [{ id: "x", nombre: "X", tipo: "regla" }, /tipo desconocido/],
    [{ id: "x", nombre: "X", tipo: "condicion" }, /no tiene la función evaluar/],
  ])("falla con una capacidad mal declarada: %o", (capacidad, mensaje) => {
    const crear = () => crearRegistro([{ nombre: "p", capacidades: [capacidad as unknown as Capacidad] }]);
    expect(crear).toThrow(mensaje);
    try {
      crear();
    } catch (e) {
      expect((e as ErrorFlujo).codigo).toBe("registro_invalido");
    }
  });
});
