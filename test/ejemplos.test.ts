import { describe, expect, it } from "vitest";
import { casilleros, evaluar, explicar, iniciarInstancia, simular, validarDefinicion } from "../src/index.js";
import { pedido, registro } from "../ejemplos/juguete.js";
import { equipoConBateria, formularioSinFirma, ordenAbiertaAntes } from "../ejemplos/taller/escenarios.js";
import { formularioV1, formularioV2, tallerV1, tallerV2, versionesFormulario, versionesTaller } from "../ejemplos/taller/flujos.js";
import { registroTaller, type ContextoTaller } from "../ejemplos/taller/registro.js";

describe("ejemplo del README (registro de juguete)", () => {
  it("se valida, se evalúa y se explica como dice el README", () => {
    expect(validarDefinicion(pedido, registro)).toMatchObject({ valido: true, errores: [], avisos: [] });
    const instancia = iniciarInstancia(pedido);
    expect(instancia).toEqual({ version: 1, estado: "borrador" });
    const contexto = { pedido: { items: 0, pagado: false } };
    const r = evaluar(pedido, instancia, contexto, registro);
    expect(r.permitidas.map((a) => a.accion)).toEqual(["pedido.cancelar"]);
    expect(r.bloqueadas.map((a) => [a.accion, a.motivos])).toEqual([["pedido.confirmar", ["El pedido no tiene ítems"]]]);
    expect(explicar(pedido, instancia, contexto, registro, "pedido.confirmar").texto).toBe("No podés «Confirmar pedido» desde «Borrador»: el pedido no tiene ítems.");
    const entregar = evaluar(pedido, { version: 1, estado: "confirmado" }, { pedido: { items: 2, pagado: true } }, registro).permitidas[0]!;
    expect(entregar).toMatchObject({ destino: "entregado", efectos: [{ efecto: "avisar", params: { a: "cliente" } }] });
  });
});

describe("taller de servicio técnico como configuración", () => {
  it("las cuatro definiciones son válidas contra el registro del taller, sin avisos", () => {
    for (const def of [tallerV1, tallerV2, formularioV1, formularioV2]) {
      expect(validarDefinicion(def, registroTaller), `${def.id} v${def.version}`).toMatchObject({ valido: true, errores: [], avisos: [] });
    }
  });

  it.each([
    ["equipo con batería nueva", versionesTaller, equipoConBateria],
    ["orden abierta antes del cambio", versionesTaller, ordenAbiertaAntes],
    ["formulario sin firma", versionesFormulario, formularioSinFirma],
  ] as const)("escenario «%s»: cumple todo lo esperado", (_nombre, versiones, escenario) => {
    const r = simular(versiones, escenario, registroTaller);
    expect(r.pasos.flatMap((p) => p.fallas)).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("al cargar una batería avisa al técnico; con otra pieza, no", () => {
    const base: ContextoTaller = { orden: { fotos: [], piezas: [], repuestosPendientes: 0 }, listas: { baterias: ["BAT-100"] } };
    const agregar = (codigoPieza: string) =>
      evaluar(tallerV2, { version: 2, estado: "en_taller" }, { ...base, entrada: { codigoPieza } }, registroTaller).permitidas.find((a) => a.accion === "orden.agregar-pieza")!;
    expect(agregar("BAT-100").efectos).toEqual([
      { efecto: "notificar", params: { destinatario: "tecnico", mensaje: expect.stringContaining("batería") }, origen: "transicion:agregar_pieza" },
    ]);
    expect(agregar("PAN-900").efectos).toEqual([]);
  });

  it("«¿por qué no puedo pasar a Finalizado?» y los casilleros que dibuja la web", () => {
    const ctx: ContextoTaller = {
      orden: { fotos: ["ETIQUETA", "INGRESO", "FUNCIONANDO"], piezas: ["BAT-100"], repuestosPendientes: 0 },
      listas: { baterias: ["BAT-100"] },
    };
    const instancia = { version: 2, estado: "en_testeo" };
    expect(explicar(versionesTaller, instancia, ctx, registroTaller, "orden.avanzar").texto).toBe(
      [
        "No podés «Avanzar estado» desde «En testeo»:",
        "- Como la orden lleva una batería: falta la foto «Prueba de carga».",
        "- Como la orden lleva una batería: falta la foto «Prueba de temperatura».",
        "Además conviene:",
        "- Falta la foto «Desperfecto».",
        "- Falta la foto «Reparación».",
      ].join("\n"),
    );
    const bloqueada = evaluar(versionesTaller, instancia, ctx, registroTaller).bloqueadas[0]!;
    expect(casilleros(bloqueada.requisitos).map((c) => [c.texto, c.cumple])).toEqual([
      ["Tiene la foto «Funcionando»", true],
      ["Falta la foto «Prueba de carga»", false],
      ["Falta la foto «Prueba de temperatura»", false],
    ]);
    // Sin batería, los casilleros de las pruebas no aparecen.
    const sinBateria = evaluar(versionesTaller, instancia, { ...ctx, orden: { ...ctx.orden!, piezas: [] } }, registroTaller);
    expect(sinBateria.permitidas.map((a) => a.destino)).toContain("finalizado");
    const finalizar = sinBateria.permitidas.find((a) => a.transicion === "finalizar")!;
    expect(casilleros(finalizar.requisitos).map((c) => c.texto)).toEqual(["Tiene la foto «Funcionando»"]);
  });

  it("la misma orden, en la v1, pasa a Finalizado sin las pruebas: el versionado protege las órdenes abiertas", () => {
    const ctx: ContextoTaller = { orden: { fotos: ["FUNCIONANDO"], piezas: ["BAT-100"], repuestosPendientes: 0 }, listas: { baterias: ["BAT-100"] } };
    const v1 = evaluar(versionesTaller, { version: 1, estado: "en_testeo" }, ctx, registroTaller);
    const v2 = evaluar(versionesTaller, { version: 2, estado: "en_testeo" }, ctx, registroTaller);
    expect(v1.permitidas.map((a) => a.transicion)).toContain("finalizar");
    expect(v2.bloqueadas.map((a) => a.transicion)).toContain("finalizar");
  });

  it("el formulario: una firma vacía no cuenta", () => {
    const ctx = (firma: unknown): ContextoTaller => ({ formulario: { respuestas: { estado: "OK", firma_cliente: firma } }, listas: {} });
    const terminar = (firma: unknown) => explicar(versionesFormulario, { version: 2, estado: "borrador" }, ctx(firma), registroTaller, "formulario.terminar");
    expect(terminar("").texto).toBe("No podés «Terminar formulario» desde «Borrador»: falta «Firma del cliente».");
    expect(terminar("   ").permitida).toBe(false);
    expect(terminar(null).permitida).toBe(false);
    expect(terminar("data:image/png;base64,x").permitida).toBe(true);
    // En la v1 alcanza con el estado.
    expect(explicar(versionesFormulario, { version: 1, estado: "borrador" }, ctx(""), registroTaller, "formulario.terminar").permitida).toBe(true);
  });
});
