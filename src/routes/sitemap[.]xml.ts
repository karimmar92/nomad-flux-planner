/**
 * sitemap.xml — generated from the city dataset.
 *
 * WHY THIS EXISTS: thirty city pages with genuinely good visa, tax and cost
 * data currently sit behind a client-side app with nothing pointing at them.
 * Google will find some eventually by crawling links; a sitemap makes the whole
 * set discoverable at once and reports which pages changed.
 *
 * The city pages are the compounding asset here — "digital nomad visa Portugal"
 * is a real search, we hold better data than most of what ranks for it, and
 * every published page keeps earning while nobody works on it.
 *
 * Generated rather than static so adding a city to seed-cities.json is enough.
 * A hand-maintained sitemap goes stale the first time someone forgets.
 */
import { createFileRoute } from "@tanstack/react-router";
import { CITIES, SEED_LAST_VERIFIED } from "@/lib/cities";
import { RULE_PAGES } from "@/config/rule-pages";
import { absoluteUrl } from "@/lib/app";

type Entry = { path: string; changefreq: string; priority: string; lastmod?: string };

/**
 * Public, indexable pages only.
 *
 * Deliberately excluded: /tracker, /record, /profile, /plans, /community and
 * anything under /org or /creator. They are either personal, empty without an
 * account, or both — indexing them wastes crawl budget and produces useless
 * search results that hurt more than they help.
 */
const STATIC_PAGES: Entry[] = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/explore", changefreq: "weekly", priority: "0.9" },
  { path: "/pricing", changefreq: "monthly", priority: "0.7" },
  { path: "/plan", changefreq: "monthly", priority: "0.8" },
  { path: "/setup/company", changefreq: "monthly", priority: "0.7" },
  { path: "/business", changefreq: "monthly", priority: "0.6" },
  { path: "/creators", changefreq: "monthly", priority: "0.5" },
  { path: "/how-we-make-money", changefreq: "yearly", priority: "0.4" },
];

function xmlEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function urlEntry(e: Entry): string {
  const lastmod = e.lastmod ? `\n    <lastmod>${e.lastmod}</lastmod>` : "";
  return `  <url>
    <loc>${xmlEscape(absoluteUrl(e.path))}</loc>${lastmod}
    <changefreq>${e.changefreq}</changefreq>
    <priority>${e.priority}</priority>
  </url>`;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: () => {
        const cityEntries: Entry[] = CITIES.map((c) => ({
          path: `/city/${c.id}`,
          changefreq: "monthly",
          priority: "0.8",
          // Cost figures carry a verification date; using it as lastmod tells
          // crawlers honestly when the content actually changed rather than
          // claiming freshness on every deploy.
          lastmod: SEED_LAST_VERIFIED,
        }));

        /**
         * The rule pages were missing from this sitemap entirely, which is the
         * wrong way round: "schengen 90/180 calculator" is a higher-intent
         * search than any city name, and these are the pages most likely to
         * earn a link. Priority above the city pages for that reason.
         *
         * Generated from RULE_PAGES so adding a page is enough, the same
         * argument as the cities. No lastmod: unlike the cost figures there is
         * no verification date to report honestly, and inventing one to look
         * fresh is how a sitemap stops being trusted.
         */
        const ruleEntries: Entry[] = RULE_PAGES.map((p) => ({
          path: `/rules/${p.slug}`,
          changefreq: "monthly",
          priority: "0.9",
        }));

        const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...STATIC_PAGES, ...ruleEntries, ...cityEntries].map(urlEntry).join("\n")}
</urlset>
`;

        return new Response(body, {
          headers: {
            "content-type": "application/xml; charset=utf-8",
            "cache-control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
