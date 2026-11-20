/**
 * Demo por consola del taller de servicio técnico: valida los flujos, muestra qué acciones quedan permitidas o
 * bloqueadas (y por qué) en distintos momentos de una orden, explica un bloqueo y corre los escenarios.
 *   npm run ejemplo
 */
import {
  casilleros,
  evaluar,
  explicar,
  motivos,
  simular,
  validarDefinicion,
  type DefinicionFlujo,
  type EfectoResuelto,
  type Instancia,
  type ResultadoSimulacion,
} from "../../src/index.js";
import { BATERIAS, equipoConBateria, formularioSinFirma, ordenAbiertaAntes } from "./escenarios.js";
import { formularioV1, formularioV2, tallerV1, tallerV2, versionesFormulario, versionesTaller } from "./flujos.js";
import { registroTaller, type ContextoTaller } from "./registro.js";

const titulo = (texto: string) => console.log(`\n${texto}\n${"=".repeat(texto.length)}`);
const nombreDeEstado = (def: DefinicionFlujo, id: string) => def.estados.find((e) => e.id === id)?.nombre ?? id;
const efecto = (e: EfectoResuelto) =>
  typeof e.params.mensaje === "string" ? `efecto «${e.efecto}» a ${String(e.params.destinatario)}: «${e.params.mensaje}»` : `efecto «${e.efecto}» ${JSON.stringify(e.params)}`;

/** Lo que vería la persona en ese momento: cada acción del estado, permitida o bloqueada, con el porqué. */
function momento(descripcion: string, versiones: DefinicionFlujo[], instancia: Instancia, ctx: ContextoTaller) {
  const def = versiones.find((d) => d.version === instancia.version)!;
  const r = evaluar(versiones, instancia, ctx, registroTaller);
  console.log(`\n▸ ${descripcion}`);
  console.log(`  ${def.nombre} v${def.version}, estado «${nombreDeEstado(def, r.estado)}»`);
  for (const a of r.permitidas) {
    console.log(`  ✓ PERMITIDA  ${a.nombre}${a.cambiaEstado ? ` → ${nombreDeEstado(def, a.destino)}` : " (no cambia de estado)"}`);
    for (const d of a.recorrido) console.log(`      ${d.nombre} ${d.motivo}`);
    for (const e of a.efectos) console.log(`      ${efecto(e)}`);
    if (a.sugerencias && !a.sugerencias.cumple) for (const m of motivos(a.sugerencias)) console.log(`      conviene: ${m}`);
  }
  for (const b of r.bloqueadas) {
    console.log(`  ✗ BLOQUEADA  ${b.nombre}`);
    for (const m of b.motivos) console.log(`      porque: ${m}`);
  }
}

titulo("1. Las definiciones se validan antes de publicarlas");
for (const def of [tallerV1, tallerV2, formularioV1, formularioV2]) {
  const v = validarDefinicion(def, registroTaller);
  console.log(`${def.id} v${def.version}: ${v.valido ? "válida" : "con errores"}${v.avisos.length ? ` (${v.avisos.length} avisos)` : ""}`);
  for (const p of [...v.errores, ...v.avisos]) console.log(`  - ${p.ruta}: ${p.mensaje}`);
}

titulo("2. Qué se puede hacer en cada momento, y por qué no");
const listas = { baterias: BATERIAS };
const sinPiezas = { fotos: [], piezas: [], repuestosPendientes: 0 };
momento("Llega un equipo, todavía sin fotos", versionesTaller, { version: 2, estado: "sin_ingresar" }, { orden: sinPiezas, listas });
momento(
  "Ya tiene la foto de la etiqueta y la del aspecto inicial",
  versionesTaller,
  { version: 2, estado: "sin_ingresar" },
  { orden: { ...sinPiezas, fotos: ["ETIQUETA", "INGRESO"] }, listas },
);
momento(
  "En revisión, con un repuesto pedido que no llegó",
  versionesTaller,
  { version: 2, estado: "en_revision" },
  { orden: { ...sinPiezas, fotos: ["ETIQUETA", "INGRESO"], repuestosPendientes: 1 }, listas },
);
const testeoConBateria: ContextoTaller = { orden: { fotos: ["ETIQUETA", "INGRESO", "FUNCIONANDO"], piezas: ["BAT-100"], repuestosPendientes: 0 }, listas };
momento("En testeo: se le cambió la batería y solo tiene la foto de «Funcionando»", versionesTaller, { version: 2, estado: "en_testeo" }, testeoConBateria);
momento(
  "En testeo: el mismo equipo, pero sin cambio de batería",
  versionesTaller,
  { version: 2, estado: "en_testeo" },
  { orden: { ...testeoConBateria.orden!, piezas: [] }, listas },
);
momento(
  "La misma orden con batería, pero abierta con la configuración vieja (v1)",
  versionesTaller,
  { version: 1, estado: "en_testeo" },
  testeoConBateria,
);
momento(
  "Formulario de conformidad sin la firma del cliente",
  versionesFormulario,
  { version: 2, estado: "borrador" },
  { formulario: { respuestas: { estado: "Funciona", firma_cliente: "" } }, listas },
);

titulo("3. «¿Por qué no puedo pasar a Finalizado?», y los casilleros que dibujaría la web");
const instancia = { version: 2, estado: "en_testeo" };
console.log(explicar(versionesTaller, instancia, testeoConBateria, registroTaller, "orden.avanzar").texto);
const bloqueada = evaluar(versionesTaller, instancia, testeoConBateria, registroTaller).bloqueadas[0];
console.log("\nCasilleros:");
for (const c of casilleros(bloqueada?.requisitos)) console.log(`  [${c.cumple ? "x" : " "}] ${c.texto}`);
for (const c of casilleros(bloqueada?.sugerencias)) console.log(`  [${c.cumple ? "x" : " "}] ${c.texto} (sugerida)`);

titulo("4. Escenarios simulados (sin ejecutar nada)");
const mostrar = (r: ResultadoSimulacion) => {
  console.log(`\n== ${r.escenario} · ${r.flujo} v${r.version} · ${r.ok ? "cumple lo esperado" : "NO cumple lo esperado"}`);
  for (const p of r.pasos) {
    console.log(`${p.indice + 1}. ${p.nombre}: ${p.permitida ? `${p.desde} → ${p.hasta}` : `bloqueada en ${p.desde}`}${p.nota ? `  (${p.nota})` : ""}`);
    for (const m of p.motivos) console.log(`     ${m}`);
    for (const d of p.recorrido) console.log(`     ${d.nombre} ${d.motivo}`);
    for (const e of p.efectos) console.log(`     ${efecto(e)}`);
    for (const f of p.fallas) console.log(`     FALLA: ${f}`);
  }
};
mostrar(simular(versionesTaller, equipoConBateria, registroTaller));
mostrar(simular(versionesTaller, ordenAbiertaAntes, registroTaller));
mostrar(simular(versionesFormulario, formularioSinFirma, registroTaller));
