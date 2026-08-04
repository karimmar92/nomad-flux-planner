import { useTranslation } from "react-i18next";
import { Info } from "lucide-react";
import { useLocale } from "./I18nProvider";
import { pageStatus } from "@/lib/i18n/status";
import { LOCALE_LABELS, type Namespace } from "@/lib/i18n/locales";

/**
 * "This page is machine translated" at the top of a city page is far better
 * than silently presenting a machine-translated visa rule as authoritative.
 */
export function TranslationStatusBanner({ namespaces }: { namespaces: Namespace[] }) {
  const { t } = useTranslation("common");
  const { locale } = useLocale();
  if (locale === "en") return null;

  const status = pageStatus(locale, namespaces);
  if (status === "human") return null;

  const message =
    status === "machine"
      ? t("language.machineBanner")
      : t("language.untranslatedBanner", { language: LOCALE_LABELS[locale] });

  return (
    <div className="mb-4 flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-[12px] leading-relaxed text-foreground/90">
      <Info className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>{message}</span>
    </div>
  );
}
