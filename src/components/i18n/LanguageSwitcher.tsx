import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, Languages } from "lucide-react";
import { useLocale } from "./I18nProvider";
import {
  ENABLED_LOCALES,
  LOCALE_LABELS,
  TRANSLATION_READY,
  type Locale,
} from "@/lib/i18n/locales";
import { statusFor } from "@/lib/i18n/status";

/** Explicit language override. Honest about which languages are complete. */
export function LanguageSwitcher() {
  const { t } = useTranslation("common");
  const { locale, setLocale } = useLocale();
  const [open, setOpen] = useState(false);

  // Hidden until the app is genuinely translated. Offering German chrome over
  // English page content is worse than English throughout: the user cannot tell
  // whether the app is broken or whether the untranslated part was skipped on
  // purpose — and on visa content that ambiguity is not harmless.
  // See TRANSLATION_READY in src/lib/i18n/locales.ts.
  if (!TRANSLATION_READY || ENABLED_LOCALES.length < 2) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={t("language.change")}
        aria-expanded={open}
        className="flex h-8 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
      >
        <Languages className="h-4 w-4" />
        <span className="hidden sm:inline">{locale.toUpperCase()}</span>
        <ChevronDown className="h-3 w-3" />
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <ul className="absolute end-0 z-50 mt-1 w-56 overflow-hidden rounded-md border border-border bg-background py-1 shadow-lg">
            {ENABLED_LOCALES.map((l: Locale) => {
              const status = statusFor(l, "common");
              return (
                <li key={l}>
                  <button
                    onClick={() => {
                      void setLocale(l);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-start text-sm transition-colors hover:bg-surface-2 ${
                      l === locale ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    <span>{LOCALE_LABELS[l]}</span>
                    {status !== "human" ? (
                      <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {status === "machine" ? "MT" : "EN"}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
    </div>
  );
}
