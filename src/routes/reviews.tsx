import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { APP_NAME } from "@/lib/app";
import { listApprovedReviews } from "@/lib/reviews/reviews.functions";
import { ReviewCard, Stars } from "@/components/reviews/ReviewCard";
import { ReviewForm } from "@/components/reviews/ReviewForm";

const reviewsQuery = queryOptions({
  queryKey: ["reviews", "approved"],
  queryFn: () => listApprovedReviews({ data: { limit: 100 } }),
  staleTime: 60_000,
});

export const Route = createFileRoute("/reviews")({
  head: () => ({
    meta: [
      { title: `Customer reviews | ${APP_NAME}` },
      {
        name: "description",
        content: `What paying ${APP_NAME} customers say about tracking Schengen days, tax residency and their leave-by date.`,
      },
      { property: "og:title", content: `Customer reviews | ${APP_NAME}` },
      {
        property: "og:description",
        content: "Reviews written by verified customers on a paid plan, published after review.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(reviewsQuery),
  errorComponent: () => (
    <p className="panel p-4 text-sm text-muted-foreground">
      Reviews could not be loaded right now. Please try again shortly.
    </p>
  ),
  notFoundComponent: () => <p className="p-4 text-sm text-muted-foreground">Not found.</p>,
  component: ReviewsPage,
});

function ReviewsPage() {
  const { data: reviews } = useSuspenseQuery(reviewsQuery);
  const average =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight">Customer reviews</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Only customers on a paid plan can write a review, and every review is read by us before
          it appears. We never edit the words.
        </p>
        {reviews.length > 0 ? (
          <div className="flex items-center gap-2 text-sm">
            <Stars rating={Math.round(average)} />
            <span className="num font-semibold">{average.toFixed(1)}</span>
            <span className="text-muted-foreground">
              from {reviews.length} review{reviews.length === 1 ? "" : "s"}
            </span>
          </div>
        ) : null}
      </header>

      <ReviewForm />

      {reviews.length === 0 ? (
        <section className="panel p-6 text-center">
          <p className="text-sm font-medium">No reviews yet — be the first.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {APP_NAME} is new. When customers start writing, their words show up here unchanged.
          </p>
          <Link to="/pricing" className="cta mt-4 inline-flex min-h-11">
            See the plans
          </Link>
        </section>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {reviews.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </div>
      )}
    </div>
  );
}
