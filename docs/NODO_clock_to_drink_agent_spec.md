# NODO — Home Experience / Clock → Drink
## Especificación de implementación para agente

**Repositorio:** `ZeilSoftGh/nodo-landing`  
**Rama de trabajo:** `feat/home-experience-intro`  
**Alcance de esta iteración:** únicamente la secuencia `reloj + lettering → reloj aterriza → reloj se convierte en garnish → trago final`.  
**Fuera de alcance:** video, carta, cocktails adicionales, reservas, footer final, WebGL/Three.js, CMS.

---

# 1. Objetivo de experiencia

La home no debe sentirse como una sucesión de bloques.

La primera parte tiene que percibirse como **una única escena continua**:

```text
BIENVENIDO A LA EXPERIENCIA NODO
            +
          RELOJ
            ↓ scroll
el lettering abandona la escena
            ↓
el reloj viaja y reduce escala
            ↓
el usuario entra a una segunda escena sin percibir un corte
            ↓
aparece el vaso detrás
            ↓
el reloj cambia de forma perceptualmente
            ↓
se convierte en el garnish del cocktail
            ↓
queda el TRAGO FINAL
```

El principio de diseño es un **match transformation**, no un morph geométrico real.

La transformación debe ocurrir porque el ojo del usuario sigue el mismo objeto a través de varias representaciones preparadas:

```text
reloj.png
    ↓
reloj.png pequeño / docked
    ↓ crossfade corto
reloj-gajo.png
    ↓
reloj-gajo + trago-base.png
    ↓ crossfade corto
trago-final.png
```

La escena tiene que sentirse cara, lenta, controlada y deliberada.

---

# 2. Referencia visual principal: Mùn Rooftop Rome

Antes de implementar, revisar en desktop la home de Mùn.

Referencias:

- Sitio oficial: https://munrooftoprome.com/
- CSS Design Awards: https://www.cssdesignawards.com/sites/mun-rooftop-cocktail-bar/47854/

## Qué tomar de Mùn

No copiar diseño, branding, composición exacta ni assets.

Tomar estos principios:

1. **Un objeto visual central domina la narrativa.**
2. El objeto no desaparece arbitrariamente: el scroll lo lleva hacia el siguiente estado visual.
3. La transición se percibe como continuidad espacial, no como cambio de sección.
4. Fondo oscuro, objeto iluminado y tipografía con mucho espacio negativo.
5. El scroll funciona como director de la escena.
6. Los objetos mantienen peso visual: no rebotan, no aceleran de forma juguetona.
7. Los cambios grandes están separados por momentos de “hold”.
8. El producto termina ocupando el rol que antes tenía el símbolo inicial.
9. La fotografía/asset aislado sobre oscuridad tiene prioridad sobre decoraciones de UI.
10. La experiencia es reversible al hacer scroll hacia arriba.

CSS Design Awards describe la experiencia de Mùn como **animated / scroll** y como un sitio inmersivo de “lunar mood”, donde mixología y lenguaje lunar forman parte del mismo sistema visual. La referencia para NODO es trasladar ese principio:

```text
MÙN:
luna → universo cocktail

NODO:
reloj → garnish → cocktail
```

## Qué NO copiar de Mùn

- luna;
- paleta;
- tipografía;
- copy;
- composición exacta;
- timings exactos;
- layouts;
- código;
- nombres de clases.

La referencia es de **dirección visual y comportamiento**.

---

# 3. Estado actual del repo

La rama `feat/home-experience-intro` ya contiene una implementación avanzada de la intro.

Archivos relevantes existentes:

```text
src/pages/index.astro
src/components/home/ExperienceIntro.astro
src/components/home/ScrollFilm.astro
src/lib/motion/homeExperience.ts
src/lib/motion/gsap.ts
src/lib/motion/lenis.ts
src/lib/motion/pointerParallax.ts
src/lib/motion/deviceTilt.ts
src/styles/tokens.css
src/styles/global.css
src/styles/typography.css
```

## Importante

NO reconstruir la intro desde cero.

La implementación existente ya contiene:

- sticky viewport;
- lettering;
- reloj;
- cielo decorativo;
- pointer parallax;
- device tilt;
- Lenis;
- GSAP;
- ScrollTrigger;
- cleanup;
- reduced motion;
- styleguide separado;
- `getScrollTrigger()` centralizado.

Conservar esas decisiones salvo que esta especificación indique explícitamente lo contrario.

---

# 4. Cambio respecto de la versión anterior

La implementación actual fue diseñada para:

```text
reloj
↓
dock
↓
ScrollFilm
```

