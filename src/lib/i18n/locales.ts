/**
 * Locale registry.
 *
 * Launch set is en/es/pt-BR/de/fr/ru. Russian and Brazilian Portuguese are
 * deliberate: the Russian-speaking relocation population across Georgia,
 * Türkiye, Armenia, Thailand and Argentina — and the Brazilian one across
 * Latin America — is exactly this product's geography.
 *
 * Phase two (registered but not enabled): zh-Hans, it, tr, id.
 */

export const LOCALES = ["en", "es", "pt-BR", "de", "fr", "ru"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/**
 * TRANSLATION IS NOT SHIPPABLE YET — the switcher stays hidden until it is.
 *
 * Current coverage: the nav, footer and legal disclaimer are translated. Zero
 * route components call `t()`, and only 6 of 75 components do. Selecting German
 * therefore produced a German header above an entirely English page, which is
 * more confusing than English alone — a user cannot tell whether the app is
 * broken, or whether the untranslated part is the part that matters.
 *
 * This is worse than no translation, and visa content is precisely where a
 * half-finished job does damage: a user who sees German chrome reasonably
 * assumes the visa rules beneath it were localised for them too.
 *
 * The locale files (en/es/de) are complete and stay in the repo. Flip this to
 * true once route components actually consume them — start with `common`,
 * `tracker` and `visa`, verify one language end to end, and only then add more.
 */
export const TRANSLATION_READY = false;

/** Locales offered in the UI. Empty until the app is genuinely translated. */
export const ENABLED_LOCALES: readonly Locale[] = TRANSLATION_READY
  ? LOCALES
  : [DEFAULT_LOCALE];

/** Phase two — listed so the plumbing is ready, not shipped in the switcher. */
export const PHASE_TWO_LOCALES = ["zh-Hans", "it", "tr", "id"] as const;

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  es: "Español",
  "pt-BR": "Português (Brasil)",
  de: "Deutsch",
  fr: "Français",
  ru: "Русский",
};

/** BCP-47 tag used for hreflang and for Intl formatting. */
export const LOCALE_TAGS: Record<Locale, string> = {
  en: "en",
  es: "es",
  "pt-BR": "pt-BR",
  de: "de",
  fr: "fr",
  ru: "ru",
};

/**
 * Not needed for the six launch languages, but Arabic and Hebrew are plausible
 * later. Everything in the app uses logical CSS properties so enabling one is
 * a configuration change rather than a rewrite.
 */
export const RTL_LOCALES: string[] = ["ar", "he", "fa", "ur"];

export function isRtl(locale: string) {
  return RTL_LOCALES.includes(locale.split("-")[0] ?? locale);
}

export function isLocale(value: string | undefined): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}

/** Maps a raw navigator.language (e.g. "pt-br", "de-AT") to a launch locale. */
export function resolveLocale(raw: string | undefined | null): Locale {
  if (!raw) return DEFAULT_LOCALE;
  const exact = LOCALES.find((l) => l.toLowerCase() === raw.toLowerCase());
  if (exact) return exact;
  const base = (raw.split("-")[0] ?? raw).toLowerCase();
  if (base === "pt") return "pt-BR";
  const match = LOCALES.find((l) => (l.split("-")[0] ?? l).toLowerCase() === base);
  return match ?? DEFAULT_LOCALE;
}

export const NAMESPACES = [
  "common",
  "cities",
  "visa",
  "tracker",
  "referral",
  "plan",
] as const;
export type Namespace = (typeof NAMESPACES)[number];
