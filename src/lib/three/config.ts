/**
 * Typed defaults for future WebGL scenes (§21/§22).
 *
 * This module must NOT import `three`: it only declares configuration values,
 * so importing it can never pull the WebGL stack into a bundle.
 */

export interface SceneDefaults {
  /** Device pixel ratio cap: [min, max]. */
  dpr: [number, number];
  /** Enable MSAA antialiasing on the WebGL context. */
  antialias: boolean;
  /** Transparent framebuffer (scene composites over the page background). */
  alpha: boolean;
  /** Disable shadows until a scene actually needs them. */
  shadows: boolean;
  /** GPU power preference hint for the context. */
  powerPreference: 'high-performance' | 'low-power' | 'default';
}

export const SCENE_DEFAULTS: SceneDefaults = {
  dpr: [1, 2],
  antialias: true,
  alpha: true,
  shadows: false,
  powerPreference: 'high-performance',
};