Ese concepto queda reemplazado.

La nueva secuencia es:

```text
SCENE 00
reloj + lettering

↓ scroll

MATCH CUT / HANDOFF

↓ scroll

SCENE 01
reloj pequeño → reloj-gajo → cocktail

FIN DE ESTA ITERACIÓN
```

El video será una sección posterior independiente.

## Por lo tanto

`ScrollFilm.astro` NO forma parte del scope actual.

### Hacer

- conservar el archivo `ScrollFilm.astro` para reutilizarlo después;
- no borrarlo;
- no desarrollar el video;
- no agregar un MP4 placeholder;
- no descargar stock;
- no conectar video en esta iteración.

### En `index.astro`

Por ahora la composición debe quedar conceptualmente:

```astro
<ExperienceIntro />
<ClockDrinkScene />
```

No montar `<ScrollFilm />` en esta fase.

---

# 5. Assets definitivos

Usar exactamente los assets entregados.

Naming esperado:

```text
public/reloj.png
public/reloj-gajo.png
public/trago-base.png
public/trago-final.png
```

Si en el repo ya se encuentran con esos nombres, NO renombrarlos.

## Dimensiones de referencia de los masters entregados

### `reloj.png`

```text
canvas: 1672 × 941
RGBA
visible alpha bbox aprox:
x: 330 → 1407
y:   0 → 913
```

IMPORTANTE: el canvas del reloj tiene padding transparente.  
No asumir que el centro geométrico del `<img>` equivale exactamente al centro perceptual del dial.

### `reloj-gajo.png`

Master de referencia:

```text
canvas aproximado: 1254 × 1254
RGBA
```

Es un asset independiente usado durante el handoff.

### `trago-base.png`

```text
canvas: 1086 × 1448
RGBA
```

Contiene el cocktail SIN garnish/reloj.

### `trago-final.png`

```text
canvas: 1086 × 1448
RGBA
```

Contiene cocktail + garnish/reloj final integrado.

## Regla fundamental

`trago-base.png` y `trago-final.png` comparten canvas y deben renderizarse con:

```text
misma width
misma height
mismo top
mismo left
mismo transform
mismo transform-origin
```

Nunca calibrarlos como dos objetos distintos.

---

# 6. No intentar un morph real

No implementar:

- SVG morph;
- canvas deform;
- WebGL warp;
- mesh deformation;
- Three.js;
- morph de paths;
- CSS clip-path complejo para “convertir” el reloj;
- IA runtime;
- frame-by-frame generado.

El reloj original y el reloj-gajo no tienen la misma topología.

Un morph matemático se vería artificial y agregaría complejidad sin mejorar la experiencia.

## Técnica correcta

Utilizar:

```text
movement
+
scale
+
rotation mínima
+
posición compartida
+
crossfade
+
occlusion
```

para engañar al ojo.

Esto es un **match cut interactivo**.

---

# 7. Arquitectura recomendada

Crear un nuevo componente:

```text
src/components/home/ClockDrinkScene.astro
```

Mantener:

```text
ExperienceIntro.astro
```

como Scene 00.

La estructura final:

```text
src/components/home/
├── ExperienceIntro.astro
├── ClockDrinkScene.astro
└── ScrollFilm.astro            # conservar, NO montar todavía
```

Y:

```text
src/pages/index.astro
```

debe montar:

```astro
<ExperienceIntro />
<ClockDrinkScene />
```

---

# 8. Por qué usar dos escenas y no una mega-section

La continuidad se debe resolver mediante un **handoff visual**.

Esto tiene varias ventajas:

- progressive enhancement más limpio;
- reduced motion más simple;
- escena del cocktail reusable;
- timings independientes;
- más fácil continuar después con video;
- menor acoplamiento;
- menos CSS absoluto dentro de un único viewport;
- el drink puede existir como contenido real incluso sin JS.

La ilusión debe ser que son una sola escena aunque técnicamente sean dos componentes.

---

# 9. Handoff entre Scene 00 y Scene 01

El final de `ExperienceIntro` y el comienzo de `ClockDrinkScene` deben ser visualmente casi idénticos.

## Scene 00 termina con

- lettering fuera;
- cielo muy reducido o retirado;
- fondo NODO;
- reloj pequeño;
- reloj ubicado en el futuro target del garnish;
- reloj nítido;
- sin fade-to-black.

## Scene 01 comienza con

- mismo fondo;
- un segundo `reloj.png` visualmente en el MISMO lugar;
- misma escala perceptual;
- misma rotación;
- mismo brillo;
- mismo z-index perceptual.

