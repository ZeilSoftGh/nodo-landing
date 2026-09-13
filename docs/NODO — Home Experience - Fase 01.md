# NODO LANDING — FASE 01  
## Intro “Bienvenido a la experiencia NODO” + reloj + transición a video controlado por scroll

## 0. Objetivo

Implementar la primera secuencia real de la landing principal de **NODO Cóctel Bar**, reemplazando la actual página-especimen visual por una experiencia de entrada cinematográfica.

Esta fase comprende únicamente:

1. Hero inicial fullscreen.
2. Texto principal:
   **“Bienvenido a la experiencia NODO”**.
3. Uso de `/public/reloj.png` como objeto visual protagonista.
4. Comportamiento del reloj inspirado conceptualmente en la luna del sitio de Mùn Rooftop:
   - objeto dominante;
   - composición editorial;
   - scroll como controlador de la escena;
   - transformación suave;
   - desaparición progresiva del objeto;
   - transición hacia la siguiente experiencia.
5. Segunda escena fullscreen preparada para contener un video.
6. El video deberá avanzar y retroceder según el scroll del usuario.
7. El video definitivo todavía NO existe, por lo que la implementación debe tolerar su ausencia sin romper la página.
8. Dejar una arquitectura reutilizable para continuar agregando las próximas secciones de la landing.

No construir todavía carta, reservas, about, galería, cocktails 3D ni las secciones posteriores.

---

# 1. Repo y branch

Repositorio:

`ZeilSoftGh/nodo-landing`

IMPORTANTE:

El desarrollo visual actual se encuentra en:

`dev`

La rama `main` todavía conserva un placeholder técnico mucho más básico.

### Trabajar desde

```bash
git checkout dev
git pull
```

Preferentemente crear:

```bash
git checkout -b feat/home-experience-intro
```

No partir de `main`.

---

# 2. Estado actual que debe respetarse

El proyecto ya posee un core definido.

Stack actual:

```text
Astro
TypeScript strict
React Islands
Tailwind CSS 4
GSAP
ScrollTrigger
Lenis
Three.js
React Three Fiber
Drei
Playwright
```

No cambiar de framework.

No migrar la home a React.

No crear una SPA.

No instalar Framer Motion.

No agregar nuevas dependencias de animación salvo que exista una razón técnica muy fuerte.

Para esta primera experiencia:

```text
Astro
CSS
GSAP
ScrollTrigger
Lenis
HTMLVideoElement
```

son suficientes.

### NO utilizar Three.js para esta fase.

El reloj es un PNG y el video será un elemento HTML `<video>`.

Three.js queda reservado para futuras experiencias donde realmente aporte valor: cocktails 3D, escenas WebGL, shaders, etc.

---

# 3. Sistema visual existente

NO redefinir la marca.

Mantener los tokens existentes en:

```text
src/styles/tokens.css
```

Paleta principal:

```css
--nodo-night: #071311;
--nodo-ink: #0a0d0c;

--nodo-deep: #0d3f37;
--nodo-teal: #056454;
--nodo-teal-bright: #0b806d;

--nodo-gold: #c9a743;
--nodo-gold-soft: #e4c77a;

--nodo-cream: #efe8d0;
--nodo-stone: #a9aa98;

--nodo-copper: #d47727;
--nodo-vermouth: #a52d25;
```

Roles principales:

```css
--color-bg: var(--nodo-night);
--color-text: var(--nodo-cream);
--color-accent: var(--nodo-gold);
--color-accent-strong: var(--nodo-gold-soft);
```

La estética debe continuar siendo:

```text
oscura
nocturna
editorial
premium
cálida
sobria
sensorial
cinematográfica
```

Evitar:

```text
glassmorphism genérico
gradientes purple/blue tecnológicos
cards SaaS
bordes redondeados excesivos
neón permanente
UI estilo dashboard
animaciones elásticas
efectos llamativos sin propósito
```

NODO no debe parecer una startup.

Debe sentirse como entrar a un cocktail bar.

---

# 4. Tipografía

Mantener el sistema actual.

Display/editorial:

```css
var(--font-display)
```

Utility/UI:

```css
var(--font-sans)
```

Actualmente:

```css
--font-display:
  'Instrument Serif',
  'Bodoni Moda',
  'Cormorant Garamond',
  'Iowan Old Style',
  'Baskerville',
  'Times New Roman',
  serif;

--font-sans:
  'Manrope',
  'Avenir Next',
  'Helvetica Neue',
  sans-serif;
```

No cambiar esta decisión todavía.

---

# 5. Concepto general de la primera experiencia

La primera impresión debe ser muy simple.

No intentar mostrar información del bar todavía.

El usuario entra y encuentra:

```text
BIENVENIDO A LA

EXPERIENCIA NODO

            [ RELOJ ]
```

o una composición equivalente donde el reloj participe directamente de la tipografía.

La página debe comunicar:

> “Entraste a NODO”.

No:

> “Esta es la página web de un bar”.

---

# 6. Referencia conceptual: Mùn

La referencia es el comportamiento del objeto protagonista de Mùn, especialmente la luna.

NO copiar:

- composición exacta;
- textos;
- assets;
- colores;
- dimensiones;
- branding;
- código.

Sí tomar como principio:

```text
un objeto
+
tipografía
+
mucho aire
+
scroll
+
transformación cinematográfica
```

El reloj de NODO cumple el papel que cumple la luna en esa experiencia.

---

# 7. Asset del reloj

El asset definitivo será:

```text
/public/reloj.png
```

En Astro debe consumirse como:

```html
<img src="/reloj.png" ... />
```

NO:

- recrear el reloj con CSS;
- dibujar otro reloj;
- generar un SVG alternativo;
- reconstruirlo con canvas;
- separar agujas artificialmente;
- reemplazarlo por un placeholder circular.

Usar exactamente el PNG suministrado.

### Importante

El reloj en esta fase es un **objeto gráfico**, no un reloj funcional.

No intentar sincronizar las agujas con la hora real.

No intentar animar individualmente las agujas si el PNG no está preparado en capas.

La animación se realiza sobre el elemento completo.

---

# 8. Arquitectura propuesta

Crear:

```text
src/
├── components/
│   └── home/
│       ├── ExperienceIntro.astro
│       └── ScrollFilm.astro
│
├── lib/
│   └── motion/
│       ├── gsap.ts
│       ├── lenis.ts
│       └── homeExperience.ts
│
├── pages/
│   ├── index.astro
│   └── styleguide.astro
│
└── styles/
    ├── global.css
    ├── tokens.css
    └── typography.css
```

No es obligatorio que los nombres sean exactamente estos si existe una razón técnica, pero mantener esta separación conceptual.

---

# 9. Preservar el specimen actual

La home de `dev` actualmente funciona como specimen del sistema visual.

No tirarlo.

Moverlo a algo como:

```text
src/pages/styleguide.astro
```

y marcar esa página:

```text
noindex
```

Debe seguir siendo posible consultar internamente:

```text
/styleguide
```

para comparar tokens, componentes y dirección visual.

La nueva:

```text
src/pages/index.astro
```

pasa a ser la experiencia real.

---

# 10. Nueva index.astro

La página principal debe ser extremadamente simple.

Conceptualmente:

```astro
<BaseLayout
  title="NODO — Cóctel Bar"
  description="Bienvenido a la experiencia NODO."
>
  <ExperienceIntro />
  <ScrollFilm />
</BaseLayout>
```

No meter toda la animación directamente en `index.astro`.

`index.astro` debe actuar como compositor de secciones.

Esto será importante cuando aparezcan posteriormente:

```text
ExperienceIntro
ScrollFilm
BarStory
SignatureCocktails
MenuExperience
Atmosphere
Reservation
Footer
```

---

# 11. SECCIÓN 01 — EXPERIENCE INTRO

Crear:

```text
ExperienceIntro.astro
```

Esta sección es el verdadero hero.

Debe ocupar visualmente el viewport completo.

Utilizar:

```css
100svh
```

en lugar de depender únicamente de `100vh`.

La sección completa necesita recorrido extra para permitir scroll-driven animation.

Orientativo desktop:

```css
.experience-intro {
  min-height: 220svh;
}
```

Dentro:

```css
.experience-intro__viewport {
  position: sticky;
  top: 0;
  height: 100svh;
  overflow: hidden;
}
```

Preferir **CSS sticky + animación GSAP** antes que depender de `pin: true` para toda la estructura.

Razón:

- mejor progressive enhancement;
- menos saltos de layout;
- estructura usable sin JavaScript;
- comportamiento más predecible en mobile.

ScrollTrigger sigue controlando la animación.

---

# 12. Fondo inicial

Fondo base:

```css
background: var(--nodo-night);
```

Agregar profundidad muy sutil mediante:

```text
radial gradients
green haze
aged gold glow
grain existente
```

NO hacer el fondo demasiado activo.

Debe predominar la oscuridad.

Ejemplo conceptual:

```css
background:
  radial-gradient(
    circle at 50% 50%,
    rgb(13 63 55 / 0.28),
    transparent 42%
  ),
  var(--nodo-night);
```

No copiar literalmente si la composición final pide otros valores.

## Capa de cielo decorativa (upgrade v4)

Sobre el velo se agrega `.experience-sky` (atributo `data-experience-sky`), una capa decorativa 100 % DOM/SVG —sin canvas, sin WebGL y sin assets nuevos— con 150 puntos de polvo (75 en mobile) y 11 chispas doradas (8 en mobile) enmascaradas con el logo plano existente (`/nodo_logo_vector_flat.svg`). Es `aria-hidden`, `pointer-events: none` y se desvanece junto con el velo entre el 35 % y el 65 % del scroll del intro. Composición y valores exactos: `docs/design/experience-intro/DESIGN_SPEC.md` §5.

