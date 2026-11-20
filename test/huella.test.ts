import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { ErrorFlujo, huella, jsonCanonico } from "../src/index.js";
import { sha256Hex, utf8 } from "../src/huella.js";

const nodeSha = (datos: string | Uint8Array) => createHash("sha256").update(datos).digest("hex");

describe("jsonCanonico", () => {
  it("ordena las claves en todos los niveles, sin espacios y sin las claves undefined", () => {
    expect(jsonCanonico({ b: 1, a: { d: [3, { z: true, y: null }], c: "x" }, e: undefined })).toBe('{"a":{"c":"x","d":[3,{"y":null,"z":true}]},"b":1}');
  });

  it("escribe números y textos como JSON.stringify, undefined en listas como null y respeta toJSON", () => {
    expect(jsonCanonico([1.5, -0, 1e21, "a\"b\n", undefined])).toBe('[1.5,0,1e+21,"a\\"b\\n",null]');
    expect(jsonCanonico({ cuando: new Date(Date.UTC(2026, 0, 2)) })).toBe('{"cuando":"2026-01-02T00:00:00.000Z"}');
    expect(jsonCanonico("solo")).toBe('"solo"');
  });

  it("ordena las claves por unidades UTF-16 (como RFC 8785)", () => {
    expect(jsonCanonico({ "\u20ac": 1, "\r": 2, "\ud83d\ude00": 3, "1": 4, "\u0080": 5 })).toBe('{"\\r":2,"1":4,"\u0080":5,"\u20ac":1,"\ud83d\ude00":3}');
  });

  it("falla con lo que no tiene forma JSON única, diciendo dónde", () => {
    const circular: Record<string, unknown> = { a: 1 };
    circular.yo = circular;
    const casos: [unknown, string][] = [
      [undefined, "undefined no se puede pasar a JSON"],
      [{ a: [1, () => 1] }, "a[1]: una función"],
      [{ n: NaN }, "n: NaN"],
      [{ n: Infinity }, "n: Infinity"],
      [{ b: 10n }, "b: un bigint"],
      [{ s: Symbol("x") }, "s: un symbol"],
      [circular, "yo: una referencia circular"],
    ];
    for (const [valor, mensaje] of casos) {
      expect(() => jsonCanonico(valor)).toThrow(mensaje);
      try {
        huella(valor);
      } catch (e) {
        expect((e as ErrorFlujo).codigo).toBe("valor_no_serializable");
      }
    }
  });

  it("un mismo objeto repetido (sin ciclo) no es una referencia circular", () => {
    const x = { a: 1 };
    expect(jsonCanonico([x, x])).toBe('[{"a":1},{"a":1}]');
  });
});

describe("huella", () => {
  it("es el SHA-256 del JSON canónico: no depende del orden de las claves ni de los undefined", () => {
    const h = huella({ b: [1, 2], a: "x", c: undefined });
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).toBe(huella({ a: "x", b: [1, 2] }));
    expect(h).toBe(nodeSha('{"a":"x","b":[1,2]}'));
    expect(huella({ a: "x", b: [2, 1] })).not.toBe(h);
  });

  it("SHA-256: vectores conocidos", () => {
    expect(sha256Hex(utf8(""))).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(sha256Hex(utf8("abc"))).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(sha256Hex(utf8("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq"))).toBe("248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1");
  });

  it("SHA-256: coincide con node:crypto en los bordes del relleno y con varios bloques", () => {
    for (const largo of [0, 1, 55, 56, 57, 63, 64, 65, 119, 120, 127, 128, 129, 1000, 70000]) {
      const datos = Uint8Array.from({ length: largo }, (_, i) => (i * 31 + 7) & 0xff);
      expect(sha256Hex(datos), `largo ${largo}`).toBe(nodeSha(datos));
    }
  });

  it("UTF-8: acentos, emojis (pares surrogate) y surrogates sueltos (U+FFFD), como Node", () => {
    for (const texto of ["ñandú", "€ y 漢字", "😀 cara", "suelto \ud83d fin", "al revés \ude00", "al final \ud83d", "\u007f\u0080\u07ff\u0800\uffff"]) {
      expect(Buffer.from(utf8(texto)).equals(Buffer.from(texto, "utf8")), texto).toBe(true);
      expect(huella(texto)).toBe(nodeSha(JSON.stringify(texto)));
    }
  });
});