En el cambio entre secciones el usuario NO debe poder identificar el frame donde cambia de un reloj DOM al siguiente.

Es un match cut.

---

# 10. Scene 00 — ExperienceIntro

Partir del componente actual.

Conservar:

- H1 real;
- lettering;
- sky;
- dust;
- sparks;
- pointer;
- tilt;
- hint;
- sticky viewport;
- tokens NODO.

## Mantener la entrada inicial existente

La entrada actual es conceptualmente correcta:

```text
title:
opacity 0 → 1
y 24 → 0

clock:
opacity 0 → 1
scale .94 → 1
y 30 → 0
```

Con:

```text
power3.out
```

No agregar bounce.

---

# 11. Scene 00 — lettering

Conservar la idea actual:

```text
BIENVENIDO A LA
       reloj
EXPERIENCIA NODO
```

El lettering debe continuar saliendo lateralmente.

Actualmente:

```text
línea 1 → xPercent -120
línea 2 → xPercent +120
```

La salida lateral funciona bien para dejar libre el eje vertical del objeto.

No volver a un simple fade.

---

# 12. Scene 00 — duración

Desktop recomendado:

```css
.experience-intro {
  min-height: 220svh;
}
```

Mobile:

```css
.experience-intro {
  min-height: 180svh;
}
```

Mantener inicialmente los valores existentes.

Sólo cambiarlos si el test visual demuestra que el handoff ocurre demasiado rápido.

---

# 13. Scene 00 — timeline revisada

Usar escala conceptual de `0 → 100`.

## 0–12 %

Hold.

El usuario comienza a scrollear pero casi nada cambia.

```text
clock y drift: mínimo
title drift: mínimo
hint desaparece
input parallax se libera
```

## 12–38 %

Retirada del lettering.

```text
line 1 xPercent 0 → -120
line 2 xPercent 0 → +120
```

No reducir opacity como mecanismo principal.

## 20–52 %

El reloj comienza su viaje.

```text
scale:
1 → ~0.70

rotation:
0 → 2–3deg

y:
mínimo lift / desplazamiento controlado
```

## 42–78 %

El reloj viaja hacia el `handoff dock`.

Esta fase reemplaza el viejo “dock hacia el film”.

El reloj NO desaparece.

Debe terminar totalmente visible.

## 78–100 %

Hold.

En el final:

```text
title: fuera
clock: docked
clock opacity: 1
clock blur: 0
clock sharp: sí
background: estable
```

No introducir todavía el cocktail dentro de Scene 00.

---

# 14. Posición del handoff

Crear o reutilizar:

```html
<div data-experience-dock></div>
```

Pero su posición ahora debe representar:

**el centro perceptual del reloj justo antes de convertirse en garnish**.

No representa el centro del vaso.

## Valor inicial recomendado desktop

```css
.experience-dock {
  position: absolute;

  left: 61%;
  top: 39%;

  width: 1px;
  height: 1px;
}
```

Estos valores son PUNTO DE PARTIDA, no contrato rígido.

La posición definitiva se calibra contra `ClockDrinkScene`.

## Mobile inicial

```css
left: 58%;
top: 38%;
```

---

# 15. Scale final del reloj en Scene 00

La escala actual de `0.32` es un punto de partida válido.

Probar:

```text
desktop: 0.28–0.34
mobile:  0.27–0.32
```

No decidir por números aislados.

Criterio:

> el dial pequeño al final de Scene 00 debe tener aproximadamente el mismo peso visual que la parte relojera del garnish de Scene 01.

---

# 16. Corregir el centro perceptual de `reloj.png`

`reloj.png` no llena el canvas.

Por lo tanto:

NO calcular todos los movimientos basándose únicamente en:

```ts
element.offsetWidth / 2
element.offsetHeight / 2
```

Usar una corrección perceptual.

El alpha visible del reloj está aproximadamente en:

```text
canvas: 1672 × 941

bbox:
left   = 330
right  = 1407
top    = 0
bottom = 913
```

Centro visible aproximado:

```text
x ≈ 868.5
y ≈ 456.5
```

Centro del canvas:

```text
x = 836
y = 470.5
```

Eso implica que el centro visible está levemente:

```text
a la derecha
y hacia arriba
```

No hace falta construir procesamiento de imagen runtime.

Puede resolverse con constantes documentadas de offset perceptual.

---

# 17. Crear ClockDrinkScene.astro

Estructura orientativa:

```astro
<section class="clock-drink" data-clock-drink>
  <div class="clock-drink__viewport">

    <div class="clock-drink__glow" aria-hidden="true"></div>

    <div
      class="clock-drink__handoff-clock"
      data-drink-handoff-clock
      aria-hidden="true"
    >
      <img src="/reloj.png" alt="" />
    </div>

    <div
      class="clock-drink__product"
      data-drink-product
      aria-hidden="true"
    >
      <img
        class="clock-drink__base"
        data-drink-base
        src="/trago-base.png"
        alt=""
      />

      <img
        class="clock-drink__garnish"
        data-drink-garnish
        src="/reloj-gajo.png"
        alt=""
      />

      <img
        class="clock-drink__final"
        data-drink-final
        src="/trago-final.png"
        alt=""
      />
    </div>

  </div>
</section>
```

Los nombres pueden ajustarse, pero conservar data attributes semánticos.

---

# 18. El trago es contenido visual, no un fondo

No usar:

```css
background-image: url(...)
```

para el vaso.

Debe ser `<img>`.

Razones:

- resolución;
- object sizing;
- compositing;
- transforms;
- accessibility;
- testing;
- futuros efectos.

---

# 19. Tamaño del cocktail

Desktop inicial:

```css
.clock-drink__product {
  width: clamp(22rem, 31vw, 34rem);
}
```

Pantallas ultrawide:

no permitir que el vaso crezca indefinidamente.

Mobile:

```css
width: min(78vw, 26rem);
```

## Posición

Desktop:

```text
centro visual:
x ≈ 50–52vw
y ≈ 55–58svh
```

El vaso puede quedar levemente por debajo del centro geométrico.

Esto deja aire arriba para el garnish y mantiene sensación editorial.

---

# 20. Base y final deben estar pixel-aligned

Las imágenes:

```text
trago-base.png
trago-final.png
```

usan el mismo canvas `1086 × 1448`.

Renderizarlas así:

```css
.clock-drink__base,
.clock-drink__final {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
}
```

Nunca usar tamaños distintos.

Nunca una con `object-fit: cover` y otra con `contain`.

---

# 21. Importante: base y final no son pixel-idénticos

Aunque comparten canvas, existe reconstrucción fotográfica entre ambos masters.

Eso significa que un crossfade largo a 50/50 puede generar:

- ghosting;
- doble rim del vaso;
- hielo duplicado;
- shimmer;
- cambio de highlights.

## Solución

El crossfade `composite → final` debe ser corto.

Recomendado:

```text
8–12 % del timeline
```

Nunca sostener ambos al 50% durante mucho tiempo.

---

# 22. Posicionamiento de reloj-gajo

`reloj-gajo.png` se monta como layer independiente sobre `trago-base.png`.

El objetivo NO es que quede perfecto a ojo desde el primer CSS.

Usar un proceso de calibración:

1. renderizar `trago-final.png` con `opacity: .5`;
2. renderizar `trago-base.png` debajo;
3. montar `reloj-gajo.png`;
4. ajustar:
   - width;
   - left;
   - top;
   - rotation;
   - transform-origin;
5. ocultar `trago-final`;
6. comprobar que la composición `base + gajo` se aproxima al final.

## Valores iniciales orientativos

Respecto del wrapper del cocktail:

```css
.clock-drink__garnish {
  position: absolute;

  width: 46%;
  left: 57%;
  top: 3%;

  transform-origin: 63% 51%;
}
```

NO considerar esos números finales.

Ajustar visualmente.

---

# 23. Centro del dial dentro del reloj-gajo

Para el master de referencia `1254 × 1254`, el centro perceptual de la parte relojera se encuentra aproximadamente en la zona:

```text
x ≈ 63 %
y ≈ 51 %
```

Usar esa zona como `transform-origin` inicial.

La transformación debe sentirse como:

```text
el reloj redondo llega
↓
su dial coincide con el núcleo visual del garnish
↓
crossfade
↓
el garnish “se despliega”
```

No:

```text
reloj desaparece
↓
gajo aparece en otro lugar
```

---

# 24. Match cut entre las dos escenas

Este es el punto más importante.

## Frame final Scene 00

Debe visualmente equivaler a:

## Frame inicial Scene 01

Para conseguirlo, `ClockDrinkScene` comienza con OTRO `reloj.png`.

Ese segundo reloj se llama:

```text
handoff clock
```

El usuario nunca debe percibir que son dos elementos distintos.

### Al entrar a Scene 01

```text
Scene 00 clock opacity → 0
Scene 01 handoff clock opacity → 1
```

El crossfade puede ocurrir durante aproximadamente:

```text
80–150 ms perceptuales
```

o unos pocos puntos de scroll.

No hacer un fade largo.

---

# 25. Background continuity