---

# 13. Texto principal

Markup semántico.

Debe existir un único H1 real.

Por ejemplo:

```html
<h1 class="experience-intro__title">
  <span>Bienvenido a la</span>
  <span>experiencia NODO</span>
</h1>
```

No renderizar el texto en canvas.

No convertirlo en imagen.

Esto es importante para:

```text
SEO
accesibilidad
selección de texto
responsive
indexación
```

---

# 14. Dirección tipográfica

El texto debe sentirse editorial.

No utilizar un H1 genérico centrado.

Propuesta:

```text
BIENVENIDO A LA
                  [reloj]
EXPERIENCIA NODO
```

o:

```text
        BIENVENIDO

        A LA EXPERIENCIA

               NODO
```

con el reloj entrando en tensión con la composición.

El agente tiene libertad para ajustar la composición según el asset real, pero debe conservar:

```text
mucha escala
mucho espacio negativo
poco contenido
contraste fuerte
jerarquía editorial
```

### Tamaño orientativo

Desktop:

```css
font-size: clamp(4rem, 9vw, 10rem);
```

Mobile:

```css
font-size: clamp(3rem, 15vw, 6rem);
```

No forzar estos valores si generan overflow.

---

# 15. Color del texto

Predominante:

```css
color: var(--nodo-cream);
```

NODO puede llevar:

```css
color: var(--nodo-gold-soft);
```

pero evitar pintar demasiadas palabras en dorado.

El dorado debe funcionar como joyería:

**poco y con intención.**

---

# 16. El reloj como objeto protagonista

El reloj debe estar en una capa independiente.

Markup orientativo:

```html
<div class="experience-clock" data-experience-clock>
  <img
    src="/reloj.png"
    alt=""
    width="..."
    height="..."
    decoding="async"
    fetchpriority="high"
  />
</div>
```

Si es puramente decorativo:

```html
alt=""
aria-hidden="true"
```

El texto ya comunica la experiencia.

---

# 17. Escala inicial del reloj

Debe sentirse importante.

Desktop aproximado:

```css
width: clamp(18rem, 40vw, 42rem);
max-width: calc(40svh * (1672 / 941));
```

No usar un tamaño fijo.

Mobile:

```css
width: min(80vw, 24rem);
max-width: calc(32svh * (1672 / 941));
```

Debe permanecer completo dentro del viewport en el estado inicial.

No cortar partes críticas del reloj.

Estos valores (aprobados en el upgrade v4) son parte del contrato de no-oclusión tipografía↔reloj: `row-gap` desktop `clamp(12rem, 52svh, 34rem)` y mobile `clamp(7.5rem, 34svh, 16rem)`. No se recalibran sin volver a medir el contrato (`docs/design/experience-intro/DESIGN_SPEC.md` §3/§7).

---

# 18. Profundidad del reloj

No inventar efectos exagerados.

Se permite:

```css
filter:
  drop-shadow(0 2rem 4rem rgb(0 0 0 / 0.42))
  drop-shadow(0 0 3rem rgb(201 167 67 / 0.08));
```

Muy sutil.

La propia imagen debe seguir dominando.

---

# 19. Animación de entrada al cargar

Al entrar a `/`, antes de comenzar a scrollear:

### Estado inicial

Texto:

```text
opacity: 0
transform: translateY(24px)
```

Reloj:

```text
opacity: 0
transform:
  scale(.94)
  translateY(30px)
```

### Entrada

Aproximadamente:

```text
0.8–1.2 segundos
```

Easing:

```text
power3.out
```

o:

```text
var(--ease-nodo)
```

No usar:

```text
bounce
elastic
back
```

La entrada debe ser lenta, pesada y elegante.

---

# 20. Scroll de la primera escena

Después de la animación inicial, el scroll toma el control.

La experiencia debe ser completamente reversible.

Si el usuario baja:

```text
intro → transición → video
```

Si vuelve hacia arriba:

```text
video → reloj → intro
```

Nunca hacer una animación destructiva que sólo funcione hacia abajo.

---

# 21. Timeline del intro

Crear una única timeline para esta sección.

Conceptualmente:

```ts
gsap.timeline({
  scrollTrigger: {
    trigger: intro,
    start: 'top top',
    end: 'bottom bottom',
    scrub: true,
  },
});
```

No copiar este código sin adaptar.

---

# 22. Fases del scroll intro

Usar aproximadamente esta progresión.

## 0% → 15%

Escena estable.

El usuario comienza a mover la página.

Sólo cambios mínimos:

```text
reloj translateY -1/2vh
texto translateY -1vh
```

La escena debe “resistir” un poco al scroll.

---

## 15% → 40%

El título se parte lateralmente (salida aprobada en el upgrade v4):

```text
línea 1: xPercent 0 → -120 (hacia la izquierda)
línea 2: xPercent 0 → +120 (hacia la derecha)
```

