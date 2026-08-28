/**
 * The index of every rule page — see src/config/rule-pages.ts for why the
 * individual pages exist.
 *
 * Each rule page was previously only reachable from a footer link or a direct
 * URL. This gives the section itself a page: one place that frames what is
 * covered, grouped by what kind of day-count each rule actually is, so both a
 * search engine and a reader land somewhere that explains the shape of the
 * whole thing before they pick one.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { APP_NAME, absoluteUrl } from "@/lib/app";
import { RULE_PAGES, ruleLabel, type RulePage } from "@/config/rule-pages";
import { Reveal } from "@/components/marketing/Reveal";

const GROUPS: { title: string; blurb: string; slugs: string[] }[] = [
  {
    title: "Short-stay and visa rules",
    blurb:
      "How long you can be somewhere on a passport alone, and how that gets enforced at the border.",
    slugs: ["schengen-90-180", "ees-entry-exit-system"],
  },
  {
    title: "Tax residency rules",
    blurb:
      "The day counts that decide which country can tax you, and on which of its own calendars.",
    slugs: ["feie-330-day-test", "183-day-rule", "uk-statutory-residence-test"],
  },
];

const TITLE = `Visa and tax residency rules, explained | ${APP_NAME}`;
const DESCRIPTION =
  "Every day-count rule this app tracks, in one place: the Schengen 90/180 rule, the EU Entry/Exit System, the US FEIE 330-day test, the 183-day rule and the UK Statutory Residence Test. Free calculator on every page.";

export const Route = createFileRoute("/rules/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: absoluteUrl("/rules") }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "CollectionPage",
              name: TITLE,
              description: DESCRIPTION,
              url: absoluteUrl("/rules"),
            },
            {
              "@type": "ItemList",
              itemListElement: RULE_PAGES.map((p, i) => ({
                "@type": "ListItem",
                position: i + 1,
                name: p.h1,
                url: absoluteUrl(`/rules/${p.slug}`),
              })),
            },
          ],
        }),
      },
    ],
  }),
  component: RulesIndex,
});

function RulesIndex() {
  const bySlug = new Map(RULE_PAGES.map((p) => [p.slug, p]));

  return (
    <div className="mx-auto max-w-3xl space-y-10 pb-16">
      <Reveal as="section" className="space-y-3">
        <h1 className="text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
          How each rule counts your days
        </h1>
        <p className="text-base leading-relaxed text-muted-foreground">
          Five rules, five different definitions of a day. Each page below has the live calculator
          for that rule, the mistakes that actually cost people money, and the primary source it is
          checked against.
        </p>
      </Reveal>

      {GROUPS.map((group) => (
        <Reveal as="section" key={group.title} className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">{group.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{group.blurb}</p>
          </div>
          <ul className="space-y-3">
            {group.slugs.map((slug) => {
              const page = bySlug.get(slug);
              if (!page) return null;
              return <RuleCard key={slug} page={page} />;
            })}
          </ul>
        </Reveal>
      ))}

      <Reveal as="section" className="panel space-y-4 p-6">
        <h2 className="text-lg font-semibold tracking-tight">One trip history, every rule</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          The same trips are measured differently by each rule above — Schengen counts your arrival
          day, the US 330-day test does not. {APP_NAME} runs all five against one trip history
          instead of five separate spreadsheets.
        </p>
        <Link
          to="/tracker"
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
        >
          Track them all — free
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </Reveal>
    </div>
  );
}

function RuleCard({ page }: { page: RulePage }) {
  return (
    <li>
      <Link
        to="/rules/$slug"
        params={{ slug: page.slug }}
        className="panel block space-y-1.5 p-4 transition-colors hover:border-primary"
      >
        <h3 className="text-sm font-semibold">{ruleLabel(page)}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{page.intro}</p>
      </Link>
    </li>
  );
}
