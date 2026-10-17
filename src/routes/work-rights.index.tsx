/**
 * Index of the right-to-work and social-security guide.
 *
 * Reads as a map, not an answer: for each country, what an official source says
 * about remote work on a visitor's status, the lawful route if there is one, and
 * which social-security arrangements exist. Every card links to the detail page
 * with the sources.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { APP_NAME, absoluteUrl } from "@/lib/app";
import { WORK_RIGHTS } from "@/config/work-rights-data";
import { STATUS_LABEL, STATUS_SHORT, isStale, type VisitorWorkStatus } from "@/lib/work-rights";
import { todayIso } from "@/lib/trip-dates";
import { cn } from "@/lib/utils";

const TITLE = `Can you work remotely there? Right to work and social security by country | ${APP_NAME}`;
const DESCRIPTION =
  "What each country's official sources say about remote work on a visitor's status, the lawful route for remote workers, and which social security arrangements apply. Sourced and dated.";

export const Route = createFileRoute("/work-rights/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: absoluteUrl("/work-rights") }],
  }),
  component: WorkRightsIndex,
});

const TONE: Record<VisitorWorkStatus, string> = {
  not_permitted: "text-negative",
  grey_area: "text-warning",
  conditional: "text-positive",
  unclear: "text-muted-foreground",
};

const FILTERS: { id: VisitorWorkStatus | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "not_permitted", label: STATUS_SHORT.not_permitted },
  { id: "grey_area", label: STATUS_SHORT.grey_area },
  { id: "conditional", label: STATUS_SHORT.conditional },
  { id: "unclear", label: STATUS_SHORT.unclear },
];

function WorkRightsIndex() {
  const [filter, setFilter] = useState<VisitorWorkStatus | "all">("all");
  const today = todayIso();
  const rows = useMemo(
    () =>
      [...WORK_RIGHTS]
        .filter((e) => filter === "all" || e.visitorWork.status === filter)
        .sort((a, b) => a.country.localeCompare(b.country)),
    [filter],
  );

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-16">
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
          Can you work remotely there?
        </h1>
        <p className="text-base leading-relaxed text-muted-foreground">
          Being allowed to stay somewhere is not the same as being allowed to work from it. Each
          country below shows what an official source says, the route for remote workers where one
          exists, and the social-security arrangements. Every claim links to its source and says
          when it was checked.
        </p>
        <p className="rounded-lg border border-border bg-surface-2 p-3 text-xs leading-relaxed text-muted-foreground">
          This reports published official positions. It is not legal advice and does not say whether
          you may work, because that depends on your visa, contract and nationality. Check the
          source, and an adviser, before relying on it.
        </p>
      </section>

      <section className="space-y-2" aria-labelledby="ss-basics">
        <h2 id="ss-basics" className="text-lg font-semibold tracking-tight">
          How social security works across borders
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Inside the EU, the EEA and Switzerland, social security is coordinated so a person
          normally pays into one country&rsquo;s system at a time. An employee working temporarily
          in another member state can usually stay in their home system with an A1 certificate from
          the home institution. The rules for people working in several countries, and for the
          self-employed, depend on where they live and how much they work in each.
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Outside that area, protection comes from bilateral agreements. The United States has
          totalization agreements with a list of countries. Where one is in force, a certificate of
          coverage can keep a short-term worker in one system and avoid paying into both. Where
          there is none, contributions can be due in more than one country.
        </p>
        <p className="text-xs text-muted-foreground">
          None of this decides your case. Whether you qualify depends on your employer, where you
          live and how long you work abroad; ask your social security institution.{" "}
          <a
            href="https://eur-lex.europa.eu/eli/reg/2004/883/oj"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2"
          >
            EU Regulation 883/2004
          </a>
          {" · "}
          <a
            href="https://www.ssa.gov/international/agreements_overview.html"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2"
          >
            US totalization agreements
          </a>
        </p>
      </section>

      <div role="group" aria-label="Filter by official position" className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={
              filter === f.id
                ? "rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground"
                : "rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
            }
          >
            {f.label}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No countries match that filter yet.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((e) => (
            <li key={e.countryCode}>
              <Link
                to="/work-rights/$code"
                params={{ code: e.countryCode.toLowerCase() }}
                className="panel block space-y-1.5 p-4 transition-colors hover:border-primary"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold">{e.country}</h2>
                  <span className={cn("text-xs font-medium", TONE[e.visitorWork.status])}>
                    {STATUS_LABEL[e.visitorWork.status]}
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {e.visitorWork.summary}
                </p>
                <p className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                  {e.remoteRoute.name ? <span>Route: {e.remoteRoute.name}</span> : null}
                  <span>Checked {e.verifiedOn}</span>
                  {isStale(e, today) ? (
                    <span className="text-warning">May be out of date</span>
                  ) : null}
                  <ArrowRight className="ms-auto h-3.5 w-3.5" aria-hidden />
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