Ambas líneas arrancan juntas en 15 y completan en 40, sin stagger y sin fade: sólo `xPercent`, ni `opacity` ni `translateY` ni `letter-spacing`. El ejemplo anterior (fade + uplift + letter-spacing abierto) queda **superseded** por decisión explícita del usuario (2026-09-10): el desplazamiento vertical medido ocluía el reloj y la salida lateral conserva la no-oclusión (`docs/design/experience-intro/DESIGN_SPEC.md` §2/§12). El `overflow: hidden` del viewport sticky recorta el desplazamiento.

---

## 20% → 55%

El reloj empieza a transformarse.

Propuesta:

```text
scale: 1 → 0.72
yPercent: 0 → -8
rotation: 0 → 3deg
```

La rotación debe ser extremadamente leve.

No debe parecer un spinner.

---

## 35% → 65%

La escena siguiente comienza a hacerse visible detrás.

El fondo oscuro del intro pierde peso.

La capa del video:

```text
opacity: 0 → 1
scale: 1.04 → 1
```

Debe sentirse como si detrás del reloj existiera otra habitación.

---

## 55% → 85%

El reloj **aterriza en el dock** (v6) en lugar de desaparecer: viaja al centro de `[data-experience-dock]` (desktop 106×300 / mobile 54×150), con `scale 0.72 → 0.32` (desktop) / `0.30` (mobile), `rotation → 0`, sin `opacity` y sin `blur`. Queda **visible y nítido al 100 %**; el dock es además el marco del futuro drink (spec-only).

El ejemplo anterior (`scale: 0.72 → 0.28`, `opacity: 1 → 0`, `filter blur: 0 → 2px`) queda **superseded** por decisión explícita de v6: las ventanas de §22 se preservan (20–55 transform, 55–85 aterrizaje) y sólo cambia el contenido de 55–85. Referencia: `docs/design/experience-intro/DESIGN_SPEC.md` §13.2/§13.5.

---

## 85% → 100%

Sólo queda la primera imagen/frame de la escena de video.

No debe haber salto visual cuando termina la primera sección y comienza la segunda.

### Nota de upgrade (cielo + tilt + v5/v6)

El intro suma un tilt sutil según el input del dispositivo —parallax de puntero en desktop (>800 px, pointer fino) y giroscopio en mobile (≤800 px, pointer coarse)— con **pipeline automático de permiso (sin controles; retry por interacciones de activación con cap de 5 intentos) y label de denegación en iOS** (“Viví la experiencia completa” + hint de Ajustes › Safari), una deriva del cielo dentro del mismo timeline de scroll (`introTl`) y, desde v6, la **continuidad intro→film** (el fallback del film copia el stack del velo y el overlay queda oculto hasta que exista video real con metadatos) y el **aterrizaje del reloj en el dock** (55–85 %; reemplaza el dissolve). No se agregan timelines con ScrollTrigger (siguen siendo 2) ni propiedades animadas fuera de `transform`/`opacity`. Detalle y valores: `docs/design/experience-intro/DESIGN_SPEC.md` y `docs/superpowers/specs/2026-09-10-experience-intro-sky-tilt-design.md`.

---

# 23. Transición reloj → video

Esta transición es una de las partes más importantes.

NO hacer:

```text
hero
fade to black
video
```

Eso rompe la experiencia.

El video debe aparecer **por debajo** de la escena del reloj mientras éste desaparece.

La sensación debe ser:

```text
estábamos mirando una pieza gráfica
↓
la gráfica pierde protagonismo
↓
descubrimos que detrás estaba NODO
↓
entramos al espacio
```

---

# 24. SECCIÓN 02 — SCROLL FILM

Crear:

```text
ScrollFilm.astro
```

El video será una escena fullscreen.

Estructura orientativa:

```html
<section class="scroll-film" data-scroll-film>
  <div class="scroll-film__viewport">
    <video
      data-scroll-film-video
      muted
      playsinline
      preload="metadata"
      aria-hidden="true"
    ></video>

    <div class="scroll-film__overlay"></div>
  </div>
</section>
```

---

# 25. Video futuro

Definir desde ahora una ruta convencional.

Por ejemplo:

```text
/public/video/nodo-experience.mp4
```

y opcional posteriormente:

```text
/public/video/nodo-experience.webm
```

No crear un falso MP4.

No descargar videos stock.

No generar un placeholder audiovisual genérico.

Hasta tener el material real debe verse simplemente el fallback visual de NODO.

---

# 26. Estado sin video

Como el video todavía no fue grabado, la sección NO debe romperse cuando el archivo no exista.

El componente debe manejar:

```text
loadedmetadata
canplay
error
```

En caso de error:

```text
mantener fondo NODO
mantener overlay
no ejecutar video.currentTime
no imprimir error visual
no mostrar icono roto
```

Puede registrarse:

