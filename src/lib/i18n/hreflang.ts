import { DEFAULT_LOCALE, LOCALES, LOCALE_TAGS } from "./locales";

/**
 * hreflang alternates. The locale lives in the URL (/es/city/lisbon-pt) rather
 * than in a cookie precisely so each language can be shared and indexed
 * separately — the pre-departure content is the marketing channel.
 *
 * `path` must be the unprefixed canonical path, e.g. "/city/lisbon-pt".
 */
export function hreflangLinks(path: string) {
  const clean = path.startsWith("/") ? path : `/${path}`;
  const links = LOCALES.map((locale) => ({
    rel: "alternate",
    hrefLang: LOCALE_TAGS[locale],
    href: locale === DEFAULT_LOCALE ? clean : `/${locale}${clean === "/" ? "" : clean}`,
  }));
  links.push({ rel: "alternate", hrefLang: "x-default", href: clean });
  return links;
}

/** Strips a locale prefix from a pathname, returning the canonical path. */
export function stripLocale(pathname: string) {
  const [, first, ...rest] = pathname.split("/");
  if (first && (LOCALES as readonly string[]).includes(first)) {
    return `/${rest.join("/")}` || "/";
  }
  return pathname || "/";
}
