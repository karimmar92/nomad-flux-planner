/** Working name. Change here to rename the whole product. */
export const APP_NAME = "Driftly";
export const APP_TAGLINE = "What a city costs you.";

/**
 * Canonical origin, no trailing slash.
 *
 * Canonical and og:url tags MUST be absolute — a relative canonical is ignored
 * by Google, which then picks its own preferred URL. With preview deployments
 * on Vercel serving identical content on throwaway domains, that risks the
 * wrong host being indexed as the original.
 *
 * Set SITE_URL in the Vercel project settings. The fallback is only for local
 * development and should never be what production serves.
 */
export const SITE_URL = (
  import.meta.env?.["VITE_SITE_URL"] ??
  process.env?.["SITE_URL"] ??
  (import.meta.env?.DEV ? "http://localhost:8080" : "https://mydriftly.life")
).replace(/\/$/, "");

export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
export const LEGAL_DISCLAIMER =
  "Informational only. Not legal or tax advice. Verify with the relevant authority before travelling.";
