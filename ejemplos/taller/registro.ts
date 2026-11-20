/**
 * Registro de ejemplo de un taller de servicio técnico. No está conectado a nada: es lo que una app armaría al arrancar
 * con sus acciones (lo que ya sabe hacer) y con sus proveedores de condiciones y efectos.
 *
 * Las condiciones son vocabulario genérico: sirven para esta regla y para la próxima. Las reglas (dónde se cuelga cada
 * una) están en ./flujos.ts, como configuración.
 */
import { crearRegistro, type Proveedor } from "../../src/index.js";

/** Lo que la app cargaría de su base, dentro de su transacción, antes de evaluar. */
export interface ContextoTaller {
  orden?: { fotos: string[]; piezas: string[]; repuestosPendientes: number };
  formulario?: { respuestas: Record<string, unknown> };
  /** Listas que se editan en la configuración de la app (por ejemplo, los códigos de batería). No van en la definición. */
  listas: Record<string, string[]>;
  /** El input de la acción que se está ejecutando. */
  entrada?: { codigoPieza?: string } | null;
}

/** Las fotos que se sacan en cada paso de la reparación. */
const MOMENTOS = [
  { const: "ETIQUETA", title: "Etiqueta del equipo" },
  { const: "INGRESO", title: "Aspecto inicial" },
  { const: "DESPERFECTO", title: "Desperfecto" },
  { const: "REPARACION", title: "Reparación" },
  { const: "FUNCIONANDO", title: "Funcionando" },
  { const: "ENTREGA", title: "Entrega" },
  { const: "PRUEBA_CARGA", title: "Prueba de carga" },
  { const: "PRUEBA_TEMPERATURA", title: "Prueba de temperatura" },
];

const LISTAS = [{ const: "baterias", title: "una batería" }];

const CAMPOS_FORMULARIO = [
  { const: "estado", title: "Estado del equipo" },
  { const: "firma_cliente", title: "Firma del cliente" },
  { const: "firma_tecnico", title: "Firma del técnico" },
];

const objeto = (properties: Record<string, unknown>, required: string[]) => ({ type: "object", properties, required, additionalProperties: false });

/** Las acciones que la app ya tiene (botones o endpoints). El core solo necesita su id, su nombre y su input. */
const acciones: Proveedor<ContextoTaller> = {
  nombre: "acciones del taller",
  capacidades: [
    { id: "orden.ingresar", nombre: "Ingresar al taller", tipo: "accion", grupo: "Taller" },
    {
      id: "orden.avanzar",
      nombre: "Avanzar estado",
      tipo: "accion",
      grupo: "Taller",
      schemaEntrada: { type: "object", properties: { nota: { type: "string" } }, additionalProperties: false },
    },
    { id: "orden.esperar-repuesto", nombre: "Esperar repuesto", tipo: "accion", grupo: "Taller" },
    { id: "orden.sacar", nombre: "Sacar del taller", tipo: "accion", grupo: "Taller" },
    { id: "orden.agregar-pieza", nombre: "Agregar pieza", tipo: "accion", grupo: "Piezas" },
    { id: "formulario.terminar", nombre: "Terminar formulario", tipo: "accion", grupo: "Formularios" },
    { id: "formulario.editar", nombre: "Editar formulario", tipo: "accion", grupo: "Formularios" },
  ],
};

const condiciones: Proveedor<ContextoTaller> = {
  nombre: "condiciones del taller",
  capacidades: [
    {
      id: "foto.tiene",
      nombre: "Tiene la foto",
      tipo: "condicion",
      grupo: "Fotos",
      descripcion: "La orden tiene al menos una foto de ese momento.",
      schemaEntrada: objeto({ momento: { type: "string", oneOf: MOMENTOS } }, ["momento"]),
      texto: { cumple: "Tiene la foto «{momento}»", noCumple: "Falta la foto «{momento}»" },
      evaluar: (p, ctx) => (ctx.orden?.fotos ?? []).includes(String(p.momento)),
    },
    {
      id: "orden.lleva-pieza-de-lista",
      nombre: "Lleva una pieza de la lista",
      tipo: "condicion",
      grupo: "Piezas",
      descripcion: "Alguna pieza de la orden tiene un código de la lista (la lista se edita en la configuración de la app).",
      schemaEntrada: objeto({ lista: { type: "string", oneOf: LISTAS } }, ["lista"]),
      texto: { cumple: "La orden lleva {lista}", noCumple: "La orden no lleva {lista}" },
      evaluar: (p, ctx) => {
        const codigos = ctx.listas[String(p.lista)] ?? [];
        return (ctx.orden?.piezas ?? []).some((c) => codigos.includes(c));
      },
    },
    {
      id: "entrada.pieza-en-lista",
      nombre: "La pieza que se agrega es de la lista",
      tipo: "condicion",
      grupo: "Piezas",
      schemaEntrada: objeto({ lista: { type: "string", oneOf: LISTAS } }, ["lista"]),
      texto: { cumple: "La pieza que se agrega es {lista}", noCumple: "La pieza que se agrega no es {lista}" },
      evaluar: (p, ctx) => (ctx.listas[String(p.lista)] ?? []).includes(ctx.entrada?.codigoPieza ?? ""),
    },
    {
      id: "orden.repuestos-pendientes",
      nombre: "Hay repuestos pendientes",
      tipo: "condicion",
      grupo: "Piezas",
      texto: { cumple: "Hay repuestos pedidos que no llegaron", noCumple: "No hay repuestos pendientes" },
      evaluar: (_p, ctx) => (ctx.orden?.repuestosPendientes ?? 0) > 0,
    },
    {
      id: "formulario.campo-completo",
      nombre: "Campo completo",
      tipo: "condicion",
      grupo: "Formularios",
      descripcion: "El campo tiene un valor: un texto vacío («») cuenta como vacío, que es lo que `required` no frena.",
      schemaEntrada: objeto({ campo: { type: "string", oneOf: CAMPOS_FORMULARIO } }, ["campo"]),
      texto: { cumple: "«{campo}» está completo", noCumple: "Falta «{campo}»" },
      evaluar: (p, ctx) => {
        const valor = ctx.formulario?.respuestas[String(p.campo)];
        return valor !== undefined && valor !== null && !(typeof valor === "string" && valor.trim() === "");
      },
    },
  ],
};

const efectos: Proveedor<ContextoTaller> = {
  nombre: "efectos del taller",
  capacidades: [
    {
      id: "notificar",
      nombre: "Notificar",
      tipo: "efecto",
      schemaEntrada: objeto(
        {
          destinatario: { type: "string", oneOf: [{ const: "tecnico", title: "Técnico asignado" }, { const: "mostrador", title: "Mostrador" }] },
          mensaje: { type: "string", minLength: 1 },
        },
        ["destinatario", "mensaje"],
      ),
    },
  ],
};

export const registroTaller = crearRegistro<ContextoTaller>([acciones, condiciones, efectos]);
