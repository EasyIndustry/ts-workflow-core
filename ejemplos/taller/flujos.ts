/**
 * Un taller de servicio técnico, como CONFIGURACIÓN. La v1 de cada flujo es la configuración inicial; la v2 suma reglas
 * nuevas que pidió el taller. Lo único que cambia entre las dos es dónde se cuelga cada condición: ninguna regla nueva
 * es código.
 *
 * - Firma obligatoria: el formulario de conformidad no se termina sin la firma del cliente → `formularioV2`, «terminar».
 * - Fotos por paso: cada paso exige sus fotos → `requisitos` de «ingresar» y «finalizar».
 * - Casilleros con título: los dibuja la web con `casilleros()` sobre `requisitos` y `sugerencias`.
 * - Prueba extra si se usa cierta pieza: si la orden lleva una batería, «finalizar» pide la prueba de carga y la de
 *   temperatura (`si/entonces`), y al agregar la batería se avisa al técnico.
 */
import type { Condicion, DefinicionFlujo } from "../../src/index.js";

const foto = (momento: string): Condicion => ({ condicion: "foto.tiene", params: { momento } });
const campo = (nombre: string): Condicion => ({ condicion: "formulario.campo-completo", params: { campo: nombre } });
const AVANZAR = "orden.avanzar";

const estadosTaller: DefinicionFlujo["estados"] = [
  { id: "sin_ingresar", nombre: "Sin ingresar" },
  { id: "en_taller", nombre: "En taller" },
  { id: "en_revision", nombre: "En revisión" },
  { id: "en_reparacion", nombre: "En reparación" },
  { id: "esperando_repuesto", nombre: "Esperando repuesto" },
  { id: "en_testeo", nombre: "En testeo" },
  { id: "finalizado", nombre: "Finalizado" },
  { id: "entregado", nombre: "Entregado", final: true },
];

/** La configuración inicial: la foto del aspecto inicial para ingresar y la de «Funcionando» para Finalizado. */
export const tallerV1: DefinicionFlujo = {
  id: "orden-taller",
  version: 1,
  nombre: "Equipo en el taller",
  estadoInicial: "sin_ingresar",
  estados: estadosTaller,
  transiciones: [
    { id: "ingresar", accion: "orden.ingresar", desde: ["sin_ingresar"], hacia: "en_taller", requisitos: foto("INGRESO") },
    { id: "revisar", accion: AVANZAR, desde: ["en_taller"], hacia: "en_revision" },
    { id: "reparar", accion: AVANZAR, desde: ["en_revision"], hacia: "en_reparacion" },
    { id: "esperar_repuesto", accion: "orden.esperar-repuesto", desde: ["en_revision", "en_reparacion"], hacia: "esperando_repuesto" },
    { id: "llego_repuesto", accion: AVANZAR, desde: ["esperando_repuesto"], hacia: "en_reparacion" },
    { id: "testear", accion: AVANZAR, desde: ["en_reparacion"], hacia: "en_testeo" },
    { id: "finalizar", accion: AVANZAR, desde: ["en_testeo"], hacia: "finalizado", requisitos: foto("FUNCIONANDO") },
    { id: "entregar", accion: AVANZAR, desde: ["finalizado"], hacia: "entregado" },
    { id: "sacar", accion: "orden.sacar", desde: "*", excepto: ["sin_ingresar", "entregado"], hacia: "sin_ingresar" },
  ],
};

/** Con las reglas nuevas. Las órdenes que arrancaron en la v1 siguen en la v1. */
export const tallerV2: DefinicionFlujo = {
  ...tallerV1,
  version: 2,
  estados: estadosTaller.map((e) =>
    e.id === "finalizado"
      ? { ...e, alEntrar: [{ efecto: "notificar", params: { destinatario: "mostrador", mensaje: "Equipo listo: avisar al cliente." } }] }
      : e,
  ),
  decisiones: [
    {
      id: "faltan_repuestos",
      nombre: "¿Faltan repuestos?",
      ramas: [{ si: { condicion: "orden.repuestos-pendientes" }, hacia: "esperando_repuesto" }],
      sino: "en_reparacion",
    },
  ],
  transiciones: tallerV1.transiciones.map((t) => {
    switch (t.id) {
      case "ingresar":
        // Fotos por paso: la etiqueta y el aspecto inicial, al empezar.
        return { ...t, requisitos: { todas: [foto("ETIQUETA"), foto("INGRESO")] } };
      case "reparar":
        // Al terminar la revisión, el flujo decide solo si espera repuestos.
        return { ...t, id: "diagnosticar", hacia: "faltan_repuestos" };
      case "finalizar":
        return {
          ...t,
          requisitos: {
            todas: [
              foto("FUNCIONANDO"),
              // Prueba extra: si la orden lleva una batería, la prueba de carga y la de temperatura.
              { si: { condicion: "orden.lleva-pieza-de-lista", params: { lista: "baterias" } }, entonces: { todas: [foto("PRUEBA_CARGA"), foto("PRUEBA_TEMPERATURA")] } },
            ],
          },
          // Desperfecto y reparación, sugeridas (pasarlas a `requisitos` las vuelve obligatorias).
          sugerencias: { todas: [foto("DESPERFECTO"), foto("REPARACION")] },
        };
      default:
        return t;
    }
  }).concat([
    {
      id: "agregar_pieza",
      accion: "orden.agregar-pieza",
      desde: "*",
      excepto: ["entregado"],
      efectos: [
        {
          efecto: "notificar",
          si: { condicion: "entrada.pieza-en-lista", params: { lista: "baterias" } },
          params: { destinatario: "tecnico", mensaje: "Esta orden lleva una batería: subí la foto de la prueba de carga y la de temperatura." },
        },
      ],
    },
  ]),
};

const estadosFormulario: DefinicionFlujo["estados"] = [
  { id: "borrador", nombre: "Borrador" },
  { id: "terminado", nombre: "Terminado", final: true },
];

/** La configuración inicial: para terminar alcanza con el estado del equipo. */
export const formularioV1: DefinicionFlujo = {
  id: "formulario-conformidad",
  version: 1,
  nombre: "Formulario de conformidad",
  estadoInicial: "borrador",
  estados: estadosFormulario,
  transiciones: [
    { id: "terminar", accion: "formulario.terminar", desde: ["borrador"], hacia: "terminado", requisitos: campo("estado") },
    // Se sigue pudiendo completar después de terminado.
    { id: "editar", accion: "formulario.editar", desde: "*" },
  ],
};

/** Firma obligatoria: el formulario está hecho cuando tiene la firma del cliente. */
export const formularioV2: DefinicionFlujo = {
  ...formularioV1,
  version: 2,
  transiciones: formularioV1.transiciones.map((t) =>
    t.id === "terminar" ? { ...t, requisitos: { todas: [campo("estado"), campo("firma_cliente")] } } : t,
  ),
};

export const versionesTaller = [tallerV1, tallerV2];
export const versionesFormulario = [formularioV1, formularioV2];
