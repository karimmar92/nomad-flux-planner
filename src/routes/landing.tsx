/**
 * /landing — alias for the landing page, which also renders at "/".
 * The component lives in components/marketing/Landing.tsx so that neither
 * route file exports anything the code splitter cannot split.
 */
import { createFileRoute } from "@tanstack/react-router";
import { APP_NAME } from "@/lib/app";
import { Landing } from "@/components/marketing/Landing";

export const Route = createFileRoute("/landing")({
  head: () => ({
    meta: [
      { title: `${APP_NAME} — Every rule abroad is a day count` },
      {
        name: "description",
        content:
          "Schengen 90/180, 183-day tax residency, the US FEIE 330-day test and the UK SRT — all counted from one trip history, with the conventions that differ between them. Free to log trips, forever.",
      },
      { property: "og:title", content: `${APP_NAME} — Every rule abroad is a day count` },
      // "/" renders this same component, so this URL is a duplicate. Keep it
      // out of the index and point the canonical at the homepage rather than
      // letting two URLs compete for the same terms.
      { name: "robots", content: "noindex, follow" },
      {
        property: "og:description",
        content:
          "Visa limits, tax residency and the US 330-day exclusion, counted from one trip history.",
      },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: Landing,
});

