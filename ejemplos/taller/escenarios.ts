/**
 * Escenarios del taller. Cada paso dice cómo cambió el contexto (el core no ejecuta nada) y qué se espera.
 * Son la prueba de aceptación de la configuración: `test/ejemplos.test.ts` los corre todos.
 */
import type { Escenario } from "../../src/index.js";

/** Códigos de ejemplo. En una app real, la lista se edita en su configuración. */
export const BATERIAS = ["BAT-100", "BAT-200", "BAT-300"];
const listas = { baterias: BATERIAS };

/** Un equipo al que se le cambia la batería: para Finalizado pide las dos pruebas extra. */
export const equipoConBateria: Escenario = {
  nombre: "Equipo con batería nueva (v2)",
  contexto: { orden: { fotos: [], piezas: [], repuestosPendientes: 0 }, listas },
  pasos: [
    { accion: "orden.ingresar", espera: { permitida: false }, nota: "Sin fotos no ingresa." },
    { accion: "orden.ingresar", contexto: { orden: { fotos: ["ETIQUETA", "INGRESO"] } }, espera: { estado: "en_taller" } },
    {
      accion: "orden.agregar-pieza",
      contexto: { entrada: { codigoPieza: "BAT-100" }, orden: { piezas: ["BAT-100"] } },
      espera: { permitida: true, estado: "en_taller" },
      nota: "Se carga la batería: avisa al técnico.",
    },
    { accion: "orden.avanzar", contexto: { entrada: null }, espera: { estado: "en_revision" } },
    { accion: "orden.avanzar", contexto: { orden: { repuestosPendientes: 1 } }, espera: { estado: "esperando_repuesto" }, nota: "Falta el conector de carga." },
    { accion: "orden.avanzar", contexto: { orden: { repuestosPendientes: 0 } }, espera: { estado: "en_reparacion" } },
    { accion: "orden.avanzar", espera: { estado: "en_testeo" } },
    {
      accion: "orden.avanzar",
      contexto: { orden: { fotos: ["ETIQUETA", "INGRESO", "FUNCIONANDO"] } },
      espera: { permitida: false },
      nota: "Funciona, pero faltan las pruebas de la batería.",
    },
    {
      accion: "orden.avanzar",
      contexto: { orden: { fotos: ["ETIQUETA", "INGRESO", "FUNCIONANDO", "PRUEBA_CARGA", "PRUEBA_TEMPERATURA"] } },
      espera: { estado: "finalizado" },
    },
    { accion: "orden.avanzar", espera: { estado: "entregado" } },
  ],
};

/** Una orden que arrancó antes del cambio: sigue en la v1 y no se le piden las pruebas de la batería. */
export const ordenAbiertaAntes: Escenario = {
  nombre: "Orden abierta antes del cambio (v1)",
  version: 1,
  estado: "en_testeo",
  contexto: { orden: { fotos: ["INGRESO", "FUNCIONANDO"], piezas: ["BAT-100"], repuestosPendientes: 0 }, listas },
  pasos: [{ accion: "orden.avanzar", espera: { estado: "finalizado" } }],
};

/** El formulario de conformidad no se termina sin la firma del cliente; después se puede seguir completando. */
export const formularioSinFirma: Escenario = {
  nombre: "Formulario sin firma (v2)",
  contexto: { formulario: { respuestas: { estado: "Funciona", firma_cliente: "" } }, listas },
  pasos: [
    { accion: "formulario.terminar", espera: { permitida: false }, nota: "Una firma vacía («») no cuenta." },
    { accion: "formulario.terminar", contexto: { formulario: { respuestas: { firma_cliente: "data:image/png;base64,iVBOR" } } }, espera: { estado: "terminado" } },
    { accion: "formulario.editar", espera: { permitida: true, estado: "terminado" }, nota: "Se puede completar después." },
  ],
};