```js
console.info(...)
```

sólo durante desarrollo.

No mostrar:

```text
VIDEO PENDIENTE
PLACEHOLDER
ERROR
```

al usuario.

---

# 27. Fondo fallback del video

Mientras no exista el material:

```css
background:
  radial-gradient(...),
  linear-gradient(...),
  var(--nodo-night);
```

Debe conectarse visualmente con el hero.

Cuando agreguemos el video real no debería ser necesario rediseñar la sección.

---

# 28. Comportamiento del video con scroll

El video NO se reproduce automáticamente a velocidad normal.

Su timeline debe estar ligada al scroll.

Concepto:

```text
scroll progress 0.00 → video 0%
scroll progress 0.25 → video 25%
scroll progress 0.50 → video 50%
scroll progress 0.75 → video 75%
scroll progress 1.00 → video 100%
```

Si el usuario vuelve hacia arriba:

```text
video.currentTime retrocede
```

Debe sentirse como una secuencia cinematográfica manipulada por el usuario.

---

# 29. Longitud de ScrollFilm

Orientativo desktop:

```css
.scroll-film {
  min-height: 350svh;
}
```

Con:

```css
.scroll-film__viewport {
  position: sticky;
  top: 0;
  height: 100svh;
}
```

Eso genera aproximadamente tres pantallas y media de recorrido para el video.

El valor final deberá calibrarse cuando exista el material.

No hardcodear una relación temporal basada en una duración imaginaria.

---

# 30. Scrubbing del HTMLVideoElement

Esperar obligatoriamente:

```text
loadedmetadata
```

antes de consultar:

```js
video.duration
```

Después crear el controlador.

Una aproximación válida:

```ts
const state = { time: 0 };

gsap.to(state, {
  time: video.duration,
  ease: 'none',
  scrollTrigger: {
    trigger: section,
    start: 'top top',
    end: 'bottom bottom',
    scrub: true,
    onUpdate: () => {
      video.currentTime = state.time;
    },
  },
});
```

Pero optimizar las escrituras a `currentTime`.

Idealmente no asignar decenas de veces dentro del mismo frame.

Utilizar `requestAnimationFrame` o una estrategia equivalente si es necesario.

---

# 31. Requisito de encoding para el video futuro

Cuando se entregue el video real, recordar que **un MP4 normal de delivery no necesariamente scrubea bien**.

Solicitar/exportar preferentemente:

```text
codec: H.264
container: MP4
resolution: 1920x1080
fps: 24 o 25
audio: ninguno
pixel format: yuv420p
faststart: sí
```

Muy importante:

```text
keyframes frecuentes
```

Ideal:

```text
GOP 6–12 frames
```

aproximadamente.

Esto hace que buscar frames mediante `currentTime` sea mucho más responsivo.

Si el video final tiene demasiados problemas de seeking, considerar posteriormente:

```text
frame sequence + canvas
```

pero NO implementarlo todavía.

Primero probar `<video>`.

---

# 32. Video visual

El video debe cubrir todo el viewport:

```css
position: absolute;
inset: 0;
width: 100%;
height: 100%;
object-fit: cover;
```

Nunca deformar el aspect ratio.

---

# 33. Overlay del video

Debe existir una capa separada.

Algo como:

```text
top:
dark green / transparent

bottom:
night / transparent
```

Razones:

- continuidad de marca;
- mejorar exposición;
- permitir textos futuros;
- evitar que el video parezca pegado encima de la web.

No editar el video mediante filtros extremos.

---

# 34. Movimiento adicional del video

Durante el scrub se permite una transformación muy leve:

```text
scale 1.03 → 1.00
```

o similar.

No combinar:

```text
scrub
+ zoom fuerte
+ blur
+ parallax
+ rotation
```

al mismo tiempo.

La filmación futura debe ser protagonista.

---

# 35. Preparar el video antes de llegar

No descargar el video completo apenas carga la home si todavía estamos lejos de la escena.

Inicialmente:

```html
preload="metadata"
```

Cuando el scroll de la primera escena alcance aproximadamente:

```text
30–40%
```

se puede pasar una única vez a:

```text
preload="auto"
```

si el navegador lo permite.

Objetivo:

```text
tener frames disponibles antes de revelar completamente la escena
```

sin bloquear el First Contentful Paint.

---

# 36. GSAP

Usar el core ya existente.

Actualmente existe:

```text
src/lib/motion/gsap.ts
```

con:

- lazy ScrollTrigger;
- reduced motion;
- cleanup explícito.

No romper esa filosofía.

Si hace falta, extender ese módulo para exponer una forma segura de obtener/registrar ScrollTrigger.

Ejemplo conceptual:

```ts
export async function getScrollTrigger() {
  const { ScrollTrigger } = await import('gsap/ScrollTrigger');
  gsap.registerPlugin(ScrollTrigger);

  return ScrollTrigger;
}
```

