# BOOTSTRAP.md — Core técnico del proyecto

## 0. Objetivo

Inicializar desde cero el core técnico de un sitio web premium/experiencial para un bar.

En esta etapa **NO se debe diseñar el sitio final ni desarrollar contenido real**.

El objetivo es dejar una base:

- moderna;
- production-ready;
- orientada a SEO;
- SSR-ready;
- static-first;
- altamente performante;
- preparada para animaciones avanzadas;
- preparada para WebGL / Three.js;
- preparada para React islands;
- escalable;
- accesible;
- testeable;
- con buenas convenciones de código.

Al finalizar esta tarea debe existir un proyecto funcional sobre el cual podamos empezar a construir las páginas y experiencias visuales.

---

# 1. Principios arquitectónicos obligatorios

La arquitectura debe seguir estos principios.

## Astro primero

Astro es el framework principal.

No convertir el proyecto en una SPA React.

React se debe utilizar únicamente para componentes que realmente necesiten:

- estado complejo;
- interacción;
- React Three Fiber;
- ecosistema React específico.

Todo lo demás debe implementarse preferentemente con:

- Astro;
- HTML semántico;
- CSS;
- JavaScript/TypeScript vanilla;
- GSAP cuando corresponda.

---

## Static-first + SSR-ready

El proyecto debe estar configurado con soporte SSR desde el comienzo.

Usar:

```ts
output: 'server';
```

y el adapter de Node.

Sin embargo, las páginas públicas de marketing/contenido deben poder prerenderizarse individualmente:

```ts
export const prerender = true;
```

Conceptualmente:

```text
Astro server output
│
├── /
│   └── prerender
│
├── /menu
│   └── prerender
│
├── /cocktails/*
│   └── prerender
│
├── /events/*
│   └── prerender cuando sea posible
│
├── /api/*
│   └── SSR
│
└── futuras rutas dinámicas
    └── SSR cuando realmente sea necesario
```

No implementar SSR indiscriminadamente.

La regla será:

> Static HTML siempre que sea posible. SSR solamente cuando exista una razón funcional.

---

# 2. Runtime

Estandarizar el proyecto con:

```text
Node.js 24 LTS
pnpm
```

Crear:

```text
.nvmrc
```

con una versión Node 24 soportada por todas las herramientas instaladas.

Usar como mínimo Node:

```text
24.16.0
```

En `package.json` declarar también:

```json
{
  "engines": {
    "node": ">=24.16.0 <25"
  }
}
```

Usar pnpm como único package manager.

No generar:

```text
package-lock.json
yarn.lock
bun.lock
```

Debe existir únicamente:

```text
pnpm-lock.yaml
```

---

# 3. Política de versiones

Antes de instalar dependencias, consultar la versión estable actual de cada paquete.

Ejemplo:

```bash
pnpm view astro version
pnpm view @astrojs/react version
pnpm view @astrojs/node version
pnpm view @astrojs/sitemap version
pnpm view react version
pnpm view react-dom version
pnpm view gsap version
pnpm view lenis version
pnpm view three version
pnpm view @react-three/fiber version
pnpm view @react-three/drei version
pnpm view tailwindcss version
pnpm view @tailwindcss/vite version
```

Usar únicamente releases:

```text
latest / stable
```

No usar:

```text
alpha
beta
rc
canary
experimental
next
```

salvo que este documento lo indique explícitamente.

Después de instalar, conservar `pnpm-lock.yaml`.

No actualizar automáticamente majors después sin revisar breaking changes.

---

# 4. Excepción temporal: TypeScript

NO instalar TypeScript 7 todavía.

Fijar explícitamente:

```text
typescript@6.0.3
```

Motivo:

El ecosistema de tooling utilizado por Astro, `astro-check`, ESLint y `typescript-eslint` todavía debe mantener compatibilidad completa con TypeScript 7.

Por lo tanto:

```bash
pnpm add -D typescript@6.0.3
```

Agregar un comentario en el README indicando:

> TypeScript 6.0.3 is intentionally pinned. Upgrade to TypeScript 7 only after Astro tooling and typescript-eslint officially support it.

No considerar esto deuda accidental.

Es una decisión consciente de compatibilidad.

---

# 5. Crear proyecto Astro

Inicializar un proyecto Astro minimal.

Usar TypeScript strict.

Preferentemente:

```bash
pnpm create astro@latest . --template minimal --typescript strict --install false --git false
```