`ExperienceIntro` y `ClockDrinkScene` deben compartir el mismo fondo base.

Actualmente:

```css
radial-gradient(circle at 50% 46%, rgb(13 63 55 / .28), transparent 46%),
radial-gradient(circle at 86% 88%, rgb(201 167 67 / .06), transparent 30rem),
var(--nodo-night);
```

Mantener el mismo stack en el frame de handoff.

No puede existir un cambio de negro/verdes justo cuando cambia la sección.

---

# 26. Glow del cocktail

Agregar una luz atmosférica separada detrás del vaso:

```html
<div class="clock-drink__glow"></div>
```

Color basado en:

```text
--nodo-copper
--nodo-gold
```

Ejemplo:

```css
background:
  radial-gradient(
    circle,
    rgb(212 119 39 / 18%),
    transparent 58%
  );
```

Opacity animada:

```text
0 → ~0.35
```

Debe parecer iluminación proveniente del propio cocktail.

No un círculo gráfico evidente.

---

# 27. Scene 01 — altura

Desktop inicial:

```css
.clock-drink {
  min-height: 230svh;
}
```

Mobile:

```css
.clock-drink {
  min-height: 190svh;
}
```

Viewport:

```css
.clock-drink__viewport {
  position: sticky;
  top: 0;
  height: 100svh;
  overflow: hidden;
}
```

---

# 28. Scene 01 — timeline

Crear una segunda timeline de scroll.

No intentar meter toda la home en una sola timeline.

Conceptualmente:

```text
IntroTimeline
DrinkTimeline
```

Esto mantiene la regla existente de una timeline por escena.

---

# 29. DrinkTimeline — coreografía exacta

Normalizar a `0 → 100`.

## 0–10 % — MATCH HOLD

Sólo handoff clock.

```text
handoff clock visible
drink base opacity 0
garnish opacity 0
final opacity 0
```

El usuario necesita unas décimas perceptuales para aceptar que el objeto sigue siendo el mismo.

---

## 8–36 % — REVEAL PRODUCT

Aparece `trago-base.png` por detrás.

Animar:

```text
opacity 0 → 1
scale .96 → 1
y 5svh → 0
```

Simultáneamente:

```text
glow opacity 0 → .35
```

El handoff clock sigue presente.

No reducir todavía su opacity.

---

## 24–48 % — LOCK TO GARNISH

El handoff clock termina de corregir posición y escala sobre el área del garnish.

Movimiento máximo pequeño.

Ejemplo:

```text
x: ±20px
y: ±20px
rotation: 0 → 2deg
scale: ajuste fino
```

No hacer otra gran trayectoria.

La gran trayectoria ocurrió en Scene 00.

---

## 42–58 % — CLOCK → GARNISH

Hacer el crossfade principal.

```text
handoff clock:
opacity 1 → 0

reloj-gajo:
opacity 0 → 1
```

Además se permite:

```text
handoff clock scale 1 → .94

garnish scale .96 → 1
```

Eso suaviza el cambio de silueta.

No usar blur mayor a `1–2px`.

Preferiblemente ningún blur.

---

## 58–72 % — COMPOSITE HOLD

Ahora el usuario ve:

```text
trago-base.png
+
reloj-gajo.png
```

Mantener.

Este hold es importante.

Es el momento donde el cerebro confirma:

> el reloj ahora forma parte del trago.

No introducir inmediatamente `trago-final`.

---

## 72–84 % — BAKE TO FINAL

Crossfade corto.

```text
base + garnish:
opacity 1 → 0

trago-final:
opacity 0 → 1
```

Duración corta para evitar ghosting.

`trago-final.png` debe estar ya exactamente en la misma caja del `trago-base`.

---

## 84–100 % — FINAL HOLD

Sólo:

```text
trago-final.png
```

Opcional:

```text
scale 1.015 → 1
```

muy leve.

No añadir texto todavía.

No añadir CTA todavía.

El cocktail debe respirar solo.

---

# 30. Curvas de easing

Durante scrub:

preferir:

```text
none
power1.inOut
power2.inOut
```

en transforms puntuales.

Evitar:

```text
bounce
elastic
back
expo agresivo
```

La transformación tiene que obedecer al scroll.

---

# 31. Z-index recomendado

Dentro de `ClockDrinkScene`:

```text
0 background
1 glow
2 trago-base
3 handoff clock
4 reloj-gajo
5 trago-final
6 grain global (ya existe fuera del componente)
```

Durante la fase final, `trago-final` toma el control visual.

---

# 32. Cielo, dust y sparks

Conservarlos en Scene 00.

