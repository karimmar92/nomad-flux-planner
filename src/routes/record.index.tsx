import { createFileRoute, Link } from "@tanstack/react-router";
import { FileText, FolderLock, ScrollText } from "lucide-react";
import { CalendarAlertCount, ComplianceCalendar } from "@/components/compliance/ComplianceCalendar";
import { APP_NAME, LEGAL_DISCLAIMER } from "@/lib/app";
import { useVault } from "@/lib/documents/use-vault";
import { expiryState } from "@/lib/documents/vault";
import { yearsWithData } from "@/lib/reports/tax-report";
import { useProfile, useTrips } from "@/lib/store";
import { FREE_CALENDAR_HORIZON_DAYS, isPro } from "@/lib/entitlements";
import { LockedPreview, ProBadge } from "@/components/ProGate";
import { buildComplianceCalendar } from "@/lib/compliance-calendar";

import { todayIso } from "@/lib/trip-dates";

export const Route = createFileRoute("/record/")({
  head: () => ({
    meta: [
      { title: `Your record | ${APP_NAME}` },
      {
        name: "description",
        content:
          "Every deadline, document and day counted in one place: visas, passport validity, insurance and year-end presence records.",
      },
      { property: "og:title", content: `Your record | ${APP_NAME}` },
      {
        property: "og:description",
        content: "Deadlines, documents and year-end presence records, available offline.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RecordHub,
});

function RecordHub() {
  const { trips } = useTrips();
  const { documents } = useVault();
  const { profile } = useProfile();
  const pro = isPro(profile.plan);
  const years = yearsWithData(trips, todayIso());
  const beyond = buildComplianceCalendar(trips, documents).filter(
    (o) => o.daysAway > FREE_CALENDAR_HORIZON_DAYS,
  );
  const expiring = documents.filter((d) => {

    const s = expiryState(d);
    return s && s.severity !== "ok";
  }).length;

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight">Your record</h1>
          <CalendarAlertCount trips={trips} documents={documents} />
        </div>
        <p className="max-w-2xl text-sm text-muted-foreground">
          The part of this that still matters when you stop moving: what you can prove, what expires,
          and what you would hand an accountant. All of it readable offline.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link to="/record/vault" className="panel group p-4 transition-colors hover:bg-surface-2">
          <FolderLock className="h-5 w-5 text-muted-foreground" aria-hidden />
          <h2 className="mt-2 flex items-center gap-2 text-sm font-semibold">
            Document vault {pro ? null : <ProBadge />}
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Passport, visa approvals, insurance certificates. Encrypted at rest, private to you, and
            cached on this device so a border check never depends on signal.
          </p>
          <p className="num mt-2 text-xs text-muted-foreground">
            {documents.length} stored
            {expiring > 0 ? ` · ${expiring} approaching expiry` : ""}
          </p>
        </Link>

        <div className="panel p-4">
          <ScrollText className="h-5 w-5 text-muted-foreground" aria-hidden />
          <h2 className="mt-2 flex items-center gap-2 text-sm font-semibold">
            Year-end presence record {pro ? null : <ProBadge />}
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Days per country against each country&rsquo;s day-count threshold, with the entry and exit
            log behind it. Evidence for an adviser, not a conclusion.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {years.length === 0 ? (
              <span className="text-xs text-muted-foreground">Log a trip to generate one.</span>
            ) : (
              years.map((y) => (
                <Link
                  key={y}
                  to="/record/report/$year"
                  params={{ year: String(y) }}
                  className="num inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs transition-colors hover:bg-surface-2"
                >
                  <FileText className="h-3.5 w-3.5" aria-hidden />
                  {y}
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Compliance calendar</h2>
        <p className="text-xs text-muted-foreground">
          Visa expiries, renewal windows, passport validity, document expiry and typical filing
          deadlines, merged and sorted.
        </p>
        {/* Free shows the next 30 days — enough to never miss something
            imminent. The forward horizon is the paid part. */}
        <ComplianceCalendar
          trips={trips}
          documents={documents}
          {...(pro ? {} : { horizonDays: FREE_CALENDAR_HORIZON_DAYS })}
        />
        {pro || beyond.length === 0 ? null : (
          <LockedPreview
            headline={`${beyond.length} more dated obligation${beyond.length === 1 ? "" : "s"} further out · next is ${beyond[0]!.title}`}
            detail="Pro shows every dated obligation ahead of you — renewal windows, passport validity and filing deadlines months out, while you can still act on them."
          >
            <ComplianceCalendar trips={trips} documents={documents} />
          </LockedPreview>
        )}

      </section>

      <p className="text-[11px] leading-relaxed text-muted-foreground">{LEGAL_DISCLAIMER}</p>
    </div>
  );
}
