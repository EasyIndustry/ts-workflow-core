import { z } from "zod";
/**
 * Schema de la definición de un flujo. Es la fuente de verdad del formato: los tipos de TypeScript salen de acá
 * (`z.infer`) y el JSON Schema para el editor también (`definicionJsonSchema`).
 */
export type Params = Record<string, unknown>;
/** Árbol de condiciones: hojas del registro combinadas con todas (AND), alguna (OR), no (NOT) y si/entonces (implicación). */
export type Condicion = {
    condicion: string;
    params?: Params | undefined;
    mensaje?: string | undefined;
} | {
    todas: Condicion[];
    mensaje?: string | undefined;
} | {
    alguna: Condicion[];
    mensaje?: string | undefined;
} | {
    no: Condicion;
    mensaje?: string | undefined;
} | {
    si: Condicion;
    entonces: Condicion;
    mensaje?: string | undefined;
};
export declare const condicionSchema: z.ZodType<Condicion>;
export declare const efectoSchema: z.ZodObject<{
    efecto: z.ZodString;
    params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    si: z.ZodOptional<z.ZodType<Condicion, unknown, z.core.$ZodTypeInternals<Condicion, unknown>>>;
}, z.core.$strict>;
export declare const estadoSchema: z.ZodObject<{
    id: z.ZodString;
    nombre: z.ZodString;
    descripcion: z.ZodOptional<z.ZodString>;
    final: z.ZodOptional<z.ZodBoolean>;
    alEntrar: z.ZodOptional<z.ZodArray<z.ZodObject<{
        efecto: z.ZodString;
        params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        si: z.ZodOptional<z.ZodType<Condicion, unknown, z.core.$ZodTypeInternals<Condicion, unknown>>>;
    }, z.core.$strict>>>;
}, z.core.$strict>;
export declare const decisionSchema: z.ZodObject<{
    id: z.ZodString;
    nombre: z.ZodString;
    descripcion: z.ZodOptional<z.ZodString>;
    ramas: z.ZodArray<z.ZodObject<{
        si: z.ZodType<Condicion, unknown, z.core.$ZodTypeInternals<Condicion, unknown>>;
        hacia: z.ZodString;
    }, z.core.$strict>>;
    sino: z.ZodString;
}, z.core.$strict>;
export declare const transicionSchema: z.ZodObject<{
    id: z.ZodString;
    accion: z.ZodString;
    nombre: z.ZodOptional<z.ZodString>;
    desde: z.ZodUnion<readonly [z.ZodLiteral<"*">, z.ZodArray<z.ZodString>]>;
    excepto: z.ZodOptional<z.ZodArray<z.ZodString>>;
    hacia: z.ZodOptional<z.ZodString>;
    requisitos: z.ZodOptional<z.ZodType<Condicion, unknown, z.core.$ZodTypeInternals<Condicion, unknown>>>;
    sugerencias: z.ZodOptional<z.ZodType<Condicion, unknown, z.core.$ZodTypeInternals<Condicion, unknown>>>;
    efectos: z.ZodOptional<z.ZodArray<z.ZodObject<{
        efecto: z.ZodString;
        params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        si: z.ZodOptional<z.ZodType<Condicion, unknown, z.core.$ZodTypeInternals<Condicion, unknown>>>;
    }, z.core.$strict>>>;
}, z.core.$strict>;
export declare const definicionSchema: z.ZodObject<{
    id: z.ZodString;
    version: z.ZodNumber;
    nombre: z.ZodString;
    descripcion: z.ZodOptional<z.ZodString>;
    estadoInicial: z.ZodString;
    estados: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        nombre: z.ZodString;
        descripcion: z.ZodOptional<z.ZodString>;
        final: z.ZodOptional<z.ZodBoolean>;
        alEntrar: z.ZodOptional<z.ZodArray<z.ZodObject<{
            efecto: z.ZodString;
            params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            si: z.ZodOptional<z.ZodType<Condicion, unknown, z.core.$ZodTypeInternals<Condicion, unknown>>>;
        }, z.core.$strict>>>;
    }, z.core.$strict>>;
    decisiones: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        nombre: z.ZodString;
        descripcion: z.ZodOptional<z.ZodString>;
        ramas: z.ZodArray<z.ZodObject<{
            si: z.ZodType<Condicion, unknown, z.core.$ZodTypeInternals<Condicion, unknown>>;
            hacia: z.ZodString;
        }, z.core.$strict>>;
        sino: z.ZodString;
    }, z.core.$strict>>>;
    transiciones: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        accion: z.ZodString;
        nombre: z.ZodOptional<z.ZodString>;
        desde: z.ZodUnion<readonly [z.ZodLiteral<"*">, z.ZodArray<z.ZodString>]>;
        excepto: z.ZodOptional<z.ZodArray<z.ZodString>>;
        hacia: z.ZodOptional<z.ZodString>;
        requisitos: z.ZodOptional<z.ZodType<Condicion, unknown, z.core.$ZodTypeInternals<Condicion, unknown>>>;
        sugerencias: z.ZodOptional<z.ZodType<Condicion, unknown, z.core.$ZodTypeInternals<Condicion, unknown>>>;
        efectos: z.ZodOptional<z.ZodArray<z.ZodObject<{
            efecto: z.ZodString;
            params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            si: z.ZodOptional<z.ZodType<Condicion, unknown, z.core.$ZodTypeInternals<Condicion, unknown>>>;
        }, z.core.$strict>>>;
    }, z.core.$strict>>;
    metadatos: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strict>;
