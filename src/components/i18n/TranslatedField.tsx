import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Languages } from "lucide-react";

/**
 * LEGALLY CONSEQUENTIAL CONTENT PASSES THROUGH HERE. NOTHING ELSE IS ACCEPTABLE.
 *
 * A mistranslated button label is an annoyance. A mistranslated visa rule can
 * get someone barred from a country for three years. So `arbitrage_note`,
 * `visa.nomadVisa.notes`, `tax.notes`, `connectivity_warning` and every
 * disclaimer render through this component: the translation is shown, marked
 * as a translation, and the English original stays one tap away and is stored
 * alongside it.
 *
 * Rule for anyone adding new strings: if it describes a visa, a tax rule, a
 * deadline, a penalty or a legal obligation, it goes through TranslatedField
 * (or BilingualDisclaimer) — never through a bare t() call and never through a
 * machine translation presented as authoritative.
 */
export function TranslatedField({
  translated,
  english,
  className,
  children,
}: {
  /** The localised text, or undefined when no translation exists yet. */
  translated?: string | null;
  /** The authoritative English source. Always required. */
  english: string;
  className?: string;
  children?: ReactNode;
}) {
  const { t } = useTranslation("common");
  const [showOriginal, setShowOriginal] = useState(false);

  const hasTranslation = !!translated && translated.trim() !== english.trim();
  const body = hasTranslation ? translated! : english;

  return (
    <div className={className}>
      <p className="text-sm leading-relaxed text-foreground/90">{children ?? body}</p>
      {hasTranslation ? (
        <>
          <button
            type="button"
            onClick={() => setShowOriginal((v) => !v)}
            className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            <Languages className="h-3 w-3" aria-hidden />
            {showOriginal ? t("language.hideOriginal") : t("language.translatedMarker")}
          </button>
          {showOriginal ? (
            <p
              lang="en"
              className="mt-1.5 border-s-2 border-border ps-3 text-[13px] leading-relaxed text-muted-foreground"
            >
              {english}
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

/**
 * Disclaimers appear in BOTH languages: translated for comprehension, English
 * beneath in smaller text. If a dispute ever arises about what the app told
 * someone, the English is what stands.
 */
export function BilingualDisclaimer({
  translated,
  english,
  className,
}: {
  translated: string;
  english: string;
  className?: string;
}) {
  const isEnglish = translated.trim() === english.trim();
  return (
    <div className={className}>
      <p className="text-[11px] leading-relaxed text-muted-foreground">{translated}</p>
      {isEnglish ? null : (
        <p lang="en" className="mt-1 text-[10px] leading-relaxed text-muted-foreground/70">
          {english}
        </p>
      )}
    </div>
  );
}
