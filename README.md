# ts-workflow-core

**Configurable workflow engine for TypeScript, as a pure library.** Your app declares its capabilities (actions, conditions and effects, each with a JSON Schema) and a workflow definition (plain JSON: states, decision nodes and transitions with requirements) combines them. The engine tells you which actions are allowed, why the others are blocked and where each one leads; it also validates the graph and simulates scenarios. No IO, versioned definitions, a single dependency (`zod`), runs in Node and in the browser. The API and its messages are in Spanish, and so is the rest of this README.

---

Motor de flujos configurables, como librería. Una app declara sus **capacidades** (acciones, condiciones y efectos, con JSON Schema). Con eso, quien usa la app define sus reglas como un diagrama: estados, decisiones y transiciones con requisitos. El motor dice **qué se puede hacer, por qué no y adónde lleva cada acción**. También valida el grafo y simula escenarios.

- **Puro:** no hace IO ni guarda nada. La app carga el contexto, persiste el estado y ejecuta los efectos, en su transacción.
- **Vocabulario cerrado:** las reglas combinan capacidades registradas. No hay código ni expresiones libres.
- **Restringe, no habilita:** la app suma sus propias reglas (permisos, facturación, stock). Una acción se puede hacer si la permiten las dos.
- **Versionado:** cada instancia se evalúa con la versión del flujo con la que arrancó.
- **Una sola dependencia:** `zod`. Anda en Node y en el navegador.

El diseño completo está en [`docs/diseno.md`](docs/diseno.md). Qué entra al core y qué no (es agnóstico: las capacidades y las reglas de cada negocio van en su app) está en [`POLITICA.md`](POLITICA.md).

## Cómo probarlo

```bash
git clone https://github.com/EasyIndustry/ts-workflow-core.git
cd ts-workflow-core
npm ci
npm test          # los tests (vitest)
npm run ejemplo   # el ejemplo del taller, por consola
```

`npm run ejemplo` corre [`ejemplos/taller/demo.ts`](ejemplos/taller/demo.ts): un taller de servicio técnico con firma obligatoria, fotos por paso y una prueba extra si la orden lleva cierta pieza (una batería). Muestra, en distintos momentos de una orden, qué acciones quedan permitidas o bloqueadas y por qué:

```text
▸ En testeo: se le cambió la batería y solo tiene la foto de «Funcionando»
  Equipo en el taller v2, estado «En testeo»
  ✓ PERMITIDA  Sacar del taller → Sin ingresar
  ✓ PERMITIDA  Agregar pieza (no cambia de estado)
  ✗ BLOQUEADA  Avanzar estado
      porque: Como la orden lleva una batería: falta la foto «Prueba de carga»
      porque: Como la orden lleva una batería: falta la foto «Prueba de temperatura»

▸ La misma orden con batería, pero abierta con la configuración vieja (v1)
  Equipo en el taller v1, estado «En testeo»
  ✓ PERMITIDA  Avanzar estado → Finalizado
  ✓ PERMITIDA  Sacar del taller → Sin ingresar
```

Después explica un bloqueo («¿por qué no puedo pasar a Finalizado?»), dibuja los casilleros y simula tres escenarios completos. El registro, los flujos y los escenarios están en [`ejemplos/taller/`](ejemplos/taller/), y `test/ejemplos.test.ts` los corre, así que no se desactualizan.

## Instalación en otro proyecto

No se publica en npm: se instala desde GitHub. `dist/` (JavaScript con sus `.d.ts`) está versionado en el repo, así que no hay build al instalar.

```bash
npm i github:EasyIndustry/ts-workflow-core          # la última de main
npm i github:EasyIndustry/ts-workflow-core#v0.1.0   # fijado a un tag (recomendado)
```

```ts
import { crearRegistro, evaluar, explicar } from "ts-workflow-core";
```

Es un paquete ESM (`"type": "module"`) y pide Node 20 o más.

## Ejemplo mínimo