No extender el “cielo” por toda la sección del cocktail.

La metáfora inicial puede retirarse al entrar al producto.

La transición ideal:

```text
sky opacity → 0
mientras
cocktail glow opacity → aparece
```

De esta manera cambia:

```text
cosmos / reloj
```

por:

```text
barra / líquido / luz
```

sin un corte de fondo.

---

# 33. Pointer parallax / device tilt

Mantener la arquitectura actual.

El input libre debe controlar el reloj sólo antes de que el usuario haya iniciado el scrub.

La implementación actual ya contiene la idea:

```text
scroll progress > .003
→ release pointer
→ release tilt
→ GSAP pasa a ser dueño del transform
```

Conservarla.

No permitir que pointer/gyro luche contra el timeline durante el dock.

---

# 34. No aplicar tilt al cocktail todavía

No agregar:

- parallax al vaso;
- pointer tilt al cocktail;
- perspective 3D;
- giro del vaso.

El producto debe sentirse pesado y físico.

Podemos explorar interactividad del producto en otra iteración.

---

# 35. Reduced motion

La experiencia debe ser completa sin scrub fuerte.

Con `prefers-reduced-motion: reduce`:

Scene 00:

```text
title + reloj estáticos
```

Después, Scene 01:

```text
trago-final.png
```

No mostrar el proceso de morph.

No hacer:

```text
base + garnish + final superpuestos
```

## Implementación recomendada

CSS:

```css
@media (prefers-reduced-motion: reduce) {
  .clock-drink__handoff-clock,
  .clock-drink__base,
  .clock-drink__garnish {
    display: none;
  }

  .clock-drink__final {
    opacity: 1;
  }
}
```

La sección debe seguir teniendo sentido.

---

# 36. Sin JavaScript

La página debe mostrar:

```text
Scene 00:
title + reloj

Scene 01:
trago final
```

Para lograrlo:

el estado NATURAL del componente del cocktail debe favorecer al final.

No dejar todos los elementos ocultos desde CSS y confiar en GSAP.

## Patrón

CSS base:

```text
final visible
base/garnish/handoff no críticos
```

Cuando JS arranca:

`gsap.set()` prepara los estados animados.

Esto replica el principio que ya usa `ExperienceIntro`.

---

# 37. homeExperience.ts

El archivo actual tiene:

```text
IntroTimeline
FilmTimeline
```

Refactorizar a:

```text
IntroTimeline
DrinkTimeline
```

Eliminar de esta iteración:

- queries de video;
- `loadedmetadata`;
- `video.currentTime`;
- preload upgrade;
- video error listener;
- `scrubState`;
- `filmTween`.

NO borrar necesariamente utilidades del repo que sirvan para el futuro, pero `initHomeExperience()` no debe seguir cargando lógica de video inexistente.

---

# 38. No registrar ScrollTrigger nuevamente

Seguir utilizando:

```ts
getScrollTrigger()
```

desde:

```text
src/lib/motion/gsap.ts
```

No hacer:

```ts
gsap.registerPlugin(ScrollTrigger)
```

en el nuevo componente o en un tercer archivo.

La rama ya centraliza esto correctamente.

---

# 39. Lenis

No crear otra instancia.

Continuar usando:

```text
createSmoothScroll()
```

existente.

Una única instancia para toda la página.

---

# 40. Cleanup

Toda nueva timeline debe añadirse al sistema de cleanup ya existente.

Al desmontar:

```text
drinkTl.scrollTrigger?.kill()
drinkTl.kill()
```

No matar todos los ScrollTriggers globalmente.

NO:

```ts
ScrollTrigger.getAll().forEach(t => t.kill())
```

---

# 41. Refresh / responsive measurements

Las posiciones de docking dependen de viewport y tamaño real de assets.

Usar:

```text
invalidateOnRefresh: true
```

y function-based GSAP values donde aplique.

Evitar guardar `getBoundingClientRect()` una sola vez al load si luego cambia por:

- orientation;
- mobile browser chrome;
- resize;
- font loading.

---

# 42. Mobile

No intentar copiar exactamente desktop.

Mobile necesita:

- título más compacto;
- reloj menos ancho;
- handoff más centrado;
- cocktail más grande en proporción a viewport;
- menos recorrido;
- menos movimiento lateral.

## Valores iniciales

Intro existente:

```text
180svh
```

Drink:

```text
190svh
```

Cocktail:

```css
width: min(78vw, 26rem);
```

Target garnish:

aproximadamente:

```text
x: 58–62vw
y: 35–41svh
```

Calibrar visualmente.

---

# 43. Viewport units

Continuar usando:

```text
svh
```

como unidad principal para las escenas.

No volver a `100vh` indiscriminadamente.

---

# 44. LCP y carga de assets

`reloj.png` sigue siendo LCP candidate.

Mantener:

```html
fetchpriority="high"
decoding="async"
```

Los assets del trago son segunda escena.

Pueden usar:

```html
decoding="async"
```

y, si se comprueba que no aparecen inmediatamente en el primer viewport:

```html
loading="eager"
```

puede seguir siendo razonable porque son necesarios para la transición temprana.

No usar lazy loading si provoca que el usuario llegue al morph sin imagen decodificada.

---

# 45. Predecode de los assets del cocktail

Antes de activar la `DrinkTimeline`, intentar que:

```text
trago-base
reloj-gajo
trago-final
```

estén decodificados.

Se puede usar:

```ts
await image.decode()
```

con guards.

Nunca bloquear indefinidamente la página si falla.

Si un asset no decodifica:

mostrar `trago-final` como fallback.

---

# 46. No animar propiedades de layout

Priorizar:

```text
transform
opacity
```

Evitar durante scrub:

```text
width
height
top
left
margin
filter pesado
box-shadow gigante
```

Las posiciones base se resuelven en CSS.

GSAP mueve transforms.

---

# 47. Fondo final

El trago final debe quedar sobre:

```text
--nodo-night
+
haze verde
+
glow cálido del producto
+
grain global
```

No poner la foto de bar de fondo todavía.

No usar video todavía.

El final de esta iteración debe ser una imagen de producto limpia y poderosa.

---

# 48. Sensación de escala

Referencia Mùn:

el objeto protagonista no se trata como una card.

NODO tampoco.

NO:

```text
card
border
rounded container
caption box
button flotante
```

Sí:

```text
objeto aislado
aire
oscuridad
luz
tipografía editorial
scroll
```

---

# 49. No agregar copy al cocktail por ahora

En esta iteración NO agregar:

- nombre del cocktail;
- ingredientes;
- precio;
- tasting notes;
- CTA;
- “ver carta”.

Primero resolver el gesto visual.

Luego la siguiente iteración decidirá cómo aparece información alrededor del producto.

---

# 50. Debug mode para calibrar

Crear, si ayuda, un modo TEMPORAL de desarrollo.

Ejemplo:

```text
?debugExperience=1
```

o una constante DEV.

Puede mostrar:

- handoff dock;
- garnish anchor;
- bounding boxes;
- center points;
- opacity labels.

Nunca debe aparecer en producción.

No dejar estilos debug activos.

---

# 51. Método recomendado de calibración

Orden exacto:

### Paso 1
Montar `trago-final.png` solo.

Ajustar:

```text
width
center X
center Y
```

hasta que la composición final se vea correcta.

### Paso 2
Poner `trago-base.png` exactamente en la misma caja.

### Paso 3
Poner `trago-final` a `opacity: .5`.

### Paso 4
Montar `reloj-gajo.png`.

Ajustarlo hasta que su reloj coincida con el garnish del final.

### Paso 5
Apagar `trago-final`.

Validar:

```text
base + gajo
```

### Paso 6
Determinar centro del dial del garnish.

Ese punto define el destino del handoff clock.

### Paso 7
Alinear el frame inicial de Scene 01 con el frame final de Scene 00.

### Paso 8
Recién entonces animar.

No diseñar los timings antes de que el frame estático funcione.

---

# 52. Timing perceptual

La secuencia no debe ser uniforme.

Debe sentirse:

```text
HOLD
movimiento
HOLD
transformación
HOLD
```

No:

```text
movimiento constante durante 100% del scroll
```

Los holds generan lujo y control.

---

# 53. Dirección del scroll inverso

Todo debe ser reversible.

Si el usuario vuelve hacia arriba:

```text
trago-final
↓
base + garnish
↓
garnish → reloj
↓
handoff
↓
reloj grande
↓
lettering
```

No usar callbacks destructivos que impidan el reverse.

Evitar lógica tipo:

```ts
once: true
```

en la transformación principal.

---

# 54. Tests E2E

Actualizar Playwright.

Como mínimo validar:

1. la home responde;
2. existe H1;
3. existe `img[src="/reloj.png"]`;
4. existe `img[src="/trago-base.png"]`;
5. existe `img[src="/reloj-gajo.png"]`;
6. existe `img[src="/trago-final.png"]`;
7. existe `[data-clock-drink]`;
8. no hay overflow horizontal;
9. no hay console errors;
10. con reduced motion el final del cocktail es visible;
11. `ScrollFilm` no está montado en la home;
12. la página funciona con JS deshabilitado a nivel de contenido esencial.

