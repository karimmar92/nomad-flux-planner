import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { I18nextProvider, useTranslation } from "react-i18next";
import { useRouterState } from "@tanstack/react-router";
import { detectLocale, getI18n, persistLocale } from "@/lib/i18n/config";
import { DEFAULT_LOCALE, isLocale, isRtl, LOCALE_TAGS, type Locale } from "@/lib/i18n/locales";

/**
 * Language resolution order:
 *   1. URL prefix   (/es/city/lisbon-pt) — shareable and indexable
 *   2. explicit override persisted to localStorage (survives logout)
 *   3. navigator.language on first visit
 * The chosen locale is also written to the profile by useLocale().
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const { pathname, search } = useRouterState({
    select: (s) => ({ pathname: s.location.pathname, search: s.location.search as { lang?: string } }),
  });
  const urlLocale = pathname.split("/")[1];
  const initial: Locale = isLocale(urlLocale) ? urlLocale : DEFAULT_LOCALE;
  const i18n = useMemo(() => getI18n(initial), [initial]);

  useEffect(() => {
    // /es/... is redirected to /...?lang=es on the server; honour it once and
    // persist so the choice survives the next navigation and logout.
    if (isLocale(search.lang)) persistLocale(search.lang);
    const next = detectLocale(pathname);
    if (i18n.language !== next) void i18n.changeLanguage(next);
    document.documentElement.lang = LOCALE_TAGS[next] ?? next;
    document.documentElement.dir = isRtl(next) ? "rtl" : "ltr";
  }, [i18n, pathname, search.lang]);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}

/** Read + change the active locale. Persists to localStorage and the profile. */
export function useLocale() {
  const { i18n } = useTranslation();
  const [, force] = useState(0);
  const locale = (isLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE) as Locale;

  const setLocale = useCallback(
    async (next: Locale) => {
      persistLocale(next);
      await i18n.changeLanguage(next);
      document.documentElement.lang = LOCALE_TAGS[next] ?? next;
      document.documentElement.dir = isRtl(next) ? "rtl" : "ltr";
      force((n) => n + 1);
    },
    [i18n],
  );

  return { locale, setLocale };
}