```ts
import { crearRegistro, evaluar, explicar, iniciarInstancia, validarDefinicion, type DefinicionFlujo } from "ts-workflow-core";

type Ctx = { pedido: { items: number; pagado: boolean } };

// 1. La app declara lo que sabe hacer.
const registro = crearRegistro<Ctx>([
  {
    nombre: "tienda",
    capacidades: [
      { id: "pedido.confirmar", nombre: "Confirmar pedido", tipo: "accion" },
      { id: "pedido.entregar", nombre: "Entregar", tipo: "accion" },
      { id: "pedido.cancelar", nombre: "Cancelar", tipo: "accion" },
      {
        id: "pedido.tiene-items", nombre: "Tiene ítems", tipo: "condicion",
        texto: { cumple: "El pedido tiene ítems", noCumple: "El pedido no tiene ítems" },
        evaluar: (_params, ctx) => ctx.pedido.items > 0,
      },
      {
        id: "pedido.pagado", nombre: "Pagado", tipo: "condicion",
        texto: { cumple: "El pedido está pagado", noCumple: "Falta el pago" },
        evaluar: (_params, ctx) => ctx.pedido.pagado,
      },
      { id: "avisar", nombre: "Avisar", tipo: "efecto",
        schemaEntrada: { type: "object", properties: { a: { type: "string" } }, required: ["a"], additionalProperties: false } },
    ],
  },
]);

// 2. Quien usa la app define el flujo (JSON).
const pedido: DefinicionFlujo = {
  id: "pedido", version: 1, nombre: "Pedido", estadoInicial: "borrador",
  estados: [
    { id: "borrador", nombre: "Borrador" },
    { id: "confirmado", nombre: "Confirmado" },
    { id: "entregado", nombre: "Entregado", final: true },
    { id: "cancelado", nombre: "Cancelado", final: true },
  ],
  transiciones: [
    { id: "confirmar", accion: "pedido.confirmar", desde: ["borrador"], hacia: "confirmado",
      requisitos: { condicion: "pedido.tiene-items" } },
    { id: "entregar", accion: "pedido.entregar", desde: ["confirmado"], hacia: "entregado",
      requisitos: { condicion: "pedido.pagado" }, efectos: [{ efecto: "avisar", params: { a: "cliente" } }] },
    { id: "cancelar", accion: "pedido.cancelar", desde: ["borrador", "confirmado"], hacia: "cancelado" },
  ],
};

// 3. Se valida antes de publicar.
validarDefinicion(pedido, registro); // { valido: true, errores: [], avisos: [] }

// 4. En cada instancia: qué se puede hacer y por qué no.
const instancia = iniciarInstancia(pedido); // { version: 1, estado: "borrador" }
const ctx = { pedido: { items: 0, pagado: false } };
evaluar(pedido, instancia, ctx, registro);
// permitidas: [{ accion: "pedido.cancelar", destino: "cancelado", efectos: [] , ... }]
// bloqueadas: [{ accion: "pedido.confirmar", motivos: ["El pedido no tiene ítems"], requisitos: {...} }]
explicar(pedido, instancia, ctx, registro, "pedido.confirmar").texto;
// "No podés «Confirmar pedido» desde «Borrador»: el pedido no tiene ítems."
```

El mismo código está en [`ejemplos/juguete.ts`](ejemplos/juguete.ts) y lo corre `test/ejemplos.test.ts`.

## La definición

| Elemento | Qué es |
|---|---|
| `estados[]` | `id`, `nombre`, `final?` (el proceso puede terminar acá) y `alEntrar?` (efectos al llegar). |
| `decisiones[]` | Rombo: `ramas[{ si, hacia }]` en orden y `sino` obligatorio. |
| `transiciones[]` | `accion` (del registro), `desde` (lista o `"*"` con `excepto?`), `hacia?` (estado o decisión; si falta, no cambia de estado), `requisitos?` (bloquean), `sugerencias?` (no bloquean), `efectos?` y `nombre?`. Desde un estado, cada acción tiene a lo sumo una transición. |
| Condiciones | Hoja `{ condicion, params?, mensaje? }`, `{ todas: [...] }`, `{ alguna: [...] }`, `{ no: c }` y `{ si: c1, entonces: c2 }`. Cualquier nodo acepta `mensaje`. |
| Efectos | `{ efecto, params?, si? }`. Se devuelven los de la transición y después los `alEntrar` del destino. |

