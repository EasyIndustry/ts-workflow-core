import { describe, expect, it } from "vitest";
import { compararCapacidades, compararEsquemas, compararFlujos, ErrorFlujo, type Cambio, type Condicion, type DefinicionFlujo, type EsquemaJson } from "../src/index.js";
import { implica } from "../src/comparar.js";
import { formularioV1, formularioV2, tallerV1, tallerV2 } from "../ejemplos/taller/flujos.js";
import { registroTaller } from "../ejemplos/taller/registro.js";
import { definicion, f, registro } from "./ayudas.js";

const resumen = (cambios: Cambio[]) => cambios.map((c) => `${c.nivel} ${c.codigo} ${c.ruta}`);

describe("compararFlujos", () => {
  const base = definicion();

  it("sin cambios es compatible y no lista nada", () => {
    expect(compararFlujos(base, definicion({ version: 2 }))).toEqual({ compatible: true, cambios: [] });
  });

  it("el taller v1 → v2: lo que suma requisitos o saca transiciones rompe; lo demás es compatible", () => {
    const r = compararFlujos(tallerV1, tallerV2);
    expect(r.compatible).toBe(false);
    expect(resumen(r.cambios)).toEqual([
      "compatible estado_modificado estados[finalizado]",
      "compatible decision_agregada decisiones[faltan_repuestos]",
      "rompe requisitos_endurecidos transiciones[ingresar].requisitos",
      "rompe transicion_quitada transiciones[reparar]",
      "rompe requisitos_endurecidos transiciones[finalizar].requisitos",
      "compatible sugerencias_cambiadas transiciones[finalizar].sugerencias",
      "compatible transicion_agregada transiciones[diagnosticar]",
      "compatible transicion_agregada transiciones[agregar_pieza]",
    ]);
    expect(r.cambios[0]!.mensaje).toBe("Cambió «alEntrar» del estado «Finalizado».");
  });

  it("sumar una firma rompe; sacarla es compatible", () => {
    expect(resumen(compararFlujos(formularioV1, formularioV2).cambios)).toEqual(["rompe requisitos_endurecidos transiciones[terminar].requisitos"]);
    expect(compararFlujos(formularioV2, formularioV1)).toMatchObject({ compatible: true, cambios: [{ codigo: "requisitos_relajados" }] });
  });

  it("datos del flujo, estado inicial, estados y nombres: compatibles", () => {
    const despues = definicion({
      nombre: "Otra",
      descripcion: "d",
      metadatos: { x: 1 },
      estadoInicial: "b",
      estados: [{ id: "a", nombre: "Inicio", final: true }, { id: "b", nombre: "Medio" }, { id: "c", nombre: "Fin", final: true }, { id: "d", nombre: "Nuevo", final: true }],
      transiciones: base.transiciones.map((t) => (t.id === "t1" ? { ...t, nombre: "Arrancar", efectos: [{ efecto: "ping" }] } : t)),
    });
    const r = compararFlujos(base, despues);
    expect(r.compatible).toBe(true);
    expect(resumen(r.cambios)).toEqual([
      "compatible datos_cambiados nombre",
      "compatible datos_cambiados descripcion",
      "compatible datos_cambiados metadatos",
      "compatible estado_inicial_cambiado estadoInicial",
      "compatible estado_modificado estados[a]",
      "compatible estado_agregado estados[d]",
      "compatible efectos_cambiados transiciones[t1].efectos",
      "compatible transicion_modificada transiciones[t1].nombre",
    ]);
    expect(r.cambios[3]!.mensaje).toBe("El estado inicial pasó de «a» a «b»: solo afecta a las instancias nuevas.");
  });

  it("quitar un estado, cambiar la acción o el hacia: rompe", () => {
    const despues = definicion({
      estados: base.estados.filter((e) => e.id !== "b"),
      transiciones: [{ id: "t1", accion: "anotar", desde: ["a"], hacia: "c" }, { id: "t3", accion: "volver", desde: ["c"] }],
    });
    const r = compararFlujos(base, despues);
    expect(resumen(r.cambios)).toEqual([
      "rompe estado_quitado estados[b]",
      "rompe accion_cambiada transiciones[t1].accion",
      "rompe hacia_cambiado transiciones[t1].hacia",
      "rompe transicion_quitada transiciones[t2]",
      "compatible desde_ampliado transiciones[t3].desde",
      "rompe hacia_cambiado transiciones[t3].hacia",
    ]);
    expect(r.cambios[5]!.mensaje).toBe("La transición «t3» llevaba a «a» y ahora lleva a ningún lado (no cambiaba de estado).");
  });

  it("desde: achicarlo rompe y ampliarlo es compatible, también con «*» y excepto", () => {
    const con = (t3: Partial<DefinicionFlujo["transiciones"][number]>) =>
      definicion({ transiciones: base.transiciones.map((t) => (t.id === "t3" ? { id: "t3", accion: "volver", hacia: "a", ...t3 } as typeof t : t)) });
    const todos = con({ desde: "*" });
    const sinC = con({ desde: "*", excepto: ["c"] });
    expect(resumen(compararFlujos(base, todos).cambios)).toEqual(["compatible desde_ampliado transiciones[t3].desde"]);
    expect(compararFlujos(todos, sinC).cambios).toMatchObject([{ nivel: "rompe", codigo: "desde_reducido", mensaje: "La transición «t3» ya no se puede hacer desde «Fin»." }]);
    expect(compararFlujos(sinC, con({ desde: ["a", "b", "c"] })).cambios).toMatchObject([{ codigo: "desde_ampliado" }]);
    expect(compararFlujos(con({ desde: ["a", "b"] }), con({ desde: ["b", "c"] })).cambios.map((c) => c.codigo)).toEqual(["desde_reducido", "desde_ampliado"]);
  });

  it("requisitos: agregar rompe, sacar es compatible, cambiar solo el mensaje es compatible", () => {
    const con = (requisitos: Condicion | undefined) =>
      definicion({ transiciones: base.transiciones.map((t) => (t.id === "t2" ? { id: "t2", accion: "ir", desde: ["b"], hacia: "c", ...(requisitos ? { requisitos } : {}) } : t)) });
    expect(compararFlujos(con(undefined), con(f("pago"))).cambios).toMatchObject([{ nivel: "rompe", codigo: "requisitos_endurecidos" }]);
    expect(compararFlujos(con(f("pago")), con(undefined)).cambios).toMatchObject([{ nivel: "compatible", codigo: "requisitos_relajados" }]);
    expect(compararFlujos(con(f("pago")), con(f("pago", "Pagá primero"))).cambios).toMatchObject([
      { nivel: "compatible", codigo: "transicion_modificada", ruta: "transiciones[t2].requisitos" },
    ]);
    expect(compararFlujos(con(f("pago")), con({ alguna: [f("pago"), f("firma")] })).compatible).toBe(true);
    expect(compararFlujos(con(f("pago")), con(f("firma"))).compatible).toBe(false);
    expect(compararFlujos(con({ condicion: "flag", params: {} }), con({ condicion: "flag" }))).toMatchObject({ compatible: true, cambios: [{ codigo: "transicion_modificada" }] });
  });

  it("decisiones: cambiar ramas o sino rompe, quitarla rompe, cambiar el nombre es compatible", () => {
    const decision = { id: "dec", nombre: "¿Pagó?", ramas: [{ si: f("pago"), hacia: "c" }], sino: "a" };
    const con = (decisiones: DefinicionFlujo["decisiones"]) =>
      definicion({ decisiones, transiciones: base.transiciones.map((t) => (t.id === "t2" ? { id: "t2", accion: "ir", desde: ["b"], hacia: "dec" } : t)) });
    const v1 = con([decision]);
    expect(resumen(compararFlujos(v1, con([{ ...decision, sino: "b" }])).cambios)).toEqual(["rompe decision_modificada decisiones[dec]"]);
    expect(compararFlujos(v1, con([{ ...decision, ramas: [{ si: f("firma"), hacia: "c" }] }])).compatible).toBe(false);
    expect(compararFlujos(v1, con([{ ...decision, ramas: [{ si: f("pago", "otro texto"), hacia: "c" }] }]))).toMatchObject({ compatible: true });
    expect(compararFlujos(v1, con([{ ...decision, nombre: "¿Está pago?" }])).cambios).toMatchObject([
      { nivel: "compatible", codigo: "decision_modificada", mensaje: "Cambió «nombre» de la decisión «¿Está pago?»." },
    ]);
    const sinDecision = compararFlujos(v1, base);
    expect(resumen(sinDecision.cambios)).toEqual(["rompe decision_quitada decisiones[dec]", "rompe hacia_cambiado transiciones[t2].hacia", "rompe requisitos_endurecidos transiciones[t2].requisitos"]);
  });

  it("falla si se comparan flujos distintos", () => {
    expect(() => compararFlujos(base, definicion({ id: "otro" }))).toThrow(ErrorFlujo);
    expect(() => compararFlujos(base, definicion({ id: "otro" }))).toThrow("No se pueden comparar versiones de flujos distintos: «prueba» y «otro».");
  });
});

