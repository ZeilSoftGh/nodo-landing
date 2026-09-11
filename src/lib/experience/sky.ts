/**
 * Build-time materialization of the decorative sky (Fase 01 upgrade, v4).
 *
 * This module is imported only from the frontmatter of
 * `src/components/home/ExperienceIntro.astro` (prerendered page), so it never
 * reaches the client bundle: the dust/spark geometry is emitted as static markup.
 *
 * Source of truth (byte-identical copies, never edited by hand):
 * - `sky-dust.json` <- `docs/design/experience-intro/particles.json`
 * - `sky-sparks.json` <- `docs/design/experience-intro/sparks.json`
 * (see the sky/tilt spec, §7.2.2/§7.2.3).
 *
 * Dust reconstruction rule (the artifact only ships [x, y] pairs):
 * - tone: exact warm/stone quota (114/36) over the file order with the
 *   Bresenham quota below.
 * - r: exact 102/36/12 quota (buckets 0.7-1.1, 1.1-1.5, 1.5-2.0) with the same
 *   function at the cumulative thresholds 102 and 138.
 * - o: 0.10 + rng() * 0.20.
 * - rng: mulberry32(0x4E4F444F), same seed as the artifact. Per point the RNG
 *   is consumed in this order: r fraction first, then opacity. The quota
 *   decisions consume no randomness. If the original generator ever shows up,
 *   transcribe its per-point values instead of this rule.
 */

import dustSource from './sky-dust.json';
import sparksSource from './sky-sparks.json';

export interface SkyDustPoint {
  x: number;
  y: number;
  r: number;
  o: number;
  tone: 'cream' | 'stone';
}

export interface SkySpark {
  index: number;
  leftPct: number;
  topPct: number;
  sizePxDesktop: number;
  sizePxMobile: number;
  opacity: number;
  rotationDeg: number;
  tone: 'gold' | 'gold-soft';
  twinkle: boolean;
  twinkleDelaySec: number | null;
  visibleMobile: boolean;
  mobileOverride: { leftPct: number; topPct: number } | null;
}

/** Deterministic PRNG, 8 lines, no dependencies. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** True when `index` opens a `quota`-sized slot over `total` items. */
function occupiesQuota(index: number, total: number, quota: number): boolean {
  return Math.floor(((index + 1) * quota) / total) > Math.floor((index * quota) / total);
}

const TOTAL = dustSource.stats.total;
const WARM = dustSource.stats.warm;
// Cumulative thresholds over the file order: 102 points in bucket A,
// 102 + 36 = 138 through bucket B, the remaining 12 in bucket C.
const BUCKET_B = 102;
const BUCKET_C = 138;

const R_BUCKETS = [
  { min: 0.7, max: 1.1 },
  { min: 1.1, max: 1.5 },
  { min: 1.5, max: 2.0 },
] as const;

function radiusBucket(index: number): (typeof R_BUCKETS)[number] {
  if (occupiesQuota(index, TOTAL, BUCKET_B)) return R_BUCKETS[0];
  if (occupiesQuota(index, TOTAL, BUCKET_C)) return R_BUCKETS[1];
  return R_BUCKETS[2];
}

export const SKY_DUST: readonly SkyDustPoint[] = (() => {
  const rng = mulberry32(0x4e4f444f);
  return dustSource.points.map(([x, y], index) => {
    const bucket = radiusBucket(index);
    const r = bucket.min + rng() * (bucket.max - bucket.min);
    const o = 0.1 + rng() * 0.2;
    return {
      x,
      y,
      r,
      o,
      tone: occupiesQuota(index, TOTAL, WARM) ? 'cream' : 'stone',
    };
  });
})();

export const SKY_SPARKS: readonly SkySpark[] = sparksSource.sparks.map((spark) => ({
  index: spark.index,
  leftPct: spark.leftPct,
  topPct: spark.topPct,
  sizePxDesktop: spark.sizePxDesktop,
  sizePxMobile: spark.sizePxMobile,
  opacity: spark.opacity,
  rotationDeg: spark.rotationDeg,
  tone: spark.tone === 'gold-soft' ? 'gold-soft' : 'gold',
  twinkle: spark.twinkle,
  twinkleDelaySec: spark.twinkleDelaySec,
  visibleMobile: spark.visibleMobile,
  mobileOverride: spark.mobileOverride
    ? { leftPct: spark.mobileOverride.leftPct, topPct: spark.mobileOverride.topPct }
    : null,
}));
