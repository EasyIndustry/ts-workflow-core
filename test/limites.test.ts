/**
 * El límite de dependencias del core (diseño §6). Es una lista blanca: el core solo puede importar zod y sus propios
 * archivos. Una lista negra (por ejemplo, no-restricted-imports de ESLint) no agarra lo que no se nos ocurrió prohibir.
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PERMITIDOS_EN_SRC = ["zod"];

function archivos(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? archivos(join(dir, e.name)) : e.name.endsWith(".ts") ? [join(dir, e.name)] : []));
}

/** Todos los especificadores de import/export/import()/require de un archivo. */
export function especificadores(codigo: string): string[] {
  const patrones = [
    /\b(?:import|export)\s[^"'`;]*?\bfrom\s*["']([^"']+)["']/g,
    /\bimport\s*["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];
  return patrones.flatMap((p) => [...codigo.matchAll(p)].map((m) => m[1]!));
}

/** Qué imports de un archivo rompen el límite: paquetes fuera de la lista y rutas relativas que salen de `dentroDe`. */
export function violaciones(codigo: string, archivo: string, dentroDe: string, permitidos: readonly string[]): string[] {
  return especificadores(codigo).flatMap((esp) => {
    if (esp.startsWith(".")) {
      const destino = resolve(dirname(archivo), esp);
      return destino === dentroDe || destino.startsWith(dentroDe + sep) ? [] : [`${esp} (sale de ${relative(RAIZ, dentroDe) || "el paquete"})`];
    }
    const paquete = esp.startsWith("@") ? esp.split("/").slice(0, 2).join("/") : esp.split("/")[0]!;
    return permitidos.includes(paquete) ? [] : [esp];
  });
}

describe("límite de dependencias del core", () => {
  it("src solo importa zod y sus propios archivos (nada de la app, de Node ni de otros paquetes)", () => {
    const src = join(RAIZ, "src");
    const encontradas = archivos(src).flatMap((a) => violaciones(readFileSync(a, "utf8"), a, src, PERMITIDOS_EN_SRC).map((v) => `${relative(RAIZ, a)}: ${v}`));
    expect(encontradas).toEqual([]);
  });

  it("los ejemplos solo usan el core (por su API pública) y archivos propios", () => {
    const ejemplos = join(RAIZ, "ejemplos");
    const encontradas = archivos(ejemplos).flatMap((a) => violaciones(readFileSync(a, "utf8"), a, RAIZ, []).map((v) => `${relative(RAIZ, a)}: ${v}`));
    expect(encontradas).toEqual([]);
  });

  it("package.json: la única dependencia es zod", () => {
    const pkg = JSON.parse(readFileSync(join(RAIZ, "package.json"), "utf8")) as Record<string, Record<string, string> | undefined>;
    expect(Object.keys(pkg.dependencies ?? {})).toEqual(["zod"]);
    expect(pkg.peerDependencies).toBeUndefined();
    expect(pkg.optionalDependencies).toBeUndefined();
    expect(pkg.name).toBe("ts-workflow-core");
  });

  it("la regla detecta lo prohibido (prueba de la prueba)", () => {
    const codigo = [
      'import { PrismaClient } from "@prisma/client";',
      'import type { FastifyInstance } from "fastify";',
      "import {",
      "  algo,",
      '} from "@mi-app/api";',
      'import "node:fs";',
      'const r = await import("react");',
      'const x = require("express");',
      'export { y } from "../../otro-paquete/src/db.js";',
      'import { z } from "zod";',
      'import { ok } from "./propio.js";',
      'import { z4 } from "zod/v4";',
    ].join("\n");
    const archivo = join(RAIZ, "src", "x.ts");
    expect(violaciones(codigo, archivo, join(RAIZ, "src"), PERMITIDOS_EN_SRC)).toEqual([
      "@prisma/client",
      "fastify",
      "@mi-app/api",
      "../../otro-paquete/src/db.js (sale de src)",
      "node:fs",
      "react",
      "express",
    ]);
  });
});
