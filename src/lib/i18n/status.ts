import type { Locale, Namespace } from "./locales";

/**
 * Honest translation provenance, per language per namespace.
 *
 * `human`        — reviewed by a human speaker; safe to present as-is.
 * `machine`      — machine translated; the UI must say so at the top of the page.
 * `untranslated` — falls back to English; nothing is misrepresented.
 *
 * Six half-translated languages are a worse product than two complete ones, so
 * this table is the source of truth for what we claim, and it is surfaced to
 * the user rather than hidden.
 */
export type TranslationStatus = "human" | "machine" | "untranslated";

type StatusTable = Record<Locale, Partial<Record<Namespace, TranslationStatus>>>;

const ALL_HUMAN: Partial<Record<Namespace, TranslationStatus>> = {
  common: "human",
  cities: "human",
  visa: "human",
  tracker: "human",
  referral: "human",
  plan: "human",
};

const ALL_UNTRANSLATED: Partial<Record<Namespace, TranslationStatus>> = {
  common: "untranslated",
  cities: "untranslated",
  visa: "untranslated",
  tracker: "untranslated",
  referral: "untranslated",
  plan: "untranslated",
};

export const TRANSLATION_STATUS: StatusTable = {
  en: ALL_HUMAN,
  de: ALL_HUMAN,
  es: ALL_HUMAN,
  // Launch order: English first, then German and Spanish complete, then the
  // rest. Until a human has reviewed them these fall back to English rather
  // than shipping machine-translated visa rules that look authoritative.
  "pt-BR": ALL_UNTRANSLATED,
  fr: ALL_UNTRANSLATED,
  ru: ALL_UNTRANSLATED,
};

export function statusFor(locale: Locale, ns: Namespace): TranslationStatus {
  return TRANSLATION_STATUS[locale]?.[ns] ?? "untranslated";
}

/** Worst status across the namespaces a page depends on. */
export function pageStatus(locale: Locale, namespaces: Namespace[]): TranslationStatus {
  const order: TranslationStatus[] = ["human", "machine", "untranslated"];
  return namespaces.reduce<TranslationStatus>((worst, ns) => {
    const s = statusFor(locale, ns);
    return order.indexOf(s) > order.indexOf(worst) ? s : worst;
  }, "human");
}
