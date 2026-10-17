/**
 * One country's right-to-work and social-security page.
 *
 * Evidence, never a verdict: each block states what an official source says,
 * links it, and the page says when it was checked and what could not be
 * verified. Nothing here tells a reader they may or may not work.
 */
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { APP_NAME, absoluteUrl } from "@/lib/app";
import { workRightsFor } from "@/config/work-rights-data";
import { STATUS_LABEL, isStale, type Source, type WorkRightsEntry } from "@/lib/work-rights";
import { todayIso } from "@/lib/trip-dates";

export const Route = createFileRoute("/work-rights/$code")({
  loader: ({ params }) => {
    const entry = workRightsFor(params.code);
    if (!entry) throw notFound();
    return { entry };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Country not found" }, { name: "robots", content: "noindex" }] };
    }
    const { entry } = loaderData;
    const title = `Remote work in ${entry.country}: visitor status, remote-work route and social security | ${APP_NAME}`;
    const description = `${entry.visitorWork.summary} Sourced from official publications, checked ${entry.verifiedOn}.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary" },
      ],
      links: [
        { rel: "canonical", href: absoluteUrl(`/work-rights/${entry.countryCode.toLowerCase()}`) },
      ],
    };
  },
  notFoundComponent: () => (
    <div className="py-16 text-center text-sm text-muted-foreground">
      That country is not in the guide yet.{" "}
      <Link to="/work-rights" className="underline">
        See the ones that are
      </Link>
      .
    </div>
  ),
  component: CountryPage,
});

function Sources({ sources }: { sources: Source[] }) {
  if (sources.length === 0) return null;
  return (
    <ul className="mt-2 space-y-1 text-xs">
      {sources.map((s) => (
        <li key={s.url}>
          <a
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-foreground"
          >
            {s.label}
            <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
        </li>
      ))}
    </ul>
  );
}

function yesNo(v: boolean | null): string {
  return v === null ? "Not established" : v ? "Yes" : "No";
}

function CountryPage() {
  const { entry } = Route.useLoaderData() as { entry: WorkRightsEntry };
  const stale = isStale(entry, todayIso());
  const ss = entry.socialSecurity;

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-16">
      <nav className="text-xs text-muted-foreground">
        <Link to="/work-rights" className="underline underline-offset-2">
          Right to work by country
        </Link>
      </nav>

      <header className="space-y-2">
        <h1 className="text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
          Remote work in {entry.country}
        </h1>
        <p className="text-xs text-muted-foreground">
          Sources checked {entry.verifiedOn} · confidence {entry.confidence}
        </p>
        {stale ? (
          <p className="flex items-start gap-2 rounded-lg border border-warning/40 bg-surface-2 p-3 text-xs">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
            This was last checked more than a year ago and may be out of date. Confirm with the
            sources below.
          </p>
        ) : null}
      </header>

      <section className="space-y-2" aria-labelledby="visitor">
        <h2 id="visitor" className="text-lg font-semibold tracking-tight">
          Working remotely on visitor status
        </h2>
        <p className="text-sm font-medium">{STATUS_LABEL[entry.visitorWork.status]}</p>
        <p className="text-sm leading-relaxed text-muted-foreground">{entry.visitorWork.summary}</p>
        <Sources sources={entry.visitorWork.sources} />
      </section>

      <section className="space-y-2" aria-labelledby="route">
        <h2 id="route" className="text-lg font-semibold tracking-tight">
          The route for remote workers
        </h2>
        {entry.remoteRoute.name ? (
          <>
            <p className="text-sm font-medium">{entry.remoteRoute.name}</p>
            {entry.remoteRoute.conditions ? (
              <p className="text-sm leading-relaxed text-muted-foreground">
                {entry.remoteRoute.conditions}
              </p>
            ) : null}
            <Sources sources={entry.remoteRoute.sources} />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            No dedicated remote-work route was found in the official sources checked.
          </p>
        )}
      </section>

      <section className="space-y-2" aria-labelledby="ss">
        <h2 id="ss" className="text-lg font-semibold tracking-tight">
          Social security
        </h2>
        <dl className="panel grid gap-x-6 gap-y-2 p-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="label-xs">EU/EEA coordination (A1)</dt>
            <dd>{yesNo(ss.euCoordination)}</dd>
          </div>
          <div>
            <dt className="label-xs">US totalization agreement</dt>
            <dd>
              {yesNo(ss.usTotalization)}
              {ss.usTotalization && ss.usTotalizationYear
                ? ` (in force ${ss.usTotalizationYear})`
                : ""}
            </dd>
          </div>
        </dl>
        <p className="text-sm leading-relaxed text-muted-foreground">{ss.note}</p>
        <Sources sources={ss.sources} />
        <p className="text-xs text-muted-foreground">
          How these arrangements work in general is on the{" "}
          <Link to="/work-rights" className="underline underline-offset-2">
            guide page
          </Link>
          .
        </p>
      </section>

      {entry.openQuestions.length > 0 ? (
        <section className="space-y-2" aria-labelledby="open">
          <h2 id="open" className="text-lg font-semibold tracking-tight">
            What we could not verify
          </h2>
          <ul className="list-disc space-y-1 ps-5 text-sm text-muted-foreground">
            {entry.openQuestions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="rounded-lg border border-border bg-surface-2 p-3 text-xs leading-relaxed text-muted-foreground">
        Informational only, not legal or tax advice. This reports what published official sources
        say. Whether you may work depends on your own visa, contract and nationality. Check the
        sources and ask an adviser before relying on it.
      </p>
    </div>
  );
}