---

# 55. QA visual desktop

Probar al menos:

```text
1366 × 768
1440 × 900
1920 × 1080
2560 × 1440
```

Buscar:

- title clipping;
- reloj cortado;
- garnish fuera del vaso;
- handoff con salto;
- ghosting base/final;
- clock demasiado pequeño;
- cocktail demasiado grande;
- seams entre fondos.

---

# 56. QA mobile

Probar:

```text
375 × 667
390 × 844
393 × 852
430 × 932
```

Además:

- Safari iOS;
- Chrome Android si es posible;
- orientación vertical;
- orientación horizontal básica.

No bloquear scroll touch.

---

# 57. Performance

Revisar:

- scroll FPS;
- paint flashing;
- layout shifts;
- asset decode;
- long tasks;
- memory;
- composición GPU.

No convertir todos los elementos en `will-change`.

Usarlo sólo durante elementos realmente animados.

---

# 58. Criterios de aceptación visual

La tarea está terminada sólo si se cumplen todos:

### Inicio
- el reloj es el protagonista;
- el lettering se siente integrado y editorial;
- NODO conserva verde/dorado/crema;
- el cielo sigue siendo sutil;
- no parece una landing SaaS.

### Handoff
- no existe fade-to-black;
- no existe flash;
- no existe salto perceptible del reloj;
- el usuario siente que sigue mirando el mismo objeto.

### Transformación
- el vaso aparece detrás;
- el reloj converge sobre la zona del garnish;
- el crossfade reloj → reloj-gajo ocurre en el mismo punto;
- no parece un sticker agregado;
- el composite base + gajo tiene un hold legible.

### Final
- el crossfade a `trago-final.png` no genera ghosting notable;
- sólo queda el cocktail final;
- el cocktail respira;
- el fondo permanece oscuro y premium;
- no se muestra video.

---

# 59. Qué NO hacer

No:

```text
Three.js
WebGL
canvas
SVG morph
React island
Framer Motion
nuevo smooth-scroll
loader
video
audio
cursor custom
cocktail text
CTA
navbar nuevo
cards
section divider
fade-to-black
stock footage
```

---

# 60. Cambios de archivos esperados

Como mínimo:

```text
MODIFY
src/pages/index.astro

MODIFY
src/components/home/ExperienceIntro.astro

CREATE
src/components/home/ClockDrinkScene.astro

MODIFY
src/lib/motion/homeExperience.ts
```

Posiblemente:

```text
MODIFY
tests/*
```

No es necesario modificar:

```text
tokens.css
global.css
gsap.ts
lenis.ts
pointerParallax.ts
deviceTilt.ts
```

salvo bug real demostrado.

---

# 61. Tratamiento de ScrollFilm existente

`ScrollFilm.astro` y su idea quedan reservados para la siguiente etapa.

En esta iteración:

```text
PRESERVAR ARCHIVO
NO MONTAR
NO DESARROLLAR
```

El siguiente feature podrá implementar:

```text
trago-final
↓ scroll
video / recorrido por NODO
```

Pero no mezclarlo ahora.

---

# 62. Validación técnica final

Ejecutar:

```bash
pnpm check
pnpm lint
pnpm format
pnpm build
pnpm validate
pnpm test:e2e
```

No entregar con:

- warnings nuevos relevantes;
- console errors;
- rutas 404 de assets;
- imágenes rotas;
- tests ignorados para “hacer verde” la suite.

---

# 63. Entrega del agente

Al terminar reportar:

1. branch y commit;
2. archivos creados;
3. archivos modificados;
4. posición final desktop del handoff;
5. posición final mobile del handoff;
6. scale final del reloj;
7. CSS final del garnish;
8. timing final de IntroTimeline;
9. timing final de DrinkTimeline;
10. resultado de `pnpm validate`;
11. resultado de `pnpm test:e2e`;
12. screenshots:
    - hero inicial;
    - reloj docked;
    - base + garnish;
    - cocktail final;
    - mobile final.

---

# 64. Principio final

No evaluar la implementación preguntando:

> “¿la animación funciona?”

Evaluarla preguntando:

> “¿parece que el reloj realmente encontró su lugar dentro del cocktail?”

La referencia Mùn funciona porque el símbolo y el producto pertenecen al mismo relato visual.

Ese debe ser el resultado de NODO:

```text
TIEMPO
↓
NOCHE
↓
RELOJ
↓
GARNISH
↓
COCKTAIL
```

El scroll no cambia secciones.

**El scroll transforma significado.**