describe("implica (prueba conservadora de que una condición pide al menos lo que otra)", () => {
  const p = f("pago");
  const q = f("firma");
  const r = f("otra");
  it.each<[string, Condicion, Condicion, boolean]>([
    ["igual", p, p, true],
    ["igual salvo el mensaje", f("pago", "x"), p, true],
    ["todas[p, q] ⇒ p", { todas: [p, q] }, p, true],
    ["p ⇒ todas[p, q] no", p, { todas: [p, q] }, false],
    ["todas[p, q, r] ⇒ todas[q, p]", { todas: [p, q, r] }, { todas: [q, p] }, true],
    ["p ⇒ alguna[q, p]", p, { alguna: [q, p] }, true],
    ["alguna[p, q] ⇒ alguna[q, p, r]", { alguna: [p, q] }, { alguna: [q, p, r] }, true],
    ["alguna[p, q] ⇒ p no", { alguna: [p, q] }, p, false],
    ["p ⇒ (q → p)", p, { si: q, entonces: p }, true],
    ["(q → p) ⇒ (q → alguna[p, r])", { si: q, entonces: p }, { si: q, entonces: { alguna: [p, r] } }, true],
    ["(q → p) ⇒ (todas[q, r] → p)", { si: q, entonces: p }, { si: { todas: [q, r] }, entonces: p }, true],
    ["(q → p) ⇒ (r → p) no", { si: q, entonces: p }, { si: r, entonces: p }, false],
    ["(q → p) ⇒ p no", { si: q, entonces: p }, p, false],
    ["no p ⇒ no todas[p, q]", { no: p }, { no: { todas: [p, q] } }, true],
    ["no p ⇒ no q no", { no: p }, { no: q }, false],
    ["no p ⇒ q no", { no: p }, q, false],
  ])("%s", (_nombre, a, b, esperado) => {
    expect(implica(a, b)).toBe(esperado);
  });
});