Si la CLI actual hubiera cambiado alguno de estos flags, consultar:

```bash
pnpm create astro@latest --help
```

y conseguir el mismo resultado:

```text
template: minimal
TypeScript: strict
dependencies: instaladas con pnpm
git: respetar repositorio existente
```

No utilizar un starter visual.

No utilizar themes.

No instalar componentes prefabricados.

---

# 6. Dependencias principales

Instalar las últimas versiones estables compatibles de:

```bash
pnpm add \
  @astrojs/node@latest \
  @astrojs/react@latest \
  @astrojs/sitemap@latest \
  react@latest \
  react-dom@latest \
  gsap@latest \
  lenis@latest \
  three@latest \
  @react-three/fiber@latest \
  @react-three/drei@latest \
  tailwindcss@latest \
  @tailwindcss/vite@latest
```

Astro debería haber sido instalado por el scaffold.

Confirmar igualmente que sea la última release estable:

```bash
pnpm list astro
```

---

# 7. Dependencias de desarrollo

Instalar:

```bash
pnpm add -D \
  typescript@6.0.3 \
  @astrojs/check@latest \
  @types/node@latest \
  @types/react@latest \
  @types/react-dom@latest \
  @types/three@latest \
  prettier@latest \
  prettier-plugin-astro@latest \
  eslint@latest \
  @eslint/js@latest \
  eslint-plugin-astro@latest \
  eslint-plugin-react-hooks@latest \
  eslint-plugin-jsx-a11y@latest \
  typescript-eslint@latest \
  globals@latest \
  @playwright/test@latest
```

No instalar Vitest todavía.

Lo agregaremos cuando aparezca lógica de dominio que justifique unit tests.

Playwright sí debe instalarse desde el comienzo porque permite validar:

- SSR;
- HTML inicial;
- SEO;
- navegación;
- accesibilidad básica;
- errores JS;
- comportamiento real del navegador.

Instalar Chromium para Playwright:

```bash
pnpm exec playwright install chromium
```

---

# 8. Dependencias que NO deben instalarse ahora

No agregar todavía:

```text
Framer Motion
Motion
Swiper
Locomotive Scroll
jQuery
Bootstrap
Material UI
Chakra
shadcn
Radix
Next.js
Zustand
Redux
TanStack Query
Axios
Prisma
Supabase
Firebase
Auth.js
CMS
database
analytics
cookie manager
payment SDKs
form libraries
validation libraries externas
```

No agregar dependencias “por si acaso”.

La regla debe ser:

> Cada dependencia debe tener una necesidad concreta.

---

# 9. Configuración Astro

Crear:

```text
astro.config.ts
```

Configurar como mínimo:

```ts
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

const site = process.env.SITE_URL ?? 'http://localhost:4321';

export default defineConfig({
  site,

  output: 'server',

  adapter: node({
    mode: 'standalone',
  }),

  integrations: [react(), sitemap()],

  trailingSlash: 'never',

  compressHTML: true,

  security: {
    csp: true,
  },

  vite: {
    plugins: [tailwindcss()],
  },
});
```

Si alguna API cambió en la versión estable instalada de Astro, utilizar la equivalencia oficial actual.

No deshabilitar CSP para solucionar errores.

Si alguna librería necesita una directiva específica posteriormente, extender la política de forma explícita.

---

# 10. Tailwind CSS

Utilizar Tailwind CSS 4 mediante:

```text
@tailwindcss/vite
```

NO utilizar:

```text
@astrojs/tailwind
```

No crear un `tailwind.config.js` innecesariamente.

Tailwind 4 debe poder trabajar principalmente desde CSS.

Crear:

```text
src/styles/global.css
```

con una base mínima.

Ejemplo:

```css
@import 'tailwindcss';

:root {
  font-synthesis: none;
  text-rendering: optimizeLegibility;
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

html {
  min-width: 320px;
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
}

img,
picture,
video,
canvas,
svg {
  display: block;
  max-width: 100%;
}

button,
input,
textarea,
select {
  font: inherit;
}
```

No definir todavía:

- paleta final;
- tipografías finales;
- radios;
- sombras;
- escalas definitivas;
- estética visual.

Eso se hará posteriormente mediante design tokens.

---

# 11. Estructura del proyecto

Crear esta estructura inicial:

