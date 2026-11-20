# Política del repositorio

Este repo es una **librería open source** (MIT): varias apps la instalan desde un tag y cualquiera
puede usarla, pedir cambios o contribuir. Esta política dice qué entra y cómo se decide. Vale
igual para un pedido de afuera y para uno de una app de casa: quién pide no cambia la respuesta.

## El principio

**No hacemos cambios con una utilidad específica: hacemos una herramienta general para un abanico
de posibilidades.**

Un pedido nace casi siempre de una app concreta, y está bien que sea así: es la mejor fuente de
requisitos. Pero lo que entra al core no es la solución de esa app sino la herramienta que resuelve
esa clase de problema para cualquier dominio. Si no se puede generalizar, queda en la app.

## El filtro

Cada pedido (issue o PR) pasa por estas preguntas, en orden. La primera que corta decide.

1. **¿Qué problema resuelve?** El pedido se lee por la necesidad, no por la solución que trae.
   «Que la orden no se cierre sin la foto de la etiqueta» es, de fondo, «una condición con
   parámetros colgada de una transición», y eso ya existe.
2. **¿Se resuelve en la app?** Si alcanza con registrar una capacidad (una acción, una condición o
   un efecto), con escribir una definición o con armar el contexto, no hace falta tocar el core: se
   responde con el cómo.
3. **¿A quién más le sirve?** Tiene que servirle al menos a dos dominios distintos (un taller y un
   circuito de compras, no dos pantallas de la misma app). Si el único caso es el de quien lo pide,
   no entra tal cual.
4. **¿Se puede generalizar?** Si la necesidad de fondo es general aunque el pedido no lo sea, se
   reescribe como herramienta general y entra así.
5. **¿Respeta el modelo?** Las cuatro reglas de [`docs/diseno.md`](docs/diseno.md) y el contrato de
   [`CONTRIBUTING.md`](CONTRIBUTING.md): vocabulario cerrado, el flujo restringe y no habilita, las
   versiones publicadas no cambian, el core decide y la app ejecuta (sin IO).

Ante la duda, se prefiere **un punto de extensión a una función nueva**: una opción, un parámetro
del registro, un campo opcional. Le deja a la app hacer lo suyo sin que lo suyo entre al core.

## Qué entra y qué no

**La pregunta:** ¿le sirve a cualquier app que tenga entidades con un ciclo de vida configurable?

- **Entra:** el formato de la definición, la validación del grafo, el intérprete, la explicación
  («por qué no puedo»), la simulación, el versionado, el contrato del registro y las herramientas
  sobre definiciones y capacidades que sirven para cualquier dominio (comparar, verificar, contar).
- **No entra:**
  - **capacidades concretas:** `orden.cerrar`, `foto.tiene`, `factura.emitida`. Las registra cada
    app con sus proveedores; el core solo conoce el contrato;
  - **lógica de negocio de un cliente:** sus estados, sus reglas, sus listas de códigos;
  - **nombres propios:** de clientes, marcas, productos, personas o sistemas internos. Ni en el
    código, ni en los tests, ni en los ejemplos, ni en los issues;
  - **IO:** base de datos, red, archivos, reloj, usuarios, publicación. El core es puro y vive
    dentro de la transacción de la app;
  - **operaciones con reglas duras** (facturación, stock, permisos de seguridad): quedan en el
    código de la app (diseño §5).
- **Un cliente es una configuración, no código:** su registro y sus definiciones viven en su app.
  Un default que solo tiene sentido en un rubro es tan específico como una función con su nombre.
- **Los ejemplos son genéricos:** el taller de `ejemplos/` ilustra el modelo y no es el de nadie.

### Pedidos que entran y que no

