/**
 * Placeholder site metadata defaults (§14).
 *
 * Every value here is a clearly identifiable placeholder. No real commercial
 * data (bar name, tagline, addresses, etc.) belongs in this file yet.
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
  /** Placeholder theme color; replaced by the final design token (§44). */
  themeColor: string;
  /** Open Graph locale. */
  ogLocale: string;
}

export const SITE_METADATA: SiteMetadata = {
  siteName: 'PLACEHOLDER_SITE_NAME',
  defaultDescription: 'PLACEHOLDER_SITE_DESCRIPTION',
  defaultOgImage: '/og-image-placeholder.png', // asset intentionally not shipped yet
  defaultOgImageAlt: 'PLACEHOLDER_OG_IMAGE_ALT',
  twitterCard: 'summary_large_image',
  themeColor: '#000000', // neutral placeholder, not a design token
  ogLocale: 'es_AR',
};