describe("compararEsquemas", () => {
  const cmp = (a: EsquemaJson | undefined, d: EsquemaJson | undefined) => compararEsquemas(a, d);
  const objeto = (extra: EsquemaJson = {}): EsquemaJson => ({
    type: "object",
    properties: { momento: { type: "string", enum: ["A", "B"] }, cantidad: { type: "integer", minimum: 1, maximum: 10 } },
    required: ["momento"],
    additionalProperties: false,
    ...extra,
  });

  it("igual, o igual salvo anotaciones: compatible", () => {
    expect(cmp(objeto(), objeto())).toEqual({ compatible: true, cambios: [] });
    expect(cmp(undefined, {})).toEqual({ compatible: true, cambios: [] });
    expect(cmp(objeto(), objeto({ title: "Foto", description: "x" }))).toEqual({
      compatible: true,
      cambios: [
        { nivel: "compatible", codigo: "esquema_anotacion", ruta: "schema.title", mensaje: "Cambió una anotación (no cambia qué valores acepta)." },
        { nivel: "compatible", codigo: "esquema_anotacion", ruta: "schema.description", mensaje: "Cambió una anotación (no cambia qué valores acepta)." },
      ],
    });
  });

  it("type: sumar tipos (o pasar de integer a number) relaja; sacar tipos o ponerlo donde no había, rompe", () => {
    expect(cmp({ type: "string" }, { type: ["string", "null"] }).compatible).toBe(true);
    expect(cmp({ type: "integer" }, { type: "number" }).compatible).toBe(true);
    expect(cmp({ type: "string" }, {}).compatible).toBe(true);
    expect(cmp({ type: "number" }, { type: "integer" }).compatible).toBe(false);
    expect(cmp({}, { type: "string" }).cambios).toMatchObject([{ codigo: "esquema_endurecido", mensaje: "Antes aceptaba cualquier tipo." }]);
  });

  it("enum, const y oneOf de constantes: sumar valores relaja, sacarlos rompe", () => {
    expect(cmp({ enum: ["A"] }, { enum: ["A", "B"] }).compatible).toBe(true);
    expect(cmp({ enum: ["A", "B"] }, { enum: ["A"] }).cambios).toMatchObject([{ nivel: "rompe", mensaje: 'Ya no acepta "B".' }]);
    expect(cmp({ enum: ["A"] }, {}).compatible).toBe(true);
    expect(cmp({}, { enum: ["A"] }).cambios).toMatchObject([{ nivel: "rompe", mensaje: "Ahora limita los valores." }]);
    expect(cmp({ const: "A" }, { const: "B" }).compatible).toBe(false);
    expect(cmp({ const: "A" }, {}).compatible).toBe(true);
    expect(cmp({}, { const: null }).compatible).toBe(false);
    const opciones = (...v: string[]) => ({ oneOf: v.map((x) => ({ const: x, title: x.toLowerCase() })) });
    expect(cmp(opciones("A"), opciones("A", "B")).compatible).toBe(true);
    expect(cmp(opciones("A", "B"), opciones("B")).compatible).toBe(false);
    expect(cmp(opciones("A"), {}).compatible).toBe(true);
  });

  it("oneOf/anyOf con schemas: compatible solo si cambian anotaciones; si no, rompe por las dudas", () => {
    const a = { anyOf: [{ type: "string", title: "texto" }, { type: "number" }] };
    expect(cmp(a, { anyOf: [{ type: "string", title: "otro" }, { type: "number" }] }).cambios).toMatchObject([{ nivel: "compatible", codigo: "esquema_anotacion" }]);
    expect(cmp(a, { anyOf: [{ type: "string" }, { type: "number" }, { type: "null" }] }).compatible).toBe(false);
  });

  it("required: pedir un campo nuevo rompe, dejar de pedirlo relaja", () => {
    expect(cmp(objeto(), objeto({ required: ["momento", "cantidad"] })).cambios).toMatchObject([
      { nivel: "rompe", ruta: "schema.required", mensaje: "Ahora es obligatorio: «cantidad»." },
    ]);
    expect(cmp(objeto(), objeto({ required: [] })).compatible).toBe(true);
  });

  it("properties y additionalProperties: cada propiedad contra lo que la cubría antes", () => {
    // Una propiedad nueva donde antes no se aceptaban otras: relaja.
    const conNota = objeto({ properties: { ...(objeto().properties as object), nota: { type: "string" } } });
    expect(cmp(objeto(), conNota).compatible).toBe(true);
    // Al revés: la propiedad desaparece y additionalProperties: false la rechaza.
    expect(cmp(conNota, objeto()).cambios).toMatchObject([{ nivel: "rompe", ruta: "schema.properties.nota", mensaje: "Ahora no acepta ningún valor." }]);
    // Sin additionalProperties antes (aceptaba cualquier clave): una propiedad nueva con tipo rompe.
    expect(cmp({ type: "object" }, { type: "object", properties: { x: { type: "string" } } }).compatible).toBe(false);
    // Cerrar o abrir additionalProperties.
    expect(cmp({ type: "object" }, { type: "object", additionalProperties: false }).compatible).toBe(false);
    expect(cmp(objeto(), objeto({ additionalProperties: true })).compatible).toBe(true);
    expect(cmp({ additionalProperties: { type: "string" } }, { additionalProperties: { type: ["string", "number"] } }).compatible).toBe(true);
    // Dentro de una propiedad: achicar un rango rompe.
    const r = cmp(objeto(), objeto({ properties: { momento: { type: "string", enum: ["A", "B"] }, cantidad: { type: "integer", minimum: 2, maximum: 20 } } }));
    expect(resumen(r.cambios)).toEqual(["rompe esquema_endurecido schema.properties.cantidad.minimum", "compatible esquema_relajado schema.properties.cantidad.maximum"]);
  });

  it("items, largos y pattern", () => {
    const lista = { type: "array", items: { type: "string" }, minItems: 1, maxItems: 3 };
    expect(cmp(lista, { ...lista, items: { type: "string", maxLength: 5 } }).compatible).toBe(false);
    expect(cmp(lista, { ...lista, items: undefined }).compatible).toBe(true);
    expect(cmp(lista, { ...lista, minItems: 0, maxItems: 4 }).compatible).toBe(true);
    expect(cmp(lista, { type: "array", items: { type: "string" } }).compatible).toBe(true);
    expect(cmp({ type: "string" }, { type: "string", minLength: 1 }).cambios).toMatchObject([{ mensaje: "Ahora tiene «minLength»: 1." }]);
    expect(cmp({ type: "string", maxLength: 5 }, { type: "string", maxLength: 3 }).cambios).toMatchObject([{ mensaje: "«maxLength» pasó de 5 a 3." }]);
    expect(cmp({ pattern: "^a" }, { pattern: "^b" }).compatible).toBe(false);
    expect(cmp({ pattern: "^a" }, {}).compatible).toBe(true);
  });

  it("false no acepta nada; palabras que no entiende y cambian: rompe", () => {
    expect(cmp({ type: "string" }, false as unknown as EsquemaJson).compatible).toBe(false);
    expect(compararEsquemas({ properties: { x: false } }, { properties: { x: { type: "string" } } }).compatible).toBe(true);
    expect(compararEsquemas({ properties: { x: false } }, { properties: { x: false } }).cambios).toEqual([]);
    expect(cmp({ type: "string" }, { type: "string", format: "email" }).cambios).toMatchObject([
      { nivel: "rompe", ruta: "schema.format", mensaje: "Cambió «format», que el comparador no entiende: no se puede asegurar que acepte lo mismo." },
    ]);
  });
});

