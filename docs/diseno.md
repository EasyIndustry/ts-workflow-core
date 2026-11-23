# Flujos configurables · Diseño del core

## Resumen

El core es una **librería pura en TypeScript**. Recibe una definición de flujo, el estado de una instancia, un contexto (datos) y un registro de capacidades. Devuelve **qué acciones se pueden hacer, por qué las otras no y adónde lleva cada una**. No hace IO, no guarda nada y no sabe qué es una orden de trabajo ni ninguna otra entidad de la app.

Cuatro reglas guían todo lo demás:

1. **Vocabulario cerrado.** Quien configura combina capacidades registradas (acciones, condiciones y efectos con JSON Schema). No escribe código ni expresiones. Por eso se puede validar, explicar y simular.
2. **El flujo restringe y enruta; nunca habilita.** Una acción se puede hacer si la permite el código (permisos, reglas duras, disponibilidad) **y** la permite el flujo. El flujo no puede abrir algo que el código cierra.
3. **Las versiones publicadas no cambian.** Cada instancia guarda la versión con la que arrancó y se evalúa siempre con esa.
4. **La app ejecuta; el core decide.** El core devuelve el destino y la lista de efectos. La app persiste el estado y ejecuta los efectos en su propia transacción.

---

## 1. Modelo de definición

Una definición es un JSON, validado con zod y exportable como JSON Schema (`definicionJsonSchema()`, con `z.toJSONSchema`). Describe el ciclo de vida de **una entidad en una dimensión**: una orden de trabajo puede tener dos flujos (el estado administrativo y el del equipo en el taller); un formulario, uno.

```json
{
  "id": "formulario-conformidad",
  "version": 2,
  "nombre": "Formulario de conformidad",
  "estadoInicial": "borrador",
  "estados": [
    { "id": "borrador", "nombre": "Borrador" },
    { "id": "terminado", "nombre": "Terminado", "final": true }
  ],
  "transiciones": [
    {
      "id": "terminar",
      "accion": "formulario.terminar",
      "desde": ["borrador"],
      "hacia": "terminado",
      "requisitos": { "condicion": "formulario.campo-completo", "params": { "campo": "firma_cliente" } }
    },
    { "id": "editar", "accion": "formulario.editar", "desde": "*" }
  ]
}
```

| Elemento | Qué es |
|---|---|
| `estados[]` | Nodos de estado: `id`, `nombre`, `final?` (el proceso puede terminar acá; puede tener salidas, como «re-abrir»), `alEntrar?` (efectos al llegar). |
| `decisiones[]` | Nodos de decisión (el rombo del diagrama): `ramas[{si, hacia}]` en orden y un `sino` obligatorio. Una decisión siempre resuelve. |
| `transiciones[]` | Nodos de acción (las flechas con nombre): `accion` (id de una capacidad de tipo acción), `desde` (lista de estados, o `"*"` con `excepto?`), `hacia?` (estado o decisión; si falta, la acción no cambia de estado), `requisitos?` (bloquean), `sugerencias?` (no bloquean, se muestran), `efectos?`, `nombre?` (rótulo del botón). |
| `metadatos?` | Libre para un editor (posiciones de los nodos, colores). El intérprete no lo mira. |

**Una acción por estado.** Desde un mismo estado, cada acción tiene a lo sumo una transición. Si según los datos tiene que ir a lugares distintos, se usa un nodo de decisión. Así «¿por qué no puedo?» siempre tiene una sola respuesta.

**Condiciones.** Un árbol con cinco formas. Cualquier nodo puede llevar `mensaje`, que reemplaza el texto generado cuando bloquea.

| Forma | Significado |
|---|---|
| `{ "condicion": "id", "params": {...} }` | Hoja: una condición del registro con sus parámetros. |
| `{ "todas": [c1, c2] }` | AND. Evalúa todas, para poder decir todo lo que falta. |
| `{ "alguna": [c1, c2] }` | OR. |
| `{ "no": c }` | NOT. |
| `{ "si": c1, "entonces": c2 }` | Implicación: si `c1` no se cumple, no exige nada y `c2` ni se evalúa. Es la forma natural de «si la orden lleva una batería, exigir…», y permite explicar con «Como…». |

**Efectos.** `{ "efecto": "id", "params": {...}, "si"?: condicion }`. Al hacer la transición se devuelven, en orden, los efectos de la transición y después los `alEntrar` del estado destino (si cambia de estado).

