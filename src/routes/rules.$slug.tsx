/**
 * One indexable page per rule — see src/config/rule-pages.ts for why.
 *
 * A single dynamic route serves all four, so adding a fifth rule is a data
 * change rather than a new file. Content comes from config, the calculator is
 * the real engine, and everything is usable without an account.
 */
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, Check } from "lucide-react";
import { APP_NAME, absoluteUrl } from "@/lib/app";
import { RULE_PAGES, rulePageBySlug, type RulePage } from "@/config/rule-pages";
import { RuleCalculator } from "@/components/marketing/RuleCalculator";
import { FaqList } from "@/components/marketing/Faq";
import { Reveal } from "@/components/marketing/Reveal";

export const Route = createFileRoute("/rules/$slug")({
  loader: ({ params }) => {
    const page = rulePageBySlug(params.slug);
    if (!page) throw notFound();
    return { page };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Rule not found" }, { name: "robots", content: "noindex" }] };
    }
    const { page } = loaderData;
    return {
      meta: [
        { title: `${page.title} | ${APP_NAME}` },
        { name: "description", content: page.metaDescription },
        { property: "og:title", content: page.title },
        { property: "og:description", content: page.metaDescription },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      // Absolute, not `/rules/...`: Google ignores a relative canonical, which
      // silently un-does the whole point of having one page per rule.
      links: [{ rel: "canonical", href: absoluteUrl(`/rules/${page.slug}`) }],
    };
  },
  notFoundComponent: () => (
    <div className="py-16 text-center text-sm text-muted-foreground">Rule not found.</div>
  ),
  component: RulePageView,
});

function RulePageView() {
  const { page } = Route.useLoaderData();
  const others = RULE_PAGES.filter((p) => p.slug !== page.slug);

  return (
    <div className="mx-auto max-w-3xl space-y-12 pb-16">
      <Reveal as="section" className="space-y-4">
        <h1 className="text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
          {page.h1}
        </h1>
        <p className="text-base leading-relaxed text-muted-foreground">{page.intro}</p>
      </Reveal>

      <Reveal as="section">
        <RuleCalculator only={page.id} initialCountry={page.defaultCountry} />
      </Reveal>

      <Reveal as="section" className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">
          What goes wrong, in order of how often
        </h2>
        <ul className="space-y-3">
          {page.mistakes.map((m: RulePage["mistakes"][number]) => (
            <li key={m.title} className="panel flex items-start gap-2.5 p-4">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-accent-warning" aria-hidden />
              <div>
                <h3 className="text-sm font-medium">{m.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{m.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </Reveal>

      <Reveal as="section" className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Questions people ask</h2>
        <FaqList items={page.faq} />
      </Reveal>

      <Reveal as="section" className="panel space-y-4 p-6">
        <h2 className="text-lg font-semibold tracking-tight">
          This rule is not the only one counting your days
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          The same trips are measured by every other rule you are subject to, and the counting
          conventions contradict each other — Schengen counts your arrival day, the US 330-day test
          does not. {APP_NAME} runs them all against one trip history.
        </p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {others.map((o) => (
            <li key={o.slug}>
              <Link
                to="/rules/$slug"
                params={{ slug: o.slug }}
                className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:border-primary hover:text-primary"
              >
                <Check className="h-3.5 w-3.5 shrink-0 text-positive" aria-hidden />
                {o.h1}
              </Link>
            </li>
          ))}
        </ul>
        <Link
          to="/tracker"
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
        >
          Track them all — free
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </Reveal>

      <p className="text-xs text-muted-foreground">
        {APP_NAME} reports your recorded day counts against published thresholds. It does not
        determine your visa or tax status — confirm both with official sources or a qualified
        adviser.
      </p>
    </div>
  );
}