No registrar plugins en cinco archivos distintos.

---

# 37. homeExperience.ts

Centralizar la lógica específica de la landing en:

```text
src/lib/motion/homeExperience.ts
```

Debe encargarse de:

```text
intro load animation
intro scroll timeline
reloj transform
transition hacia film
video scrub
cleanup
resize / refresh
reduced motion
```

No mezclar esta lógica con CSS ni con contenido.

---

# 38. Cleanup obligatorio

Toda inicialización debe devolver cleanup.

Ejemplo conceptual:

```ts
const cleanup = initHomeExperience();

document.addEventListener('astro:before-swap', cleanup);
```

o el mecanismo correspondiente según la arquitectura actual.

Aunque hoy no exista View Transitions/router, escribirlo correctamente.

Al destruir:

```text
kill timeline
kill ScrollTriggers creados
cancel requestAnimationFrame
remove event listeners
destroy Lenis si esta instancia lo creó
```

No usar:

```js
ScrollTrigger.getAll().forEach(...)
```

si eso puede matar triggers pertenecientes a otras secciones.

Guardar referencias sólo de lo creado por esta experiencia.

---

# 39. Lenis

El repo ya posee:

```text
src/lib/motion/lenis.ts
```

No crear una segunda implementación separada.

Para desktop se puede integrar Lenis con ScrollTrigger.

Debe existir sincronización:

```text
lenis scroll → ScrollTrigger.update()
GSAP ticker → lenis.raf()
```

No ejecutar dos `requestAnimationFrame` loops independientes sin necesidad.

---

# 40. Mobile y touch

No intentar hacer que mobile se comporte exactamente como desktop a cualquier costo.

En touch:

```text
mantener scroll nativo o muy cercano a nativo
```

No bloquear touch scroll.

No crear scroll-jacking.

El video debe conservar:

```html
muted
playsinline
```

---

# 41. Responsive del intro

Desktop:

```text
reloj protagonista
tipografía muy grande
composición horizontal/editorial
```

Mobile:

```text
reloj más centrado
texto dividido en 2–4 líneas
composición vertical
menos recorrido de scroll
```

Orientativo:

Desktop intro:

```text
220svh
```

Mobile:

```text
170–190svh
```

Desktop video:

```text
350svh
```

Mobile:

```text
220–280svh
```

No asumir estos números como definitivos.

Calibrar visualmente.

---

# 42. Safe viewport

Usar preferentemente:

```text
svh
dvh cuando corresponda
```

Evitar depender únicamente de `vh`.

Safari móvil debe poder ocultar/mostrar su UI sin romper el layout.

---

# 43. Reduced motion

Obligatorio soportar:

```css
@media (prefers-reduced-motion: reduce)
```

y la utilidad TS existente.

En este modo:

### Intro

Mostrar inmediatamente:

```text
texto
reloj
```

sin gran entrada animada.

### Scroll

No realizar scrub cinematográfico fuerte.

La página debe degradar a:

```text
hero normal
↓
film / fallback normal
```

El reloj puede desaparecer mediante una transición sencilla o simplemente terminar con la sección.

### Video

No actualizar constantemente `currentTime`.

Mostrar:

```text
primer frame
poster
o fallback
```

La información sigue siendo accesible.

---

# 44. JavaScript deshabilitado

La página debe seguir siendo comprensible.

Sin JS:

```text
hero visible
reloj visible
texto visible
segunda sección visible
fondo correcto
```

No debe quedar:

```text
opacity: 0
```

permanentemente porque GSAP nunca arrancó.

Por eso:

NO colocar estados ocultos críticos sólo desde CSS.

Establecer los estados iniciales animados desde JS mediante:

```js
gsap.set(...)
```

después de confirmar que JS está activo.

---

# 45. Performance del reloj

Como `/reloj.png` es LCP candidate:

usar:

```html
fetchpriority="high"
decoding="async"
```

Si se conocen las dimensiones reales:

```html
width
height
```

para evitar CLS.

No utilizar:

```html
loading="lazy"
```

en el elemento principal del hero.

---

# 46. Performance del video

No dejar el video como LCP.

No debe competir con el reloj y el H1 durante la carga inicial.

Orden:

```text
HTML
CSS
tipografía
reloj
↓
metadata del video
↓
video payload completo
```

---

# 47. Grain existente

El proyecto ya tiene textura/noise global.

Mantenerla.

No agregar otro SVG noise encima de cada sección.

Si en el film la textura global es demasiado visible, ajustar opacidad desde una única fuente.

Evitar dos o tres capas de ruido superpuestas.

---

# 48. SEO

La landing sigue siendo prerender.

Mantener:

```ts
export const prerender = true;
```

El H1 debe existir en HTML.

Título recomendado provisional:

```text
NODO — Cóctel Bar
```

Descripción provisional:

```text
Bienvenido a la experiencia NODO.
```

No sobreoptimizar SEO en esta fase.

---