**Datos que cambian seguido no van en la definición.** La lista de códigos de batería la edita el taller cuando quiere, sin publicar una versión nueva del flujo. La condición recibe el *nombre* de la lista (`{ "lista": "baterias" }`) y la lee del contexto, que la app arma desde su configuración. En la definición va la regla, no el catálogo.

## 2. Contrato del registro de capacidades

```ts
type TipoCapacidad = "accion" | "condicion" | "efecto";

interface DescriptorCapacidad {          // serializable: lo usan el validador y el editor
  id: string;                            // estable, con espacio de nombres: "orden.cerrar"
  nombre: string;                        // "Cerrar orden"
  tipo: TipoCapacidad;
  descripcion?: string;
  schemaEntrada?: JsonSchema;            // params de la condición/efecto, o el input de la acción
  texto?: { cumple: string; noCumple: string };  // condiciones: "Falta la foto «{momento}»"
  grupo?: string;                        // para la paleta del editor
}

interface CapacidadCondicion<C> extends DescriptorCapacidad {
  tipo: "condicion";
  evaluar(params: Record<string, unknown>, contexto: C): boolean;   // pura, sin IO
}

interface Proveedor<C> { nombre: string; capacidades: readonly Capacidad<C>[] }

crearRegistro(proveedores: Proveedor<C>[]): Registro<C>
registro.descriptores(): DescriptorCapacidad[]    // JSON para el editor
```

- **Acciones y efectos son solo descriptores.** Su implementación vive en la app; el core solo verifica que existan y que los `params` cumplan el schema.
- **Las condiciones traen `evaluar`**, una función pura sobre el contexto. La app carga el contexto antes (en su transacción) y el core nunca toca la base.
- **Textos.** Las plantillas `{param}` se completan con los parámetros. Si el schema da rótulos con `oneOf: [{ "const": "FUNCIONANDO", "title": "Funcionando" }]`, se usa el rótulo. Así el editor y `explicar` dicen lo mismo.
- **Descubrimiento.** El motor solo conoce lo que está en el registro, y lo busca por `id`. No hay registro global ni reflexión: la app arma el registro al arrancar con sus proveedores, y un `id` repetido entre proveedores es un error.

**Cómo lo llena una app.** Si la app ya tiene un catálogo de sus acciones (por ejemplo, un endpoint de metadatos con módulo, nombre, título, descripción y el schema del input), el descriptor de cada acción sale directo de ahí: `id` = `modulo.nombre`, `nombre` = título, `schemaEntrada` = el schema del input. Las condiciones (`foto.tiene`, `formulario.campo-completo`, `orden.lleva-pieza-de-lista`…) y los efectos (`notificar`) los escribe la app una vez, como proveedores. Son genéricos y parametrizables: no son una regla de negocio cada uno.

## 3. API del intérprete (pura, sin IO)

```ts
validarDefinicion(def: unknown, registro?, opciones?) → { valido, errores[], avisos[], definicion? }

evaluar(flujo, instancia, contexto, registro) → {
  estado,
  permitidas: [{ accion, nombre, transicion, destino, recorrido[], efectos[], requisitos?, sugerencias? }],
  bloqueadas: [{ accion, nombre, transicion, motivos[], requisitos, sugerencias? }]
}

explicar(flujo, instancia, contexto, registro, accion?) → Explicacion | Explicacion[]
simular(flujo, escenario, registro) → { ok, estadoFinal, pasos[] }
```

- **La versión viaja en la instancia**, `instancia = { version, estado }`, junto con el estado actual. `flujo` puede ser una definición o la lista de todas sus versiones; el intérprete elige la que pide la instancia y falla si no está (§4).
- **El contexto es de la app.** Un objeto plano que el core le pasa sin mirar a las condiciones. Al ejecutar una acción, la app suma `entrada` (el input del botón), y así una condición o un efecto puede depender de lo que se carga.
- **`destino` y `recorrido`.** Si la transición va a una decisión, el core la resuelve con el mismo contexto y cuenta qué rama tomó y por qué. La app usa `destino` y `efectos` tal cual, dentro de la transacción. No hace falta una función aparte para «ejecutar».
- **`requisitos` es el árbol evaluado**, no solo un sí o un no. La web lo puede dibujar como casilleros: cada hoja que aplica es un casillero con su texto y su ✓. Una implicación cuya premisa no se cumple no muestra casilleros, que es justo «aparecen los casilleros de las pruebas si la orden lleva una batería».
- **`explicar`** arma el texto en castellano a partir de lo mismo:

```
No podés «Avanzar estado» desde «En testeo»:
- Como la orden lleva una batería: falta la foto «Prueba de carga».
- Como la orden lleva una batería: falta la foto «Prueba de temperatura».
Además conviene:
- Falta la foto «Desperfecto».
- Falta la foto «Reparación».
```

  Si la acción no existe en ese estado, lo dice y nombra dónde sí: `«Cerrar orden» no se puede hacer en «En taller». Se puede en: «Finalizado» y «Entregado».`

- **`simular`** recorre un escenario: estado y contexto iniciales, y pasos `{ accion, contexto?, espera? }`. El `contexto` de cada paso se mezcla con el anterior (por ejemplo, «subió la foto de Funcionando»), porque el core no ejecuta acciones ni efectos. Un paso bloqueado no cambia el estado. `espera` permite afirmar el resultado («esto tiene que quedar bloqueado»), y con eso un escenario sirve de test de aceptación de una configuración.

### Validación del grafo

`validarDefinicion` corre el schema y después estos controles. Los mensajes están en castellano y llevan la ruta del problema (`transiciones[2].requisitos.todas[1]`).

| Control | Nivel |
|---|---|
| Schema (zod, mensajes en castellano) | error |
| `id` repetido (estados y decisiones comparten espacio; transiciones aparte) | error |
| `estadoInicial`, `desde`, `excepto`, `hacia`, ramas y `sino` que no existen; `desde` que apunta a una decisión | error |
| Ciclo entre decisiones (decisión → decisión → … → la primera) | error |
| Transición ambigua: dos transiciones con la misma acción desde el mismo estado | error |
| Estado inalcanzable desde el inicial | error |
| Callejón: estado no final desde el que no se llega a ningún final | error |
| Decisión inalcanzable · flujo sin estados finales (no se controlan callejones) · `excepto` sin `desde: "*"` | aviso |
| Con registro: capacidad desconocida, capacidad de otro tipo (una condición usada como acción), `params` que no cumplen el `schemaEntrada` | error |

Los `params` se validan con un **subconjunto propio de JSON Schema** (`type`, `required`, `properties`, `additionalProperties`, `enum`, `const`, `oneOf` de constantes, `items`, largos, mínimos y máximos, `pattern`), para no sumar ajv como dependencia. Las palabras que no conoce las ignora. Si una app necesita el estándar completo, pasa su propio validador en `opciones.validarEsquema`.

## 4. Versionado

- La definición lleva `version` (entero ≥ 1). Una versión publicada no se edita: un cambio es una versión nueva. Dónde se guardan (por ejemplo, una tabla `flujos(id, version, json, publicadoEn, publicadoPor)`) es de la app.
- Una instancia nueva arranca con la última versión (`iniciarInstancia(versiones)`, que devuelve `{ version, estado: estadoInicial }`). La app guarda `version` junto al estado de la entidad.
- `evaluar`, `explicar` y `simular` eligen la definición por `instancia.version` (`elegirVersion`). Si les pasan una sola definición de otra versión, fallan: nunca se evalúa una instancia con reglas que no eran las suyas.
- **Consecuencia directa:** «¿qué pasa con las órdenes abiertas antes del cambio?» se responde solo. Siguen con la versión vieja y no se les exigen las reglas nuevas.
- **Comparar dos versiones** (`compararFlujos`) dice, cambio por cambio, si una instancia de la vieja podría seguir con la nueva sin que le exijan reglas nuevas (§4.1). Mover la instancia es decisión de la app: el core no migra nada.
- **Fuera del core por ahora:** migrar una instancia a otra versión con un mapa de estados explícito.

### 4.1 Trazabilidad

El core da las herramientas puras; guardar, publicar y registrar quién publicó son de la app.