```text
.
├── public/
│   ├── favicon.svg
│   └── robots-placeholder.txt   # sólo si fuera necesario temporalmente
│
├── src/
│   ├── assets/
│   │   ├── images/
│   │   ├── video/
│   │   ├── models/
│   │   └── fonts/
│   │
│   ├── components/
│   │   ├── core/
│   │   │   ├── SeoHead.astro
│   │   │   └── SkipLink.astro
│   │   │
│   │   ├── islands/
│   │   │   └── SceneCanvas.tsx
│   │   │
│   │   └── ui/
│   │
│   ├── layouts/
│   │   └── BaseLayout.astro
│   │
│   ├── lib/
│   │   ├── motion/
│   │   │   ├── gsap.ts
│   │   │   └── lenis.ts
│   │   │
│   │   ├── seo/
│   │   │   └── metadata.ts
│   │   │
│   │   └── three/
│   │       └── config.ts
│   │
│   ├── pages/
│   │   ├── api/
│   │   │   └── health.ts
│   │   ├── index.astro
│   │   ├── 404.astro
│   │   └── robots.txt.ts
│   │
│   ├── styles/
│   │   └── global.css
│   │
│   └── env.d.ts
│
├── tests/
│   └── e2e/
│       └── smoke.spec.ts
│
├── .editorconfig
├── .env.example
├── .gitignore
├── .nvmrc
├── .npmrc
├── .prettierignore
├── .prettierrc.mjs
├── astro.config.ts
├── eslint.config.mjs
├── package.json
├── playwright.config.ts
├── pnpm-lock.yaml
├── README.md
└── tsconfig.json
```

Eliminar archivos del starter que no tengan utilidad.

No dejar código de ejemplo innecesario.

---

# 12. Alias de imports

Configurar `tsconfig.json` sobre Astro strict:

```json
{
  "extends": "astro/tsconfigs/strict",
  "include": [".astro/types.d.ts", "**/*"],
  "exclude": ["dist"],
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@components/*": ["src/components/*"],
      "@layouts/*": ["src/layouts/*"],
      "@lib/*": ["src/lib/*"],
      "@styles/*": ["src/styles/*"],
      "@assets/*": ["src/assets/*"]
    }
  }
}
```

Preferir aliases para imports que crucen módulos importantes.

No utilizar cadenas tipo:

```ts
../../../../lib/foo
```

---

# 13. BaseLayout

Crear:

```text
src/layouts/BaseLayout.astro
```

Responsabilidades:

- `<!doctype html>`;
- atributo `lang`;
- `<head>`;
- metadata;
- SEO;
- global CSS;
- skip link;
- `<main>`;
- slots;
- estructura semántica.

Usar inicialmente:

```html
<html lang="es-AR"></html>
```

El layout debe aceptar props como:

```ts
interface Props {
  title: string;
  description: string;
  canonical?: URL | string;
  image?: string;
  noindex?: boolean;
}
```

No agregar React al layout.

No importar:

```text
GSAP
Lenis
Three.js
React Three Fiber
```

globalmente.

---

# 14. SEO base

Crear:

```text
src/components/core/SeoHead.astro
```

Debe soportar como mínimo:

```text
title
description
canonical
robots
OpenGraph
Twitter Cards
og:image
theme-color
```

Generar:

```html
<title>
<meta name="description">
<link rel="canonical">
<meta name="robots">

<meta property="og:type">
<meta property="og:title">
<meta property="og:description">
<meta property="og:url">
<meta property="og:image">

<meta name="twitter:card">
<meta name="twitter:title">
<meta name="twitter:description">
<meta name="twitter:image">
```

No inventar aún metadata comercial real.

Usar valores placeholder claramente identificables.

El componente también debe estar preparado para recibir posteriormente JSON-LD.

Por ejemplo:

```ts
jsonLd?: Record<string, unknown> | Record<string, unknown>[];
```

El JSON-LD deberá renderizarse server-side.

No introducir schema falso solamente para llenar el componente.

---

# 15. Canonicals

Los canonicals deben derivarse del `site` configurado en Astro.

Nunca hardcodear dominios finales todavía.

La implementación debe permitir:

```ts
new URL(Astro.url.pathname, Astro.site);
```

o mecanismo equivalente.

Toda página indexable debe poder tener canonical explícito.

---

# 16. Robots

Crear:

```text
src/pages/robots.txt.ts
```

La indexación debe estar controlada por una variable:

```text
PUBLIC_INDEXABLE
```

`.env.example`:

