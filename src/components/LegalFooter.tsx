import { LEGAL_DISCLAIMER } from "@/lib/app";
import { Info } from "lucide-react";

/** Persistent, non-dismissable legal footer for every visa/tax surface. */
export function LegalFooter() {
  return (
    <div className="sticky bottom-0 z-20 mt-8 border-t border-border bg-background/95 px-4 py-3 backdrop-blur">
      <p className="mx-auto flex max-w-5xl items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
        <Info className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>{LEGAL_DISCLAIMER}</span>
      </p>
    </div>
  );
}
