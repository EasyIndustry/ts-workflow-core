import type { Params } from "./esquema.js";
import type { DescriptorCapacidad } from "./registro.js";
/** Completa `{param}` con el valor de los params, usando el rótulo del schema si lo hay («FUNCIONANDO» → «Funcionando»). */
export declare function completarPlantilla(plantilla: string, params: Params, descriptor: DescriptorCapacidad | undefined): string;
/** La frase de una condición según se cumpla o no: la plantilla del registro o, si no tiene, una genérica con su nombre. */
export declare function fraseDeCondicion(descriptor: DescriptorCapacidad | undefined, id: string, params: Params, cumple: boolean): string;
export declare function minusculaInicial(s: string): string;
export declare function mayusculaInicial(s: string): string;
/** Con mayúscula inicial y punto final. */
export declare function oracion(s: string): string;
/** «a», «a y b», «a, b y c» (o con «o»). */
export declare function enumerar(partes: readonly string[], conjuncion?: "y" | "o"): string;
export declare function entreComillas(s: string): string;