```env
SITE_URL=http://localhost:4321
PUBLIC_INDEXABLE=false
```

Mientras:

```env
PUBLIC_INDEXABLE=false
```

servir:

```text
User-agent: *
Disallow: /
```

Cuando:

```env
PUBLIC_INDEXABLE=true
```

servir:

```text
User-agent: *
Allow: /

Sitemap: <SITE_URL>/sitemap-index.xml
```

El proyecto NO debe quedar indexable accidentalmente en staging.

---

# 17. Sitemap

Configurar:

```text
@astrojs/sitemap
```

No incluir rutas técnicas como:

```text
/api/*
```

si la integración actual necesitara filtros, configurarlos.

El sitemap debe utilizar el `SITE_URL` real en producción.

---

# 18. Home placeholder

Crear una home mínima en:

```text
src/pages/index.astro
```

Esta página:

```ts
export const prerender = true;
```

Debe usar:

```text
BaseLayout
```

y contener únicamente contenido estructural temporal.

Ejemplo conceptual:

```html
<main>
  <h1>Project Core</h1>
  <p>Astro core initialized.</p>
</main>
```

No diseñar una home ficticia.

No agregar secciones finales del bar todavía.

Esta página existe sólo para verificar:

- build;
- prerender;
- SEO;
- CSS;
- routing.

---

# 19. Endpoint SSR de health check

Crear:

```text
src/pages/api/health.ts
```

NO prerenderizar.

Debe responder JSON:

```json
{
  "status": "ok"
}
```

con status HTTP:

```text
200
```

Agregar también:

```text
Cache-Control: no-store
```

Este endpoint servirá para verificar que el adapter SSR está funcionando.

---

# 20. React Islands

Integrar React mediante:

```text
@astrojs/react
```

Pero NO montar una React app global.

React solamente debe aparecer en islands.

Ejemplo futuro correcto:

```astro
<CocktailScene client:visible />
```

Otros modos aceptables:

```astro
client:idle client:media
```

Usar:

```astro
client:load
```

únicamente cuando sea necesario para algo visible/interactivo inmediatamente.

Evitar:

```astro
client:only
```

si el componente puede tener una representación server-side razonable.

---

# 21. Three.js / React Three Fiber

Crear:

```text
src/components/islands/SceneCanvas.tsx
```

como una abstracción mínima para futuras escenas WebGL.

Debe importar correctamente:

```ts
@react-three/fiber
@react-three/drei
three
```

pero NO debe ser utilizado todavía en la home.

Objetivo:

- comprobar TypeScript;
- establecer lugar arquitectónico;
- evitar que Three.js entre en el bundle inicial sin necesidad.

Buenas defaults iniciales:

```text
dpr limitado
antialias razonable
fallback accesible
Suspense preparado
canvas responsive
```

No agregar:

- modelos 3D;
- luces finales;
- shaders;
- assets;
- postprocessing;
- physics.

No instalar todavía:

```text
@react-three/postprocessing
rapier
leva
```

---

# 22. Regla crítica de WebGL

Three.js y React Three Fiber NO pueden formar parte del bundle inicial de una página que no utilice WebGL.

Nunca importar Three.js desde:

```text
BaseLayout
global scripts
navigation
SEO components
global state
```

Cada escena debe vivir aislada.

Idealmente:

```text
Astro HTML
    ↓
scroll
    ↓
client:visible
    ↓
React island
    ↓
R3F
    ↓
Three.js
```

---

# 23. GSAP

Crear:

```text
src/lib/motion/gsap.ts
```

Debe centralizar la configuración de GSAP.

Registrar plugins solamente cuando se necesiten.

Preparar soporte para:

```text
ScrollTrigger
```

No ejecutar timelines al importar el módulo.

El módulo debe exportar herramientas que puedan inicializarse y destruirse explícitamente.

Ejemplo conceptual:

```ts
export function createScrollAnimation() {
  // initialize

  return () => {
    // cleanup
  };
}
```

No agregar animaciones globales todavía.

---

# 24. Lenis

Crear:

```text
src/lib/motion/lenis.ts
```

Preparar una abstracción para smooth scrolling.

NO inicializar Lenis globalmente todavía.

La aplicación no debe alterar el scroll nativo hasta que diseñemos la experiencia.

Cuando se implemente, debe:

- respetar `prefers-reduced-motion`;
- integrarse con ScrollTrigger;
- poder destruirse correctamente;
- no romper anchor navigation;
- no romper keyboard navigation;
- no bloquear scroll en mobile.

