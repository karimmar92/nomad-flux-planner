import { LEGAL_DISCLAIMER } from "@/lib/app";
import { Info } from "lucide-react";
import { useTranslation } from "react-i18next";
import { BilingualDisclaimer } from "@/components/i18n/TranslatedField";

/**
 * Persistent, non-dismissable legal footer for every visa/tax surface.
 * Rendered bilingually: translated for comprehension, English beneath, because
 * the English text is what stands if anyone ever disputes what we told them.
 */
export function LegalFooter() {
  const { t } = useTranslation("common");
  return (
    <div className="sticky bottom-0 z-20 mt-8 border-t border-border bg-background/95 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-start gap-2 text-muted-foreground">
        <Info className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
        <BilingualDisclaimer
          translated={t("legal.disclaimer")}
          english={LEGAL_DISCLAIMER}
          className="flex-1"
        />
      </div>
    </div>
  );
}