- **Comparar.** `compararFlujos(antes, despues)` devuelve `{ compatible, cambios[] }` y cada cambio es `compatible` o `rompe`. La pregunta es una sola: *lo que valía con la versión vieja, ¿sigue valiendo con la nueva?* Estados, decisiones y transiciones se emparejan por `id` (renombrar un id es quitar y agregar).
  - **Rompe:** quitar un estado, una decisión o una transición; achicar el `desde`; cambiar la acción o el `hacia` de una transición; cambiar las ramas o el `sino` de una decisión; endurecer los `requisitos`.
  - **Compatible:** todo lo demás (agregar, ampliar el `desde`, relajar requisitos, sugerencias, efectos, nombres, `final`, estado inicial, metadatos).
  - Los requisitos se comparan con una prueba sintáctica y conservadora de implicación (`todas`, `alguna`, `no` y `si/entonces`): solo es «relajado» si se puede probar que lo nuevo no pide nada que lo viejo no pidiera. Si no se puede probar, rompe. Un `mensaje` no cambia la regla.
- **Capacidades.** `compararEsquemas` compara dos JSON Schema con el mismo subconjunto que el validador (§3): compatible si todo valor que aceptaba el viejo lo acepta el nuevo. Las anotaciones (`title`, `description`, `default`…) no cuentan; cualquier otra palabra que no entiende y cambia, rompe. `compararCapacidades` lo aplica a dos registros. Para una definición concreta, la respuesta exacta es `validarDefinicion(def, registroNuevo)`.
- **Referencias.** `Referencia = { clave, revision }` y `Revisionado<T> = { clave, revision, estado, valor, huella? }`, con `estado` `borrador`, `vigente` u `obsoleta`. Son solo tipos: el ciclo de publicación es de la app. `verificarReferencias(referencias, catalogo, comparar)` las separa en **vigentes**, **actualizables** (pasar a la vigente es compatible), **que rompen** y **huérfanas** (la revisión no está, o la clave no tiene vigente). El comparador es un parámetro, así que sirve para flujos (`compararFlujos`) o para cualquier otra cosa que la app versione.
- **Huella.** `huella(valor)` es el SHA-256 del JSON canónico (`jsonCanonico`: claves ordenadas como en RFC 8785, sin `undefined`). Está escrita en TypeScript y es síncrona: sin `node:crypto` (el core anda en el navegador) ni `crypto.subtle` (es asíncrono).

### 4.2 Eventos y reacciones

Un evento es una capacidad más (`tipo: "evento"`), con su `schemaEntrada`. `reacciones[]` dice qué hace el flujo cuando llega: `{ id, evento, params?, desde, excepto?, si?, transicion?, efectos? }`.

- **El core no escucha.** `suscripciones(definiciones)` dice qué hay que escuchar y `reaccionar(flujo, instancia, evento, ctx, registro)` devuelve el plan. Recibir, reintentar y ejecutar es de la app o de un plugin.
- **Una reacción no habilita (regla 2).** No tiene `hacia`: nombra una `transicion` existente y pasa por sus requisitos. Si está bloqueada, el plan sale con `aplica: false`, los motivos y ningún efecto.
- **`params` identifica la ocurrencia** y se compara entero (JSON canónico). En un estado, una ocurrencia tiene a lo sumo una reacción; si según los datos hay que ir a lugares distintos, se usa una decisión.
- **Los datos del evento van en el contexto**, como `entrada`: las condiciones siguen siendo puras sobre el contexto.
- **Comparar versiones.** Como una reacción actúa sola, quitarla, agregar una que mueve de estado o cambiar cuándo dispara rompe.

## 5. Reglas duras que quedan en el código

No son capacidades del registro. El flujo no las puede saltear, desactivar ni reordenar. Se controlan en el código antes y después del flujo, y el resultado final es un AND.

| Regla | Ejemplos | Por qué queda en código |
|---|---|---|
| **Facturación** | Emitir comprobantes, numeración fiscal, notas de crédito | Es fiscal y legal, es irreversible (un comprobante emitido no se borra) y suele depender de un tercero. Un flujo mal configurado no puede tener costo legal. |
| **Stock** | Movimientos, reservas y consumo de repuestos, que no quede negativo | Son invariantes de los datos y de la contabilidad, con concurrencia. Tienen que valer con cualquier flujo. |
| **Permisos de seguridad** | Roles, scopes de tokens de API, permisos con nombre propio | Es el borde de seguridad. Lo que se configura no puede dar más acceso; a lo sumo restringe más. |
| **Invariantes técnicos** | Un solo lugar que escribe cada estado, el registro de actividad, la transacción | Sin eso el estado y el historial se separan. |