---

# 25. Reduced motion

Desde el core, asumir que toda experiencia animada futura debe soportar:

```css
@media (prefers-reduced-motion: reduce);
```

Las utilidades de motion deben comprobar:

```ts
window.matchMedia('(prefers-reduced-motion: reduce)').matches;
```

y ofrecer una experiencia funcional sin animaciones pesadas.

Esto es obligatorio.

---

# 26. View Transitions

NO activar todavía un router SPA global.

No agregar `ClientRouter` al `BaseLayout` en esta fase.

Astro debe conservar navegación HTML normal inicialmente.

Más adelante evaluaremos Astro View Transitions para las transiciones cinematográficas entre páginas.

Motivo:

No agregar JavaScript global hasta que exista una experiencia concreta que lo justifique.

---

# 27. Imágenes

Utilizar posteriormente las primitives oficiales de Astro:

```text
astro:assets
<Image />
<Picture />
```

No instalar soluciones externas de imágenes.

Guardar assets procesables por Astro dentro de:

```text
src/assets/
```

Guardar archivos que deban servirse literalmente dentro de:

```text
public/
```

Preferir posteriormente:

```text
AVIF
WebP
```

y responsive images.

No agregar imágenes reales todavía.

---

# 28. Videos

Reservar:

```text
src/assets/video/
```

Para videos pesados futuros probablemente se utilizará un CDN especializado.

No añadir un SDK de video todavía.

Nunca convertir video 4K en dependencia del first paint.

---

# 29. Modelos 3D

Reservar:

```text
src/assets/models/
```

Los modelos futuros deberían utilizar preferentemente:

```text
.glb
```

y posteriormente evaluar:

```text
Draco
Meshopt
KTX2
```

No instalar tooling de compresión 3D todavía.

---

# 30. Fonts

Reservar:

```text
src/assets/fonts/
```

La estrategia futura será preferentemente:

```text
self-hosted fonts
WOFF2
font-display
preload sólo para fuentes críticas
```

No utilizar Google Fonts desde CDN por defecto.

No seleccionar tipografías todavía.

---

# 31. ESLint

Usar Flat Config.

Crear:

```text
eslint.config.mjs
```

Configurar:

- ESLint recommended;
- TypeScript recommended;
- Astro recommended;
- React Hooks recommended para `.tsx`;
- JSX accessibility recommended para React islands;
- ignorar `dist`;
- ignorar `.astro`;
  sólo cuando corresponda a reglas que no entienden Astro, no del lint completo.

Usar las configuraciones Flat Config oficiales de las versiones instaladas.

Conceptualmente:

```js
import js from '@eslint/js';
import astro from 'eslint-plugin-astro';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import tseslint from 'typescript-eslint';

export default [
  js.configs.recommended,

  ...tseslint.configs.recommended,

  ...astro.configs.recommended,

  {
    files: ['**/*.tsx'],
    // React Hooks + JSX A11Y
  },

  {
    ignores: ['dist/**', '.astro/**', 'node_modules/**'],
  },
];
```

Adaptar la sintaxis exacta a las APIs oficiales de las versiones instaladas.

No desactivar reglas importantes simplemente para obtener cero warnings.

---

# 32. Prettier

Crear:

```text
.prettierrc.mjs
```

Configurar:

```js
export default {
  plugins: ['prettier-plugin-astro'],
  semi: true,
  singleQuote: true,
  trailingComma: 'all',
  printWidth: 100,
  overrides: [
    {
      files: '*.astro',
      options: {
        parser: 'astro',
      },
    },
  ],
};
```

Crear:

```text
.prettierignore
```

incluyendo:

```text
dist
.astro
node_modules
pnpm-lock.yaml
```

---

# 33. EditorConfig