El schema es `definicionSchema` (zod), y `definicionJsonSchema()` devuelve el JSON Schema para un editor.

## API

| Función | Qué hace |
|---|---|
| `crearRegistro(proveedores)` | Arma el registro. Falla con ids repetidos o capacidades mal declaradas. `registro.descriptores()` devuelve el JSON para un editor. |
| `validarDefinicion(def, registro?, opciones?)` | Schema, referencias, ciclos de decisiones, transiciones ambiguas, estados inalcanzables, callejones y, con registro, capacidades y params. Devuelve `{ valido, errores, avisos, definicion }` con mensajes en castellano y la ruta de cada problema. |
| `evaluar(flujo, instancia, contexto, registro)` | `{ permitidas[{ destino, recorrido, efectos, requisitos, sugerencias }], bloqueadas[{ motivos, requisitos }] }`. `flujo` puede ser una definición o la lista de sus versiones. |
| `explicar(flujo, instancia, contexto, registro, accion?)` | El texto de «por qué no puedo», para una acción o para todas las del estado. |
| `simular(flujo, escenario, registro)` | Recorre pasos `{ accion, contexto?, espera? }` sin ejecutar nada; `ok` dice si se cumplió todo lo esperado. |
| `casilleros(resultado)` | Las hojas que aplican de un árbol evaluado, para dibujarlas como checklist. |
| `elegirVersion`, `ultimaVersion`, `iniciarInstancia` | Versionado: una instancia nueva arranca en la última versión y después se evalúa siempre con la suya. |
| `validarJsonSchema(valor, esquema)` | El subconjunto de JSON Schema que usa el validador (type, required, properties, additionalProperties, enum, const, oneOf/anyOf, items, largos, mínimos y máximos, pattern). Se reemplaza con `opciones.validarEsquema`. |

Los errores de uso (una versión que no está, una condición que no existe en el registro, una condición que tira una excepción) son `ErrorFlujo`, con `codigo`.

## El registro

```ts
interface DescriptorCapacidad {
  id: string;                      // "orden.cerrar", "foto.tiene"
  nombre: string;
  tipo: "accion" | "condicion" | "efecto";
  descripcion?: string;
  schemaEntrada?: JsonSchema;      // params de condición/efecto, o input de la acción
  texto?: { cumple: string; noCumple: string };   // "Falta la foto «{momento}»"
  grupo?: string;
}
// Las condiciones agregan: evaluar(params, contexto): boolean  (pura)
```

Las plantillas `{param}` usan el rótulo del schema cuando existe: con `oneOf: [{ "const": "FUNCIONANDO", "title": "Funcionando" }]` se muestra «Funcionando».

## Límite de dependencias

Solo `zod`. Hay dos controles:

- **`test/limites.test.ts`** es una lista blanca: `src/` solo importa `zod` y sus propios archivos (ni `node:*`), y `dependencies` es exactamente `zod`.
- **`tsconfig.json` de `src` con `types: []`**: sin tipos de Node, `process` o `Buffer` no compilan.

## Desarrollo

```bash
npm test                # vitest
npm run test:cobertura  # con cobertura (mínimos en vitest.config.ts)
npm run typecheck       # src sin Node + tests y ejemplos
npm run build           # regenera dist/ con .d.ts
npm run ejemplo         # el ejemplo del taller
```

`dist/` va en el repo para que se pueda instalar desde GitHub sin build. Si cambiás `src/`, corré `npm run build` y commiteá `dist/` junto con el cambio: el CI falla si `dist/` no coincide con el build.

## Contribuir

Un pedido pasa por el filtro de [`POLITICA.md`](POLITICA.md): entra lo que sirve para cualquier dominio; la lógica de negocio, los nombres de clientes y las capacidades concretas quedan en cada app. Cómo proponer y cómo se revisa, en [`CONTRIBUTING.md`](CONTRIBUTING.md). Los issues usan las plantillas *Pedido* y *Error*.

## Licencia

[MIT](LICENSE), © EasyIndustry.
