/**
 * /explore — the city grid, always, regardless of sign-in state.
 *
 * "/" switches: landing page when signed out, Explore when signed in. This
 * route exists so a signed-out visitor can still browse cities — browsing is
 * the acquisition and SEO surface, and putting it behind a signup wall would
 * cost more traffic than it earns.
 *
 * The component is shared with "/" rather than duplicated. One grid, one set
 * of filters, one place to change them.
 */
import { createFileRoute } from "@tanstack/react-router";
import { Explore } from "./index";
import { APP_NAME } from "@/lib/app";

export const Route = createFileRoute("/explore")({
  head: () => ({
    meta: [
      { title: `Explore cities — what each one costs you | ${APP_NAME}` },
      {
        name: "description",
        content:
          "Cost of living, visa rules and tax thresholds for 30 cities, with what you'd keep each month on your income.",
      },
    ],
  }),
  component: Explore,
});
