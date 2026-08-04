import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/ComingSoon";
import { APP_NAME } from "@/lib/app";

export const Route = createFileRoute("/community")({
  head: () => ({
    meta: [
      { title: `Community — coming soon | ${APP_NAME}` },
      {
        name: "description",
        content:
          "Matching freelancers with startup founders by city and skill. Join the waitlist.",
      },
      { property: "og:title", content: `Community — coming soon | ${APP_NAME}` },
      {
        property: "og:description",
        content: "Matching freelancers with startup founders by city and skill.",
      },
    ],
  }),
  component: () => (
    <ComingSoon
      title="Community"
      feature="community"
      plan="Matching freelancers with startup founders by city and skill — so the person you need is the one already in your timezone."
      bullets={[
        "Filter by city, skill and availability",
        "Founders post scoped work, freelancers signal capacity",
        "No feed, no engagement loop — just introductions that lead somewhere",
      ]}
    />
  ),
});
