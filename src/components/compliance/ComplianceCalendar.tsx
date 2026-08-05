import { AlertTriangle, CalendarClock, FileText, Plane, ShieldCheck, Stamp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { buildComplianceCalendar, kindLabel, type Obligation } from "@/lib/compliance-calendar";
import { formatDate } from "@/lib/i18n/format";
import type { VaultDocument } from "@/lib/documents/vault";
import { LEGAL_DISCLAIMER } from "@/lib/app";
import type { Trip } from "@/lib/types";
import { cn } from "@/lib/utils";

const ICONS = {
  visa_expiry: Stamp,
  visa_renewal: Stamp,
  passport_validity: ShieldCheck,
  document_expiry: FileText,
  tax_filing: CalendarClock,
  schengen_reentry: Plane,
} as const;

const SEVERITY = {
  critical: "border-s-accent-warning bg-accent-warning/5",
  warning: "border-s-accent-warning/50",
  info: "border-s-border",
} as const;

function whenLabel(daysAway: number): string {
  if (daysAway < 0) return `${-daysAway}d ago`;
  if (daysAway === 0) return "today";
  if (daysAway < 45) return `in ${daysAway}d`;
  return `in ${Math.round(daysAway / 30.4)} months`;
}

/**
 * One list, every deadline: visa, passport, insurance, filing.
 * Built entirely from cached trips and cached vault metadata, so it renders
 * in an immigration hall with no signal.
 */
export function ComplianceCalendar({
  trips,
  documents,
  limit,
  horizonDays,
}: {
  trips: Trip[];
  documents: VaultDocument[];
  limit?: number;
  /** Free plan only sees this far ahead; Pro sees the whole horizon. */
  horizonDays?: number;
}) {
  const all = buildComplianceCalendar(trips, documents).filter(
    (o) => horizonDays == null || o.daysAway <= horizonDays,
  );
  const items = limit ? all.slice(0, limit) : all;

  if (items.length === 0) {
    return (
      <div className="panel p-4 text-sm text-muted-foreground">
        Nothing dated is coming up. Add a trip or a document with an expiry date and its deadlines
        will appear here.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((o) => (
        <Row key={o.id} obligation={o} />
      ))}
      <p className="pt-1 text-[11px] leading-relaxed text-muted-foreground">{LEGAL_DISCLAIMER}</p>
    </div>
  );
}

function Row({ obligation }: { obligation: Obligation }) {
  const { i18n } = useTranslation();
  const Icon = ICONS[obligation.kind];
  return (
    <div
      className={cn(
        "panel flex gap-3 border-s-2 p-3",
        SEVERITY[obligation.severity],
      )}
    >
      <Icon
        className={cn(
          "mt-0.5 h-4 w-4 shrink-0",
          obligation.severity === "critical" ? "text-accent-warning" : "text-muted-foreground",
        )}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-sm font-medium">{obligation.title}</span>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {kindLabel(obligation.kind)}
          </span>
        </div>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{obligation.detail}</p>
      </div>
      <div className="shrink-0 text-end">
        <div className="num text-xs font-medium tabular-nums">
          {formatDate(obligation.date, i18n.language)}
        </div>
        <div className="text-[10px] text-muted-foreground">{whenLabel(obligation.daysAway)}</div>
      </div>
    </div>
  );
}

export function CalendarAlertCount({
  trips,
  documents,
}: {
  trips: Trip[];
  documents: VaultDocument[];
}) {
  const critical = buildComplianceCalendar(trips, documents).filter(
    (o) => o.severity === "critical" && o.daysAway <= 90,
  ).length;
  if (critical === 0) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-accent-warning/10 px-2 py-0.5 text-[11px] font-medium text-accent-warning">
      <AlertTriangle className="h-3 w-3" aria-hidden />
      {critical} needing attention
    </span>
  );
}
