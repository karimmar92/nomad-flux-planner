import i18next, { type i18n as I18n } from "i18next";
import { initReactI18next } from "react-i18next";
import resourcesToBackend from "i18next-resources-to-backend";
import { DEFAULT_LOCALE, NAMESPACES, isLocale, resolveLocale, type Locale } from "./locales";

import enCommon from "@/locales/en/common.json";
import enCities from "@/locales/en/cities.json";
import enVisa from "@/locales/en/visa.json";
import enTracker from "@/locales/en/tracker.json";
import enReferral from "@/locales/en/referral.json";
import enPlan from "@/locales/en/plan.json";

export const LOCALE_STORAGE_KEY = "driftly.locale";

/**
 * English is bundled eagerly: it is the base language, the SSR default and the
 * authoritative fallback for every legally consequential string. Every other
 * language is fetched per-namespace on demand so we never ship six languages
 * to someone who reads one. All resulting chunks are precached by the service
 * worker (globPatterns covers **\/*.js) — landing in a new country with no
 * connectivity must not cost you your language.
 */
const eagerEn = {
  common: enCommon,
  cities: enCities,
  visa: enVisa,
  tracker: enTracker,
  referral: enReferral,
  plan: enPlan,
};

let instance: I18n | null = null;

export function getI18n(initialLocale: Locale = DEFAULT_LOCALE): I18n {
  if (instance) return instance;

  const i18n = i18next.createInstance();
  i18n
    .use(
      resourcesToBackend(
        (language: string, namespace: string) =>
          import(`../../locales/${language}/${namespace}.json`),
      ),
    )
    .use(initReactI18next)
    .init({
      lng: initialLocale,
      fallbackLng: DEFAULT_LOCALE,
      ns: [...NAMESPACES],
      defaultNS: "common",
      resources: { en: eagerEn },
      partialBundledLanguages: true,
      interpolation: { escapeValue: false },
      react: { useSuspense: false },
      returnNull: false,
    });

  instance = i18n;
  return i18n;
}

/** Detection order: URL prefix → explicit override (localStorage) → navigator. */
export function detectLocale(pathname?: string): Locale {
  const fromPath = pathname?.split("/")[1];
  if (isLocale(fromPath)) return fromPath;
  if (typeof window !== "undefined") {
    try {
      const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
      if (isLocale(stored ?? undefined)) return stored as Locale;
    } catch {
      /* private mode */
    }
    return resolveLocale(window.navigator.language);
  }
  return DEFAULT_LOCALE;
}

/** Persisted to localStorage so the choice survives logout, and to the profile. */
export function persistLocale(locale: Locale) {
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    /* ignore */
  }
}
