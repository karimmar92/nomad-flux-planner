/**
 * Legally consequential city content — the marked translation path.
 *
 * `arbitrage_note`, `visa.nomadVisa.notes`, `tax.notes` and
 * `connectivity_warning` can change what someone does at a border or on a tax
 * return. They are NEVER swapped silently for a translation: every one of them
 * renders through <TranslatedField>, which shows the translated text plus a
 * "Translated — view English original" control that reveals the source.
 *
 * ANY NEW LEGAL, VISA OR TAX STRING ADDED TO THE CITY RECORD MUST GO THROUGH
 * THIS HELPER AND <TranslatedField>. Rendering `{city.<something>.notes}`
 * directly is a bug — it presents a machine translation as authoritative.
 * `scripts/check-translated-fields.mjs` fails the check if you do.
 */
import { useTranslation } from "react-i18next";
import { DEFAULT_LOCALE } from "./locales";

export type CityContentField =
  | "arbitrageNote"
  | "connectivityWarning"
  | "taxNotes"
  | "nomadVisaNotes";

export type MarkedContent = {
  /** Text to display: the translation when we have one, otherwise the English. */
  display: string;
  /** Authoritative English source. Always kept and always reachable. */
  english: string;
  /** True when `display` is a translation and the marker must be shown. */
  isTranslated: boolean;
};

/**
 * Returns the marked content for one city field. Translations live in the
 * `cities` namespace under `content.<cityId>.<field>`; a missing key falls back
 * to English rather than machine-translating at render time.
 */
export function useCityContent() {
  const { t, i18n } = useTranslation("cities");

  return function cityContent(
    cityId: string,
    field: CityContentField,
    english: string | null | undefined,
  ): MarkedContent | null {
    if (!english) return null;
    const locale = i18n.language ?? DEFAULT_LOCALE;
    if (locale.startsWith(DEFAULT_LOCALE)) {
      return { display: english, english, isTranslated: false };
    }
    const key = `content.${cityId}.${field}`;
    const translated = t(key, { defaultValue: "" });
    if (!translated || translated === key) {
      return { display: english, english, isTranslated: false };
    }
    return { display: translated, english, isTranslated: true };
  };
}
