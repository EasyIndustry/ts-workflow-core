import { describe, expect, it, vi } from "vitest";
import { compararFlujos, ErrorFlujo, huella, verificarReferencias, type DefinicionFlujo, type Referencia, type Revisionado } from "../src/index.js";
import { formularioV1, formularioV2 } from "../ejemplos/taller/flujos.js";
import { definicion } from "./ayudas.js";

const rev = <T>(clave: string, revision: number, estado: Revisionado<T>["estado"], valor: T): Revisionado<T> => ({ clave, revision, estado, valor });

describe("verificarReferencias", () => {
  // La vigente (v2) solo le cambia el nombre a la v1: pasar de la v1 es compatible. El borrador (v3) suma una
  // transición que la vigente no tiene: «pasar» del borrador a la vigente la quita, y eso rompe.
  const v1 = definicion();
  const v2 = definicion({ version: 2, nombre: "Prueba renombrada" });
  const v3 = definicion({ version: 3, transiciones: [...v1.transiciones, { id: "t4", accion: "anotar", desde: ["a"] }] });
  const catalogo: Revisionado<DefinicionFlujo>[] = [
    rev("prueba", 1, "obsoleta", v1),
    rev("prueba", 2, "vigente", v2),
    rev("prueba", 4, "borrador", v3),
    rev("formulario-conformidad", 1, "obsoleta", formularioV1),
    rev("formulario-conformidad", 2, "vigente", formularioV2),
    rev("sin-vigente", 1, "obsoleta", v1),
  ];

  it("separa vigentes, actualizables, que rompen y huérfanas, en el orden de las referencias", () => {
    const refs: Referencia[] = [
      { clave: "prueba", revision: 2 },
      { clave: "prueba", revision: 1 },
      { clave: "prueba", revision: 4 },
      { clave: "formulario-conformidad", revision: 2 },
      { clave: "formulario-conformidad", revision: 1 },
      { clave: "prueba", revision: 9 },
      { clave: "otra", revision: 1 },
      { clave: "sin-vigente", revision: 1 },
    ];
    const r = verificarReferencias(refs, catalogo, compararFlujos);
    expect(r.vigentes.map((x) => x.referencia)).toEqual([refs[0], refs[3]]);
    expect(r.vigentes[0]!.actual.valor).toBe(v2);
    expect(r.actualizables).toHaveLength(1);
    expect(r.actualizables[0]).toMatchObject({ referencia: refs[1], actual: { revision: 1 }, vigente: { revision: 2 }, cambios: [{ codigo: "datos_cambiados" }] });
    // Un borrador también se compara contra la vigente. Al formulario viejo le falta la firma que pide el vigente.
    expect(r.rompen.map((x) => [x.referencia.clave, x.referencia.revision, x.vigente.revision, x.cambios.map((c) => c.codigo)])).toEqual([
      ["prueba", 4, 2, ["datos_cambiados", "transicion_quitada"]],
      ["formulario-conformidad", 1, 2, ["requisitos_endurecidos"]],
    ]);
    expect(r.huerfanas).toEqual([
      { referencia: refs[5], motivo: "La revisión 9 de «prueba» no está en el catálogo." },
      { referencia: refs[6], motivo: "«otra» no está en el catálogo." },
      { referencia: refs[7], motivo: "«sin-vigente» no tiene ninguna revisión vigente." },
    ]);
  });

  it("acepta un comparador que devuelve solo si es compatible, y compara cada par una sola vez", () => {
    const comparar = vi.fn((a: string, b: string) => a.length <= b.length);
    const textos = [rev("t", 1, "obsoleta", "ab"), rev("t", 2, "obsoleta", "abcd"), rev("t", 3, "vigente", "abc")];
    const r = verificarReferencias([{ clave: "t", revision: 1 }, { clave: "t", revision: 1 }, { clave: "t", revision: 2 }], textos, comparar);
    expect(r.actualizables.map((x) => [x.referencia.revision, x.cambios])).toEqual([[1, []], [1, []]]);
    expect(r.rompen.map((x) => x.referencia.revision)).toEqual([2]);
    expect(comparar).toHaveBeenCalledTimes(2);
  });

  it("con varias revisiones marcadas vigentes, cuenta la de número más alto", () => {
    const textos = [rev("t", 3, "vigente", "c"), rev("t", 1, "vigente", "a"), rev("t", 2, "vigente", "b")];
    const r = verificarReferencias([{ clave: "t", revision: 3 }, { clave: "t", revision: 1 }], textos, () => true);
    expect(r.vigentes.map((x) => x.referencia.revision)).toEqual([3]);
    expect(r.actualizables.map((x) => [x.referencia.revision, x.vigente.revision])).toEqual([[1, 3]]);
  });

  it("sin referencias devuelve todo vacío; la huella es opcional en el catálogo", () => {
    const conHuella = { ...rev("prueba", 2, "vigente", v2), huella: huella(v2) };
    expect(verificarReferencias([], [conHuella], compararFlujos)).toEqual({ vigentes: [], actualizables: [], rompen: [], huerfanas: [] });
  });

  it("falla si el catálogo tiene dos veces la misma revisión", () => {
    const repetido = [rev("t", 1, "vigente", "a"), rev("t", 1, "obsoleta", "b")];
    expect(() => verificarReferencias([], repetido, () => true)).toThrow("La revisión 1 de «t» está dos veces en el catálogo.");
    try {
      verificarReferencias([], repetido, () => true);
    } catch (e) {
      expect((e as ErrorFlujo).codigo).toBe("revision_duplicada");
    }
  });
});
