/**
 * El ejemplo mínimo del README, con un registro de juguete. `test/ejemplos.test.ts` lo corre, así no se desactualiza.
 */
import { crearRegistro, type DefinicionFlujo } from "../src/index.js";

export type ContextoPedido = { pedido: { items: number; pagado: boolean } };

export const registro = crearRegistro<ContextoPedido>([
  {
    nombre: "tienda de juguete",
    capacidades: [
      { id: "pedido.confirmar", nombre: "Confirmar pedido", tipo: "accion" },
      { id: "pedido.entregar", nombre: "Entregar", tipo: "accion" },
      { id: "pedido.cancelar", nombre: "Cancelar", tipo: "accion" },
      {
        id: "pedido.tiene-items",
        nombre: "Tiene ítems",
        tipo: "condicion",
        texto: { cumple: "El pedido tiene ítems", noCumple: "El pedido no tiene ítems" },
        evaluar: (_params, ctx) => ctx.pedido.items > 0,
      },
      {
        id: "pedido.pagado",
        nombre: "Pagado",
        tipo: "condicion",
        texto: { cumple: "El pedido está pagado", noCumple: "Falta el pago" },
        evaluar: (_params, ctx) => ctx.pedido.pagado,
      },
      {
        id: "avisar",
        nombre: "Avisar",
        tipo: "efecto",
        schemaEntrada: { type: "object", properties: { a: { type: "string" } }, required: ["a"], additionalProperties: false },
      },
    ],
  },
]);

export const pedido: DefinicionFlujo = {
  id: "pedido",
  version: 1,
  nombre: "Pedido",
  estadoInicial: "borrador",
  estados: [
    { id: "borrador", nombre: "Borrador" },
    { id: "confirmado", nombre: "Confirmado" },
    { id: "entregado", nombre: "Entregado", final: true },
    { id: "cancelado", nombre: "Cancelado", final: true },
  ],
  transiciones: [
    { id: "confirmar", accion: "pedido.confirmar", desde: ["borrador"], hacia: "confirmado", requisitos: { condicion: "pedido.tiene-items" } },
    {
      id: "entregar",
      accion: "pedido.entregar",
      desde: ["confirmado"],
      hacia: "entregado",
      requisitos: { condicion: "pedido.pagado" },
      efectos: [{ efecto: "avisar", params: { a: "cliente" } }],
    },
    { id: "cancelar", accion: "pedido.cancelar", desde: ["borrador", "confirmado"], hacia: "cancelado" },
  ],
};