Puede haber **condiciones de solo lectura** sobre esos dominios («la orden está facturada», «hay stock del repuesto»), porque solo restringen. Lo que nunca es una capacidad es la **operación**: emitir, mover stock o dar un permiso.

## 6. Límite de dependencias

- **Dependencias:** solo `zod`. Ni ajv, ni XState, ni nada de la app.
- **Test del límite** (`test/limites.test.ts`), que es una lista blanca: recorre `src/`, falla si un import no relativo no es `zod`, si un import relativo sale del paquete o si `src` usa `node:*` (el core tiene que andar en el navegador, para un editor). También afirma que `dependencies` en `package.json` sea exactamente `zod`.
- **tsconfig de `src` con `types: []`**: sin tipos de Node, usar `process` o `Buffer` en el core no compila.

## 7. Distribución

- Repo público con licencia MIT. No se publica en npm: se instala desde GitHub (`npm i github:EasyIndustry/ts-workflow-core#vX.Y.Z`).
- `dist/` (JavaScript y `.d.ts`) va versionado, así que instalar no compila nada ni baja dependencias de desarrollo. El CI verifica que `dist/` coincida con el build.
- Versiones con semver y tags. Todo cambio al core tiene que ser genérico: lo que es de una app va en su registro y en sus definiciones, no acá.

## 8. Comparación: qué tomamos y qué no

