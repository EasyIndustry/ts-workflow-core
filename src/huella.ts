import { ErrorFlujo } from "./errores.js";

/**
 * Huella de un valor: SHA-256 de su JSON canónico. Sirve para saber si dos copias de una definición (o de cualquier dato
 * serializable) son la misma, sin importar el orden de las claves ni los campos `undefined`.
 *
 * Todo en TypeScript, síncrono y sin dependencias: ni `node:crypto` ni `crypto.subtle` (que es asíncrono), para que ande
 * igual en Node, en el navegador y dentro de la transacción de la app.
 */

/**
 * El JSON canónico de un valor: claves de los objetos ordenadas (por unidades UTF-16, como RFC 8785), sin espacios y sin
 * las claves con `undefined`. Números y textos se escriben como `JSON.stringify`. Respeta `toJSON` (por ejemplo, el de
 * `Date`). En una lista, `undefined` se escribe `null`, como en JSON.
 *
 * Falla con `ErrorFlujo` («valor_no_serializable») ante lo que no tiene una forma JSON única: funciones, símbolos,
 * `bigint`, `NaN`, `Infinity`, `undefined` en la raíz y referencias circulares.
 */
export function jsonCanonico(valor: unknown): string {
  const enCurso = new Set<object>();
  const escribir = (v: unknown, ruta: string): string | undefined => {
    if (v !== null && typeof v === "object" && typeof (v as { toJSON?: unknown }).toJSON === "function") {
      v = (v as { toJSON: (clave: string) => unknown }).toJSON("");
    }
    if (v === null) return "null";
    switch (typeof v) {
      case "undefined":
        return undefined;
      case "boolean":
      case "string":
        return JSON.stringify(v);
      case "number":
        if (!Number.isFinite(v)) throw noSerializable(ruta, String(v));
        return JSON.stringify(v);
      case "object":
        break;
      default:
        throw noSerializable(ruta, typeof v === "function" ? "una función" : `un ${typeof v}`);
    }
    const objeto = v as object;
    if (enCurso.has(objeto)) throw noSerializable(ruta, "una referencia circular");
    enCurso.add(objeto);
    let salida: string;
    if (Array.isArray(objeto)) {
      salida = `[${objeto.map((x, i) => escribir(x, `${ruta}[${i}]`) ?? "null").join(",")}]`;
    } else {
      const partes: string[] = [];
      for (const clave of Object.keys(objeto).sort()) {
        const texto = escribir((objeto as Record<string, unknown>)[clave], ruta ? `${ruta}.${clave}` : clave);
        if (texto !== undefined) partes.push(`${JSON.stringify(clave)}:${texto}`);
      }
      salida = `{${partes.join(",")}}`;
    }
    enCurso.delete(objeto);
    return salida;
  };
  const texto = escribir(valor, "");
  if (texto === undefined) throw noSerializable("", "undefined");
  return texto;
}

/** SHA-256 (en hexadecimal, 64 caracteres en minúscula) del JSON canónico del valor. Ver `jsonCanonico`. */
export function huella(valor: unknown): string {
  return sha256Hex(utf8(jsonCanonico(valor)));
}

function noSerializable(ruta: string, que: string) {
  return new ErrorFlujo("valor_no_serializable", `${ruta ? `${ruta}: ` : ""}${que} no se puede pasar a JSON, así que no tiene huella.`);
}

/** UTF-8 de un texto. Un surrogate suelto se escribe como U+FFFD, igual que `TextEncoder`. */
export function utf8(texto: string): Uint8Array {
  const bytes: number[] = [];
  for (let i = 0; i < texto.length; i++) {
    let c = texto.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) {
      const siguiente = i + 1 < texto.length ? texto.charCodeAt(i + 1) : 0;
      if (siguiente >= 0xdc00 && siguiente <= 0xdfff) {
        c = 0x10000 + ((c - 0xd800) << 10) + (siguiente - 0xdc00);
        i++;
      } else c = 0xfffd;
    } else if (c >= 0xdc00 && c <= 0xdfff) c = 0xfffd;

    if (c < 0x80) bytes.push(c);
    else if (c < 0x800) bytes.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    else if (c < 0x10000) bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    else bytes.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 0x3f), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
  }
  return Uint8Array.from(bytes);
}

const K = Uint32Array.from([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

/** SHA-256 (FIPS 180-4) de unos bytes, en hexadecimal. */
export function sha256Hex(datos: Uint8Array): string {
  // Relleno: un bit 1, ceros y el largo en bits (64 bits, big endian) hasta completar bloques de 64 bytes.
  const largo = datos.length;
  const total = Math.ceil((largo + 9) / 64) * 64;
  const m = new Uint8Array(total);
  m.set(datos);
  m[largo] = 0x80;
  const bits = largo * 8;
  const vista = new DataView(m.buffer);
  vista.setUint32(total - 8, Math.floor(bits / 0x100000000));
  vista.setUint32(total - 4, bits >>> 0);

  const h = Uint32Array.from([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const w = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  for (let bloque = 0; bloque < total; bloque += 64) {
    for (let i = 0; i < 16; i++) w[i] = vista.getUint32(bloque + i * 4);
    for (let i = 16; i < 64; i++) {
      const a = w[i - 15]!;
      const b = w[i - 2]!;
      const s0 = rotr(a, 7) ^ rotr(a, 18) ^ (a >>> 3);
      const s1 = rotr(b, 17) ^ rotr(b, 19) ^ (b >>> 10);
      w[i] = (w[i - 16]! + s0 + w[i - 7]! + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = [h[0]!, h[1]!, h[2]!, h[3]!, h[4]!, h[5]!, h[6]!, h[7]!];
    for (let i = 0; i < 64; i++) {
      const t1 = (hh + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i]! + w[i]!) >>> 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    h[0] = h[0]! + a;
    h[1] = h[1]! + b;
    h[2] = h[2]! + c;
    h[3] = h[3]! + d;
    h[4] = h[4]! + e;
    h[5] = h[5]! + f;
    h[6] = h[6]! + g;
    h[7] = h[7]! + hh;
  }
  return Array.from(h, (x) => x.toString(16).padStart(8, "0")).join("");
}
