import { Suspense } from 'react';
import type { ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { AdaptiveDpr } from '@react-three/drei';
import { SCENE_DEFAULTS } from '@lib/three/config';

export interface SceneCanvasProps {
  /** Accessible name announced for the scene region. */
  label: string;
  /** Scene contents (meshes, lights, models) mounted lazily by future scenes. */
  children?: ReactNode;
}

/**
 * Minimal R3F abstraction for future WebGL scenes (§21).
 *
 * - dpr is capped from @lib/three/config.
 * - Responsive wrapper sized by the parent; the canvas fills it.
 * - Suspense-ready with an accessible fallback container (role="img").
 * - NOT used anywhere in the home page: Three.js must never leak into the
 *   initial bundle of pages that do not use WebGL (§22).
 */
export function SceneCanvas({ label, children }: SceneCanvasProps) {
  return (
    <div
      role="img"
      aria-label={label}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      <Canvas
        dpr={SCENE_DEFAULTS.dpr}
        gl={{
          antialias: SCENE_DEFAULTS.antialias,
          alpha: SCENE_DEFAULTS.alpha,
          powerPreference: SCENE_DEFAULTS.powerPreference,
        }}
        shadows={SCENE_DEFAULTS.shadows}
      >
        <Suspense fallback={null}>
          {children}
          <AdaptiveDpr />
        </Suspense>
      </Canvas>
    </div>
  );
}
