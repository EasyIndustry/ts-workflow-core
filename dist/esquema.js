import { z } from "zod";
const identificador = z
    .string()
    .min(1)
    .regex(/^[A-Za-z0-9_.:-]+$/, "solo letras, números y los signos _ . : -");
const texto = z.string().min(1);
const params = z.record(z.string(), z.unknown());
const mensaje = texto.optional().describe("Texto que reemplaza al generado cuando esta condición bloquea.");
export const condicionSchema = z.lazy(() => z.union([
    z.strictObject({ condicion: identificador, params: params.optional(), mensaje }),
    z.strictObject({ todas: z.array(condicionSchema).min(1), mensaje }),
    z.strictObject({ alguna: z.array(condicionSchema).min(1), mensaje }),
    z.strictObject({ no: condicionSchema, mensaje }),
    z.strictObject({ si: condicionSchema, entonces: condicionSchema, mensaje }),
]));
export const efectoSchema = z.strictObject({
    efecto: identificador.describe("Id de una capacidad de tipo efecto."),
    params: params.optional(),
    si: condicionSchema.optional().describe("Si está, el efecto solo se produce cuando se cumple."),
});
export const estadoSchema = z.strictObject({
    id: identificador,
    nombre: texto,
    descripcion: z.string().optional(),
    final: z.boolean().optional().describe("El proceso puede terminar acá. Puede tener salidas (por ejemplo, re-abrir)."),
    alEntrar: z.array(efectoSchema).optional().describe("Efectos al llegar a este estado desde otro."),
});
export const decisionSchema = z.strictObject({
    id: identificador,
    nombre: texto,
    descripcion: z.string().optional(),
    ramas: z.array(z.strictObject({ si: condicionSchema, hacia: identificador })).min(1).describe("Se prueban en orden; gana la primera que se cumple."),
    sino: identificador.describe("Destino si ninguna rama se cumple. Obligatorio: una decisión siempre resuelve."),
});
export const transicionSchema = z.strictObject({
    id: identificador,
    accion: identificador.describe("Id de una capacidad de tipo acción."),
    nombre: texto.optional().describe("Rótulo del botón; si falta, se usa el nombre de la acción en el registro."),
    desde: z.union([z.literal("*"), z.array(identificador).min(1)]).describe('Estados desde los que se puede hacer, o "*" para todos.'),
    excepto: z.array(identificador).optional().describe('Con desde "*": estados excluidos.'),
    hacia: identificador.optional().describe("Estado o decisión destino. Si falta, la acción no cambia de estado."),
    requisitos: condicionSchema.optional().describe("Si no se cumplen, la acción queda bloqueada."),
    sugerencias: condicionSchema.optional().describe("Se evalúan y se muestran, pero no bloquean."),
    efectos: z.array(efectoSchema).optional(),
});
export const reaccionSchema = z.strictObject({
    id: identificador,
    evento: identificador.describe("Id de una capacidad de tipo evento."),
    params: params.optional().describe("Qué ocurrencia del evento escucha: se compara entera con los params del evento."),
    desde: z.union([z.literal("*"), z.array(identificador).min(1)]).describe('Estados en los que escucha, o "*" para todos.'),
    excepto: z.array(identificador).optional().describe('Con desde "*": estados excluidos.'),
    si: condicionSchema.optional().describe("Si está, la reacción solo aplica cuando se cumple."),
    transicion: identificador.optional().describe("Transición a intentar. Pasa por sus requisitos: una reacción no abre nada que la transición cierre."),
    efectos: z.array(efectoSchema).optional(),
});
export const definicionSchema = z.strictObject({
    id: identificador,
    version: z.number().int().min(1),
    nombre: texto,
    descripcion: z.string().optional(),
    estadoInicial: identificador,
    estados: z.array(estadoSchema).min(1),
    decisiones: z.array(decisionSchema).optional(),
    transiciones: z.array(transicionSchema),
    reacciones: z.array(reaccionSchema).optional().describe("Qué hace el flujo cuando llega un evento de afuera."),
    metadatos: z.record(z.string(), z.unknown()).optional().describe("Libre para el editor (posiciones, colores). El intérprete no lo mira."),
});
/** Mensajes de zod en castellano, solo para este parseo (no se toca la configuración global de zod de la app). */
const enCastellano = z.locales.es().localeError;
export function parsearDefinicion(valor) {
    return definicionSchema.safeParse(valor, { error: enCastellano });
}
/** JSON Schema de la definición, para el editor o para validar fuera de TypeScript. */
export function definicionJsonSchema() {
    return z.toJSONSchema(definicionSchema);
}
//# sourceMappingURL=esquema.js.map