Crear `.editorconfig`:

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
indent_style = space
indent_size = 2
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false
```

---

# 34. npmrc

Crear:

```text
.npmrc
```

con:

```ini
save-exact=true
engine-strict=true
```

La intención es que las dependencias elegidas durante el bootstrap queden fijadas.

Las actualizaciones deben ser deliberadas.

---

# 35. package.json

Configurar scripts equivalentes a:

```json
{
  "scripts": {
    "dev": "astro dev",
    "start": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "check": "astro check",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "test:e2e": "pnpm build && playwright test",
    "test:e2e:ui": "playwright test --ui",
    "validate": "pnpm check && pnpm lint && pnpm format:check && pnpm build"
  }
}
```

Agregar también:

```json
{
  "private": true
}
```

y:

```json
{
  "packageManager": "pnpm@<VERSION_INSTALADA>"
}
```

No inventar la versión de pnpm.

Utilizar la versión estable realmente instalada.

---

# 36. Playwright

Crear:

```text
playwright.config.ts
```

Configurar Chromium inicialmente.

No necesitamos todavía Firefox y WebKit en cada ejecución local.

Configurar:

```text
baseURL
webServer
trace on first retry
screenshot on failure
video only on failure/retry si es razonable
```

Los E2E deben ejecutarse contra el build de producción.

Flujo esperado:

```text
pnpm build
       ↓
astro preview
       ↓
Playwright
```

---

# 37. Smoke E2E

Crear:

```text
tests/e2e/smoke.spec.ts
```

Debe comprobar como mínimo:

## Home

```text
GET /
→ HTTP 200
```

Verificar:

```text
<html lang="es-AR">
<title>
meta description
canonical
robots meta
h1
```

Comprobar que la página carga sin errores de consola importantes.

---

## Health

```text
GET /api/health
→ HTTP 200
```

y:

```json
{
  "status": "ok"
}
```

---

## Robots

Verificar:

```text
GET /robots.txt
→ HTTP 200
```

---

# 38. 404

Crear:

```text
src/pages/404.astro
```

Debe ser simple y prerenderizado.

No diseñar todavía una pantalla visual final.

Debe:

- devolver 404;
- usar BaseLayout;
- tener `noindex`.

---

# 39. Accesibilidad base

Desde el comienzo:

- landmarks semánticos;
- un único `<main>`;
- skip link;
- headings jerárquicos;
- focus visible;
- botones reales para acciones;
- links reales para navegación;
- imágenes futuras con alt;
- formularios futuros con labels;
- keyboard navigation;
- reduced motion.

Crear:

```text
src/components/core/SkipLink.astro
```

apuntando a:

```text
#main-content
```

El `BaseLayout` deberá contener:

```html
<main id="main-content"></main>
```

---

# 40. Performance rules

Estas reglas son obligatorias durante todo el proyecto.

## No hydration innecesaria

No utilizar React para componentes estáticos.

Incorrecto:

```text
Header.tsx
Footer.tsx
Heading.tsx
Section.tsx
```

si no necesitan estado/interacción.

Preferir:

```text
Header.astro
Footer.astro
Heading.astro
Section.astro
```

---

## No JS global pesado

No importar globalmente:

```text
Three.js
R3F
Drei
GSAP
Lenis
```

---

## Lazy hydration

Para componentes debajo del fold preferir:

```astro
client:visible
```

---

## No WebGL invisible

Una escena que todavía no es visible no debe consumir GPU innecesariamente.

---

## No autoplay video crítico

Los videos decorativos no deben competir con el LCP.

---

## Layout estable

Reservar tamaños/aspect ratios para:

```text
images
video
canvas
3D
```

para minimizar CLS.

---

# 41. SEO rules

El proyecto debe construirse pensando en HTML indexable.

Nunca esconder contenido importante exclusivamente dentro de:

```text
Canvas
WebGL
React state
modal client-only
```

Ejemplo futuro correcto:

```text
visual:
Three.js cocktail

SEO:
<h1>Nombre del cocktail</h1>
<p>Ingredientes...</p>
```

El canvas es presentación.

El HTML contiene significado.

---

# 42. Convenciones de componentes

Usar nombres:

```text
PascalCase.astro
PascalCase.tsx
camelCase.ts
```

Preferir componentes pequeños con responsabilidad concreta.

No crear abstractions genéricas prematuramente.

Evitar:

```text
utils.ts
helpers.ts
common.ts
misc.ts
```

gigantes.

Preferir módulos por dominio:

```text
lib/seo/
lib/motion/
lib/three/
```

---

# 43. CSS

La estrategia será:

```text
Tailwind utilities
+
CSS custom properties
+
CSS específico cuando sea necesario
```

No hacer absolutamente todo con Tailwind si una animación o layout complejo queda más legible en CSS.

No instalar CSS-in-JS.

No utilizar styled-components.

No utilizar Emotion.

---

# 44. Design tokens

Preparar el proyecto para tener posteriormente:

```css
--color-background
--color-foreground
--color-accent