# 49. Accesibilidad

Obligatorio:

```text
H1 semántico
contraste suficiente
reduced-motion
skip link existente
focus visible existente
sin scroll blocking
```

Reloj decorativo:

```html
alt=""
```

Video ambiental:

```html
aria-hidden="true"
```

No ofrecer controles si el video es puramente visual y su tiempo depende del scroll.

---

# 50. Header

En esta primera fase NO introducir un header tradicional grande.

Queremos que la entrada respire.

Si se conserva marca superior, debe ser extremadamente sutil.

Por ejemplo:

```text
NODO                                      MENÚ
```

pero no es requisito todavía.

Prioridad:

```text
texto + reloj
```

No distraer.

---

# 51. Cursor

No desarrollar todavía un custom cursor complejo.

Puede agregarse posteriormente.

El hero debe funcionar perfectamente con:

```text
mouse
trackpad
wheel
touch
keyboard
```

antes de añadir detalles decorativos.

---

# 52. Scroll indicator

Se permite un indicador discreto al pie:

```text
SCROLL TO ENTER
```

o:

```text
DESCUBRIR
```

pero debe ser mínimo.

Ejemplo:

```text
SCROLL
↓
```

Debe desaparecer pronto al iniciar el recorrido.

No usar un gran botón CTA.

El CTA en esta escena es el propio scroll.

---

# 53. Estado conceptual final de la secuencia

## Entrada

```text
┌──────────────────────────────────────┐
│                                      │
│        BIENVENIDO A LA               │
│                                      │
│             [RELOJ]                  │
│                                      │
│        EXPERIENCIA NODO              │
│                                      │
│               ↓                      │
└──────────────────────────────────────┘
```

---

## Primer scroll

```text
BIENVENIDO...
       ↑ fades

       [RELOJ]
       ↓ empieza a transformarse
```

---

## Transición

```text
               [reloj]
                  ↓
              más pequeño

████████████ VIDEO APARECIENDO █████████
```

---

## Final intro

```text
[reloj aterriza en el dock y permanece visible]

████████████████████████████████████████
██████████ PRIMER FRAME VIDEO ██████████
████████████████████████████████████████
```

> v6: “el reloj desaparece” queda **superseded** — al final del intro el reloj aterriza en el dock (55–85 %) y permanece visible y nítido al 100 %; el estado final es reloj + primer frame del video. Referencia: `docs/design/experience-intro/DESIGN_SPEC.md` §13.2/§13.5.

---

## ScrollFilm

```text
scroll ↓

0 sec
↓
1 sec
↓
2 sec
↓
3 sec
↓
final

scroll ↑

retrocede exactamente en dirección inversa
```

---

# 54. NO hacer todavía

No implementar:

```text
cocktails
cards
menu
reservas
about
Instagram
maps
footer complejo
WebGL
Three.js
React Three Fiber
3D del reloj
shader
loader de porcentaje
audio
música
custom cursor complejo
transiciones entre páginas
CMS
```

Queremos perfeccionar primero:

```text
ENTRY → CLOCK → FILM
```

---

# 55. Calidad esperada

Esta sección NO debe sentirse como:

```text
un hero con fade
```

Debe sentirse como:

```text
una escena
```

La diferencia es importante.

Debe existir continuidad espacial entre estados.

---

# 56. Criterios visuales

La implementación se considera correcta cuando:

### Inicio

- el primer viewport está limpio;
- el reloj domina la composición;
- el H1 se entiende inmediatamente;
- existe suficiente espacio negativo;
- se mantiene la identidad verde/dorado/crema;
- no parece una plantilla.

### Scroll

- el primer movimiento se siente pesado y controlado;
- el texto no desaparece abruptamente;
- el reloj responde suavemente;
- no hay jitter;
- no hay saltos al sticky;
- la experiencia es reversible.

### Transición

- el video aparece mientras el reloj viaja al dock (el reloj no desaparece);
- no existe un corte a negro;
- no existe un cambio de sección evidente;
- se siente una misma escena evolucionando.

> Continuidad v6: “no existe un cambio de sección evidente” se cumple por **alineación exacta de fondos** — el fallback del film copia el stack del velo y el overlay permanece oculto hasta que exista video real con metadatos (delta de píxel muestreado ≤ 2 por canal). El reloj no desaparece: aterriza en el dock y permanece visible al 100 % (`docs/design/experience-intro/DESIGN_SPEC.md` §13.1/§13.2).

### Film

- permanece fullscreen;
- el video responde al scroll;
- al invertir el scroll, el video retrocede;
- no autoplay normal;
- no se reproduce fuera de sincronización.

---

# 57. Comportamiento del video ausente

La implementación debe pasar QA incluso antes de tener:

```text
/public/video/nodo-experience.mp4
```

Si falta:

```text
no crash
no infinite loading
no broken element
no layout shift
no JS error
```

Sólo aparece el fallback oscuro.

---