export type Efecto = z.infer<typeof efectoSchema>;
export type Estado = z.infer<typeof estadoSchema>;
export type Decision = z.infer<typeof decisionSchema>;
export type Transicion = z.infer<typeof transicionSchema>;
export type DefinicionFlujo = z.infer<typeof definicionSchema>;
export declare function parsearDefinicion(valor: unknown): z.ZodSafeParseResult<{
    id: string;
    version: number;
    nombre: string;
    estadoInicial: string;
    estados: {
        id: string;
        nombre: string;
        descripcion?: string | undefined;
        final?: boolean | undefined;
        alEntrar?: {
            efecto: string;
            params?: Record<string, unknown> | undefined;
            si?: Condicion | undefined;
        }[] | undefined;
    }[];
    transiciones: {
        id: string;
        accion: string;
        desde: "*" | string[];
        nombre?: string | undefined;
        excepto?: string[] | undefined;
        hacia?: string | undefined;
        requisitos?: Condicion | undefined;
        sugerencias?: Condicion | undefined;
        efectos?: {
            efecto: string;
            params?: Record<string, unknown> | undefined;
            si?: Condicion | undefined;
        }[] | undefined;
    }[];
    descripcion?: string | undefined;
    decisiones?: {
        id: string;
        nombre: string;
        ramas: {
            si: Condicion;
            hacia: string;
        }[];
        sino: string;
        descripcion?: string | undefined;
    }[] | undefined;
    metadatos?: Record<string, unknown> | undefined;
}>;
/** JSON Schema de la definición, para el editor o para validar fuera de TypeScript. */
export declare function definicionJsonSchema(): z.core.ZodStandardJSONSchemaPayload<z.ZodObject<{
    id: z.ZodString;
    version: z.ZodNumber;
    nombre: z.ZodString;
    descripcion: z.ZodOptional<z.ZodString>;
    estadoInicial: z.ZodString;
    estados: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        nombre: z.ZodString;
        descripcion: z.ZodOptional<z.ZodString>;
        final: z.ZodOptional<z.ZodBoolean>;
        alEntrar: z.ZodOptional<z.ZodArray<z.ZodObject<{
            efecto: z.ZodString;
            params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            si: z.ZodOptional<z.ZodType<Condicion, unknown, z.core.$ZodTypeInternals<Condicion, unknown>>>;
        }, z.core.$strict>>>;
    }, z.core.$strict>>;
    decisiones: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        nombre: z.ZodString;
        descripcion: z.ZodOptional<z.ZodString>;
        ramas: z.ZodArray<z.ZodObject<{
            si: z.ZodType<Condicion, unknown, z.core.$ZodTypeInternals<Condicion, unknown>>;
            hacia: z.ZodString;
        }, z.core.$strict>>;
        sino: z.ZodString;
    }, z.core.$strict>>>;
    transiciones: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        accion: z.ZodString;
        nombre: z.ZodOptional<z.ZodString>;
        desde: z.ZodUnion<readonly [z.ZodLiteral<"*">, z.ZodArray<z.ZodString>]>;
        excepto: z.ZodOptional<z.ZodArray<z.ZodString>>;
        hacia: z.ZodOptional<z.ZodString>;
        requisitos: z.ZodOptional<z.ZodType<Condicion, unknown, z.core.$ZodTypeInternals<Condicion, unknown>>>;
        sugerencias: z.ZodOptional<z.ZodType<Condicion, unknown, z.core.$ZodTypeInternals<Condicion, unknown>>>;
        efectos: z.ZodOptional<z.ZodArray<z.ZodObject<{
            efecto: z.ZodString;
            params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            si: z.ZodOptional<z.ZodType<Condicion, unknown, z.core.$ZodTypeInternals<Condicion, unknown>>>;
        }, z.core.$strict>>>;
    }, z.core.$strict>>;
    metadatos: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strict>>;