| | Tomamos | No tomamos |
|---|---|---|
| **XState** | Transiciones con guardas *con nombre y params* (como `guard: { type, params }` de la v5), configuración en JSON, la idea de una función pura que calcula el siguiente estado. | Estados jerárquicos y paralelos, historia, actores, `invoke` y demoras (IO dentro del motor), guardas como funciones inline. XState sabe si un evento se puede (`can`), pero no dice por qué. Es otra dependencia con mucha semántica para un editor pensado para usuarios de negocio. |
| **BPMN** | El vocabulario visual que un usuario de negocio reconoce: la tarea es la acción y el rombo exclusivo es la decisión. | XML, semántica de tokens, eventos, timers, mensajes, pools y lanes. BPMN orquesta un proceso. Nosotros describimos el **ciclo de vida de una entidad** en el que una persona decide qué hacer y cuándo, que está más cerca de una máquina de estados (o de CMMN). |
| **[workflow-bot-core](https://github.com/EasyIndustry/workflow-bot-core)** | El registro de capacidades declaradas con schema de params (como sus complementos y herramientas), el ensayo sin efectos (aquí `simular`), la traza (aquí `recorrido` y `explicar`), los nodos de decisión y las versiones publicadas que no se editan. | Ejecutar IO dentro del motor y las corridas largas: acá el motor es puro y vive en la transacción de la app. Mermaid como fuente: acá la fuente es el JSON, y un Mermaid se puede generar para mirarlo. El runtime de Python. Puede quedar para automatizaciones externas disparadas por efectos. |

## 9. El ejemplo del taller, de punta a punta

Un taller de servicio técnico quiere cuatro reglas: firma obligatoria para terminar el formulario de conformidad, fotos por paso, casilleros que digan qué falta y una prueba extra cuando la orden lleva cierta pieza (una batería). Se reparten así:

- **Código, una vez:** las *capacidades*. `formulario.campo-completo` (que trata `""` como vacío, algo que `required` de JSON Schema no frena), `foto.tiene { momento }`, `orden.lleva-pieza-de-lista { lista }`, `orden.repuestos-pendientes`, `entrada.pieza-en-lista { lista }` y el efecto `notificar`. Son vocabulario genérico: sirven para esta regla y para la próxima.
- **Configuración:** las *reglas*, o sea dónde se cuelga cada condición. Esto es lo que cambia el taller.

```json
{
  "id": "orden-taller", "version": 2, "nombre": "Equipo en el taller", "estadoInicial": "sin_ingresar",
  "decisiones": [{
    "id": "faltan_repuestos", "nombre": "¿Faltan repuestos?",
    "ramas": [{ "si": { "condicion": "orden.repuestos-pendientes" }, "hacia": "esperando_repuesto" }],
    "sino": "en_reparacion"
  }],
  "transiciones": [
    { "id": "ingresar", "accion": "orden.ingresar", "desde": ["sin_ingresar"], "hacia": "en_taller",
      "requisitos": { "todas": [
        { "condicion": "foto.tiene", "params": { "momento": "ETIQUETA" } },
        { "condicion": "foto.tiene", "params": { "momento": "INGRESO" } } ] } },
    { "id": "diagnosticar", "accion": "orden.avanzar", "desde": ["en_revision"], "hacia": "faltan_repuestos" },
    { "id": "finalizar", "accion": "orden.avanzar", "desde": ["en_testeo"], "hacia": "finalizado",
      "requisitos": { "todas": [
        { "condicion": "foto.tiene", "params": { "momento": "FUNCIONANDO" } },
        { "si": { "condicion": "orden.lleva-pieza-de-lista", "params": { "lista": "baterias" } },
          "entonces": { "todas": [
            { "condicion": "foto.tiene", "params": { "momento": "PRUEBA_CARGA" } },
            { "condicion": "foto.tiene", "params": { "momento": "PRUEBA_TEMPERATURA" } } ] } } ] },
      "sugerencias": { "todas": [
        { "condicion": "foto.tiene", "params": { "momento": "DESPERFECTO" } },
        { "condicion": "foto.tiene", "params": { "momento": "REPARACION" } } ] } },
    { "id": "agregar_pieza", "accion": "orden.agregar-pieza", "desde": "*", "excepto": ["entregado"],
      "efectos": [{ "efecto": "notificar",
        "si": { "condicion": "entrada.pieza-en-lista", "params": { "lista": "baterias" } },
        "params": { "destinatario": "tecnico", "mensaje": "Esta orden lleva una batería: subí la foto de la prueba de carga y la de temperatura." } }] }
  ]
}
```

*(Recortado: faltan los estados y las transiciones que no cambian. La versión completa, que se valida y se simula en los tests, está en [`ejemplos/taller/`](../ejemplos/taller/); `npm run ejemplo` la muestra por consola.)*

| Regla | Cómo queda |
|---|---|
| Firma obligatoria para terminar el formulario | Requisito `formulario.campo-completo { campo: firma_cliente }` en `terminar` del flujo `formulario-conformidad` v2 (§1). Editar después sigue permitido (`editar`, desde `*`). |
| Fotos por paso | `foto.tiene` en `requisitos` de cada transición: ETIQUETA + INGRESO al ingresar y FUNCIONANDO para Finalizado. |
| Casilleros con título, el vacío dice «Falta» | La web dibuja el árbol `requisitos` (obligatorios) y `sugerencias` (opcionales) que devuelve `evaluar`. No hay regla nueva: es la vista de las que existen. |
| Prueba extra si se usa cierta pieza | `si` lleva una pieza de la lista `baterias`, `entonces` PRUEBA_CARGA y PRUEBA_TEMPERATURA, más el aviso al técnico como efecto de `agregar_pieza`. Los códigos de la lista se editan en la configuración de la app. |

**Las dudas típicas pasan a ser cambios de configuración:**

| Pregunta | Cambio en la definición |
|---|---|
| ¿En qué paso se exigen la etiqueta y el aspecto inicial? | Mover el `todas[ETIQUETA, INGRESO]` de `ingresar` a otra transición. |
| ¿Desperfecto y reparación son obligatorias? | Pasarlas de `sugerencias` a `requisitos`, o al revés. |
| ¿Qué paso frenan las pruebas de la batería? | Colgar el mismo `si/entonces` de otra transición. |
| ¿Hace falta una tercera prueba? | Una hoja más en el `entonces`. |
| ¿Vale otra firma en lugar de la del cliente? | `alguna[campo-completo firma_cliente, campo-completo firma_tecnico]`. |
| ¿Qué pasa con las órdenes abiertas antes del cambio? | Nada: siguen en la v1 (§4). |

**Lo que sí es código y conviene saberlo.** Si los tipos de foto (los momentos) son un enum en la base de la app, sumar uno es una migración. Para que una prueba nueva sea configuración, los tipos tienen que ser un **catálogo** (datos), igual que la lista de códigos de piezas. Es trabajo genérico de la app, una vez, no de cada regla.

## 10. Fuera de v0

Migrar instancias entre versiones (comparar versiones ya está: §4.1), estados jerárquicos o paralelos, timers y plazos («si en 48 h no…»), exportar a Mermaid, guardar y publicar definiciones (es de la app) y un editor visual.