describe("compararCapacidades", () => {
  it("quitar o cambiar el tipo rompe; agregar o renombrar es compatible; el schema se compara con compararEsquemas", () => {
    const antes = registro.descriptores();
    const despues = antes
      .filter((d) => d.id !== "anotar")
      .map((d) => {
        if (d.id === "cerrar") return { ...d, tipo: "efecto" as const };
        if (d.id === "ir") return { ...d, nombre: "Avanzar", grupo: "básicas" };
        if (d.id === "log") return { ...d, schemaEntrada: { ...d.schemaEntrada, required: ["texto", "nivel"] } };
        return d;
      })
      .concat([{ id: "nueva", nombre: "Nueva", tipo: "accion" }]);
    const r = compararCapacidades(registro, despues);
    expect(r.compatible).toBe(false);
    expect(resumen(r.cambios)).toEqual([
      "compatible capacidad_modificada capacidades[ir]",
      "rompe capacidad_quitada capacidades[anotar]",
      "rompe capacidad_tipo_cambiado capacidades[cerrar].tipo",
      "rompe esquema_endurecido capacidades[log].schemaEntrada.required",
      "compatible capacidad_agregada capacidades[nueva]",
    ]);
    expect(r.cambios[0]!.mensaje).toBe("Cambió «nombre» y «grupo» de «ir».");
    expect(compararCapacidades(registroTaller, registroTaller)).toEqual({ compatible: true, cambios: [] });
  });
});
