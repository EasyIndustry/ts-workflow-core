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
export declare function jsonCanonico(valor: unknown): string;
/** SHA-256 (en hexadecimal, 64 caracteres en minúscula) del JSON canónico del valor. Ver `jsonCanonico`. */
export declare function huella(valor: unknown): string;
/** UTF-8 de un texto. Un surrogate suelto se escribe como U+FFFD, igual que `TextEncoder`. */
export declare function utf8(texto: string): Uint8Array;
/** SHA-256 (FIPS 180-4) de unos bytes, en hexadecimal. */
export declare function sha256Hex(datos: Uint8Array): string;
