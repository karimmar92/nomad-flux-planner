import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/ComingSoon";
import { APP_NAME } from "@/lib/app";

export const Route = createFileRoute("/stays")({
  head: () => ({
    meta: [
      { title: `Stays — coming soon | ${APP_NAME}` },
      {
        name: "description",
        content: "Nomad-vetted monthly rentals with honest pricing. Join the waitlist.",
      },
      { property: "og:title", content: `Stays — coming soon | ${APP_NAME}` },
      {
        property: "og:description",
        content: "Nomad-vetted monthly rentals with honest pricing.",
      },
    ],
  }),
  component: () => (
    <ComingSoon
      title="Stays"
      feature="stays"
      plan="Nomad-vetted monthly rentals — places someone who works from a laptop has actually stayed in and rated."
      bullets={[
        "Verified upload speed, desk and chair, not just photos",
        "Monthly pricing shown against the city's real rent range",
        "Reviews restricted to people who stayed 28+ nights",
      ]}
    />
  ),
});