--font-display
--font-body

--space-*
--radius-*
--duration-*
--ease-*
```

Pero NO definir todavía el design system visual final.

---

# 45. Environment variables

Crear:

```text
.env.example
```

con:

```env
SITE_URL=http://localhost:4321
PUBLIC_INDEXABLE=false
```

No commitear:

```text
.env
.env.local
.env.production
```

Agregar dichos archivos al `.gitignore`.

No crear secretos ficticios.

---

# 46. Git ignore

Confirmar que `.gitignore` contiene:

```text
node_modules/
dist/
.astro/
.env
.env.*
!.env.example
playwright-report/
test-results/
.DS_Store
```

---

# 47. README

Actualizar `README.md`.

Debe explicar brevemente:

## Stack

```text
Astro
React Islands
TypeScript
Tailwind CSS
GSAP
Lenis
Three.js
React Three Fiber
Drei
Playwright
```

## Architecture

```text
static-first
SSR-ready
islands architecture
progressive enhancement
```

## Commands

```bash
pnpm dev
pnpm build
pnpm preview
pnpm check
pnpm lint
pnpm format
pnpm test:e2e
pnpm validate
```

## Important decisions

Documentar:

```text
Astro is the main framework.
React is used only for islands.
Static routes are preferred.
SSR is opt-in according to functionality.
Three.js is never global.
TypeScript 6.0.3 is temporarily pinned for tooling compatibility.
```

No escribir documentación comercial del bar todavía.

---

# 48. No CMS todavía

No elegir CMS durante este bootstrap.

La arquitectura debe permitir posteriormente conectar:

```text
Sanity
Payload
Directus
Contentful
Strapi
DatoCMS
Astro Content Collections
```

pero no instalar ninguno.

Primero construiremos el modelo de contenido.

---

# 49. No reservas todavía

No integrar sistemas de reservas.

Posteriormente podría ser:

```text
OpenTable
SevenRooms
Resy
sistema propio
WhatsApp
```

pero no debe condicionar el core ahora.

---

# 50. No analytics todavía

No instalar:

```text
Google Analytics
GTM
Meta Pixel
PostHog
Plausible
Clarity
```

Primero construiremos la experiencia.

La estrategia de analytics/consentimiento se decidirá posteriormente.

---

# 51. Seguridad

Mantener activado CSP.

No usar:

```text
unsafe-eval
unsafe-inline
```

como solución genérica.

No introducir HTML externo con:

```text
set:html
dangerouslySetInnerHTML
```

salvo contenido controlado/sanitizado y con una razón concreta.

JSON-LD generado internamente es una excepción legítima.

---

# 52. Auditoría de dependencias

Una vez instalado todo ejecutar:

```bash
pnpm outdated
```

y:

```bash
pnpm audit
```

Revisar resultados.

No ejecutar automáticamente:

```bash
pnpm audit --fix --force
```

No introducir overrides arbitrarios.

Si existe una vulnerabilidad:

1. identificar dependencia;
2. determinar si afecta al runtime;
3. actualizar por una ruta compatible;
4. documentar cualquier override excepcional.

---

# 53. Verificación de dependencias

Confirmar específicamente que estén instalados correctamente:

```bash
pnpm list astro
pnpm list @astrojs/react
pnpm list @astrojs/node
pnpm list react
pnpm list react-dom
pnpm list gsap
pnpm list lenis
pnpm list three
pnpm list @react-three/fiber
pnpm list @react-three/drei
pnpm list tailwindcss
```

No debe haber peer dependency warnings ignorados.

Si existen, resolverlos.

---

# 54. Build final

Antes de considerar terminada la tarea ejecutar:

```bash
pnpm format
pnpm check
pnpm lint
pnpm build
pnpm test:e2e
```

Todos deben terminar correctamente.

Después ejecutar:

```bash
pnpm install --frozen-lockfile
```

y volver a comprobar:

```bash
pnpm validate
```

---

# 55. Validar SSR

Después del build, ejecutar producción local:

```bash
pnpm preview
```

Verificar:

```text
/
/robots.txt
/api/health
/404-test
```

`/api/health` debe probar que el runtime SSR funciona.

---

# 56. Validar prerender

La home debe estar explícitamente prerenderizada:

```ts
export const prerender = true;
```

Confirmar durante el build que `/` fue generado correctamente.

---

# 57. Validar HTML sin JavaScript

La home placeholder debe contener server-side:

```text
title
description
canonical
h1
texto principal
```

Deshabilitar JavaScript en el navegador y confirmar que la estructura fundamental continúa visible.

---

# 58. Validar bundle

La home todavía NO utiliza:

```text
React
GSAP
Lenis
Three.js
R3F
Drei
```

por lo tanto ninguna de estas librerías debería terminar innecesariamente en el client bundle de `/`.

Inspeccionar el build.

Instalar una dependencia no significa que deba enviarse al browser.

Si aparecen estas librerías en el bundle inicial sin ser utilizadas, investigar y corregir la causa.

---

# 59. No agregar demo visual

No crear:

- hero espectacular;
- partículas;
- cubos 3D;
- gradientes aleatorios;
- animaciones dummy;
- cards;
- cocktails ficticios;
- lorem ipsum extenso.

El core debe ser deliberadamente aburrido visualmente.

Su objetivo es validar arquitectura.

La experiencia visual se construirá después.

---

# 60. Definition of Done

La tarea está terminada únicamente si se cumple TODO lo siguiente:

```text
[ ] Astro latest stable instalado
[ ] Node 24 estandarizado
[ ] pnpm configurado
[ ] TypeScript strict
[ ] TypeScript 6.0.3 fijado conscientemente
[ ] React integration funcionando
[ ] Node SSR adapter funcionando
[ ] Sitemap configurado
[ ] Tailwind 4 funcionando
[ ] GSAP instalado
[ ] Lenis instalado
[ ] Three.js instalado
[ ] React Three Fiber instalado
[ ] Drei instalado
[ ] BaseLayout creado
[ ] SEO component creado
[ ] canonical configurado
[ ] robots.txt dinámico por environment
[ ] sitemap funcionando
[ ] home prerenderizada
[ ] /api/health SSR funcionando
[ ] 404 funcionando
[ ] SkipLink funcionando
[ ] reduced-motion contemplado arquitectónicamente
[ ] ESLint funcionando
[ ] Prettier funcionando
[ ] astro check funcionando
[ ] Playwright funcionando
[ ] pnpm-lock.yaml generado
[ ] no peer dependency warnings
[ ] pnpm audit revisado
[ ] pnpm check pasa
[ ] pnpm lint pasa
[ ] pnpm format:check pasa
[ ] pnpm build pasa
[ ] pnpm test:e2e pasa
[ ] home funciona sin JavaScript
[ ] Three.js no entra en home bundle
[ ] React no entra en home bundle sin necesidad
[ ] README actualizado
[ ] no contenido final agregado
[ ] no diseño final agregado
```

---

# 61. Resultado esperado

Al terminar debe existir esta arquitectura conceptual:

```text
                         ┌─────────────┐
                         │    ASTRO    │
                         └──────┬──────┘
                                │
                  ┌─────────────┴──────────────┐
                  │                            │
            STATIC HTML                      SSR
                  │                            │
       marketing / content                APIs / dynamic
                  │                            │
                  │                            │
         ┌────────┴─────────┐                  │
         │                  │                  │
       Astro          interactive only        │
      components             │                 │
                             │                 │
                      React Islands            │
                             │
                  ┌──────────┴──────────┐
                  │                     │
                GSAP                  WebGL
                Lenis                   │
                                    Three.js
                                       │
                                       R3F
                                       │
                                      Drei
```

La idea central debe mantenerse durante todo el proyecto:

```text
HTML FIRST
↓
PROGRESSIVE ENHANCEMENT
↓
ANIMATION
↓
3D
```

Nunca:

```text
3D/JS FIRST
↓
intentar arreglar performance después
```

---

# 62. Entrega del agente

Una vez terminado el bootstrap, devolver un resumen técnico incluyendo:

```text
1. Versiones finalmente instaladas.
2. Archivos creados.
3. Decisiones tomadas.
4. Resultado de pnpm check.
5. Resultado de pnpm lint.
6. Resultado de pnpm build.
7. Resultado de pnpm test:e2e.
8. Resultado de pnpm audit.
9. Confirmación de SSR /api/health.
10. Confirmación de prerender de /.
11. Cualquier warning pendiente.
12. Cualquier cambio realizado respecto de este documento por incompatibilidades reales de versiones.
```

No comenzar a desarrollar contenido ni diseño después de terminar el bootstrap.

Detenerse una vez que el core esté completamente validado.