# 58. Testing

Agregar/actualizar Playwright para comprobar como mínimo:

### Test 1

La home responde correctamente.

### Test 2

Existe:

```text
h1
```

con contenido equivalente a:

```text
Bienvenido a la experiencia NODO
```

### Test 3

Existe:

```text
img[src="/reloj.png"]
```

### Test 4

Existe la sección:

```text
[data-scroll-film]
```

### Test 5

La página no genera overflow horizontal.

### Test 6

El layout existe aunque JavaScript falle.

### Test 7

Reduced motion no inicializa el scrub pesado.

Cuando exista el video real:

### Test 8

Mover el scroll modifica:

```text
video.currentTime
```

---

# 59. Validación final

Antes de considerar terminada esta fase ejecutar:

```bash
pnpm check
pnpm lint
pnpm format
pnpm build
```

Finalmente:

```bash
pnpm validate
```

Si hay tests relevantes:

```bash
pnpm test:e2e
```

No entregar código con errores silenciados.

---

# 60. Performance review

Revisar en Chrome DevTools:

```text
CLS
long tasks
layout thrashing
paint storms
video seeking
scroll FPS
memory
```

No animar propiedades costosas salvo necesidad.

Priorizar:

```text
transform
opacity
```

Evitar animar continuamente:

```text
width
height
top
left
filter blur grande
box-shadow gigante
```

---

# 61. Regla para GSAP

Una timeline por escena.

No hacer:

```text
20 ScrollTriggers independientes
```

si una timeline puede resolverlo.

Ideal:

```text
Intro Timeline
Film Timeline
```

Nada más en esta fase.

---

# 62. Naming

Usar naming semántico.

Correcto:

```text
experience-intro
experience-clock
scroll-film
scroll-film__viewport
scroll-film__video
```

Evitar:

```text
green-section
big-image
animation-1
container2
moon-copy
```

El reloj no se llama moon en el código.

La referencia Mùn es conceptual, no parte del dominio NODO.

---

# 63. Comentarios en código

Documentar únicamente:

```text
por qué existe un workaround
por qué existe un determinado encoding
por qué existe una sincronización GSAP/Lenis
por qué se espera loadedmetadata
```

No comentar obviedades como:

```js
// change opacity
```

---

# 64. Preparación para futuras secciones

La salida de `ScrollFilm` debe permitir posteriormente conectar directamente con:

```text
THE BAR
```

o:

```text
LA NOCHE
```

Por eso no cerrar la sección con un fade-to-black obligatorio.

El último frame debería poder mezclarse posteriormente con la próxima sección.

La landing final se irá construyendo como una secuencia:

```text
00 — EXPERIENCE
     reloj

01 — ENTER NODO
     film scroll

02 — THE BAR
     espacio / bartender

03 — SIGNATURES
     cocktails

04 — MENU
     carta

05 — THE NIGHT
     atmósfera

06 — RESERVATION
```

Sólo implementar `00` y `01` ahora.

---

# 65. Filosofía de interacción

Cada movimiento tiene que responder a una pregunta:

> ¿Esto hace que el usuario sienta que está entrando al bar?

Si no:

el efecto sobra.

Queremos:

```text
lujo
control
misterio
ritmo
anticipación
```

No:

```text
ruido
velocidad
gimmicks
tech demo
```

---

# 66. Resultado esperado de esta fase

Al cargar:

> BIENVENIDO A LA EXPERIENCIA NODO

El reloj funciona como pieza central de identidad.

El usuario hace scroll.

La tipografía comienza a retirarse.

El reloj responde al movimiento, pierde escala y presencia.

Detrás aparece gradualmente la primera imagen de NODO.

El reloj desaparece.

La escena del bar ocupa todo el viewport.

A partir de ese punto el scroll deja de mover visualmente una página convencional y empieza a recorrer el tiempo del video.

El usuario siente que el scroll está **abriendo la puerta a NODO**.

Ese es el criterio principal de éxito.

---

# 67. Entrega del agente

Al finalizar:

1. resumir archivos creados;
2. resumir archivos modificados;
3. indicar decisiones técnicas relevantes;
4. indicar si `/reloj.png` fue encontrado correctamente;
5. indicar que el video sigue pendiente;
6. indicar ruta exacta donde deberá colocarse el video final;
7. reportar resultado de `pnpm validate`;
8. reportar resultado de Playwright;
9. no modificar otras secciones o features fuera de alcance.

No hacer commits adicionales de features no solicitadas.

---

# 68. Prioridad final

Orden de prioridades:

```text
1. Dirección visual
2. Fluidez del scroll
3. Continuidad reloj → video
4. Responsive
5. Accessibility
6. Performance
7. Abstracción
```

No sacrificar la experiencia visual por una abstracción prematura.

Tampoco sacrificar performance para conseguir un efecto apenas perceptible.

Construir esta primera secuencia como la base de toda la narrativa posterior de NODO.