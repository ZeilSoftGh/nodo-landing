/**
 * NODO visual tokens for non-CSS consumers such as future WebGL scenes.
 * Keep this map synchronized with src/styles/tokens.css.
 */
export const NODO_BRAND = {
  colors: {
    night: '#071311',
    ink: '#0a0d0c',
    deep: '#0d3f37',
    teal: '#056454',
    tealBright: '#0b806d',
    gold: '#c9a743',
    goldSoft: '#e4c77a',
    cream: '#efe8d0',
    stone: '#a9aa98',
    copper: '#d47727',
    vermouth: '#a52d25',
  },
  festa: {
    magenta: '#d04bd1',
    violet: '#7a5be7',
    blue: '#3d70f0',
    cyan: '#71d4db',
  },
  typography: {
    display: 'Instrument Serif / Bodoni Moda',
    sans: 'Manrope',
  },
  motion: {
    durationSlowMs: 900,
    ease: [0.22, 1, 0.36, 1],
  },
} as const;

export type NodoBrandColor = keyof typeof NODO_BRAND.colors;