| Pedido | Qué pasa | Por qué |
|---|---|---|
| «Comparar dos versiones de una definición y decir qué cambió» | entra | Lo necesita cualquier app que publique versiones. |
| «Timers: si en 48 h no avanza, …» | se evalúa | Es general, pero el reloj es IO: entraría como dato del contexto y una condición de la app, no como un timer del motor. |
| «Condición `foto.tiene { momento }`» | fuera de alcance | Es una capacidad: la registra la app. |
| «Que el estado *En taller* no permita *Facturar*» | sin cambios | Es una definición: una transición sin `desde: en_taller`. |
| «Integrar con el ERP X» | fuera de alcance | Es IO y de un sistema concreto: va en la app, que ejecuta los efectos. |
| «Que `explicar` diga "llamá a Juan"» | sin cambios | `mensaje` en el nodo de la condición, o el texto de la capacidad. |

### Cómo reformular un pedido específico

1. **Sacá los nombres propios** y reemplazalos por el rol que cumplen: «la foto de la etiqueta» →
   «una condición con parámetros».
2. **Separá la regla del catálogo:** los códigos que cambian seguido van al contexto, no a la
   definición ni al core (diseño §1).
3. **Preguntá qué falta en el modelo**, no en tu app: si lo que pedís es una capacidad nueva, se
   registra en tu app; si es algo que ninguna capacidad puede expresar (una forma nueva de
   condición, un control del validador), es del core.
4. **Nombrá al menos otro dominio** donde serviría igual.

Ejemplo: «cuando la orden lleva una batería, exigir la prueba de carga» no pide nada al core; es
`{ si: lleva-pieza-de-lista { lista }, entonces: foto.tiene { momento } }` con dos capacidades de la
app. En cambio, «saber si una orden abierta con la versión 3 puede pasar a la 4 sin que le cambien
las reglas» sí es del core, escrito así: «comparar dos versiones y clasificar cada cambio como
compatible o que rompe».

## Qué puede pasar con un pedido

Cada pedido nuevo entra con la etiqueta `triage` y sale con una de estas:

| Etiqueta | Qué quiere decir | Qué pasa |
|---|---|---|
| `aceptado` | pasa el filtro tal cual | queda abierto hasta que se implementa |
| `generalizar` | la necesidad sirve, el pedido es muy puntual | se reescribe en el issue como herramienta general; con eso pasa a `aceptado` |
| `sin-cambios` | ya se puede con lo que hay | se cierra con el cómo (una capacidad, una definición, el contexto) |
| `fuera-de-alcance` | es de la app, no del core | se cierra con por qué y dónde resolverlo |

Ningún pedido se cierra sin una explicación. Un «no» dice siempre por qué y qué hacer en cambio.

Aparte, `error` marca lo que el core promete y no cumple. Un error no pasa por el filtro, salvo que
sea un pedido disfrazado: si «no anda» quiere decir «no hace lo que mi app necesita», es un pedido.

Las etiquetas están en [`.github/labels.json`](.github/labels.json) y se crean solas en GitHub
(`.github/workflows/labels.yml`).

## Instalar sin parches

- Se instala desde un tag (`npm i github:EasyIndustry/ts-workflow-core#vX.Y.Z`). No se publica en
  npm.
- **La copia no se edita.** Si una app necesita un cambio, vuelve acá como issue y pasa por el
  filtro. Una copia con parches propios deja de poder actualizarse.
- Lo que la app agrega va en la app: en su registro, sus definiciones y su contexto.

## Versiones y compatibilidad

- [Semver](https://semver.org/lang/es/). Mientras sea 0.x, una versión menor puede romper; un parche
  nunca.
- Toda ruptura se dice en las notas del release, con qué cambia y cómo migrar.

## Dependencias

- Solo `zod`. Una dependencia nueva se justifica en el issue y se suma a la lista blanca de
  `test/limites.test.ts`: cada una es una dependencia más para cada app que instala el core.
- Nada de Node en `src/`: el core tiene que andar en el navegador (por ejemplo, en un editor).

## Open source

- Licencia MIT ([`LICENSE`](LICENSE)). Lo que se contribuye entra bajo la misma licencia.
- Cómo se contribuye: [`CONTRIBUTING.md`](CONTRIBUTING.md).
- **Idioma:** el repo está en castellano (código, documentación, issues). Un issue en otro idioma se
  acepta y se responde.
