/**
 * Site metadata defaults for the NODO visual foundation.
 *
 * Production social imagery and final commercial copy remain pending, but the
 * brand name and theme color are now part of the implemented standard.
 */

export interface SiteMetadata {
  /** Public site name used in <title> templates and og:site_name. */
  siteName: string;
  /** Fallback description when a page does not provide one. */
  defaultDescription: string;
  /** Path (or absolute URL) of the default Open Graph image. Asset pending. */
  defaultOgImage: string;
  /** Alt text for the default Open Graph image. */
  defaultOgImageAlt: string;
  /** Twitter card type. */
  twitterCard: 'summary' | 'summary_large_image';
  /** Browser theme color aligned with the NODO canvas token. */
  themeColor: string;
  /** Open Graph locale. */
  ogLocale: string;
}

export const SITE_METADATA: SiteMetadata = {
  siteName: 'NODO',
  defaultDescription: 'NODO: barra, mesa, música y encuentro en San Miguel del Monte.',
  defaultOgImage: '/og-image-placeholder.png', // asset intentionally not shipped yet
  defaultOgImageAlt: 'NODO — Cóctel Bar',
  twitterCard: 'summary_large_image',
  themeColor: '#071311',
  ogLocale: 'es_AR',
};
