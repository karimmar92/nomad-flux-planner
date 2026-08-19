import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { APP_NAME } from "@/lib/app";
import { useSession } from "@/lib/use-session";
import { listAllReviews, moderateReview } from "@/lib/reviews/reviews.functions";
import { Stars } from "@/components/reviews/ReviewCard";

export const Route = createFileRoute("/admin/reviews")({
  head: () => ({
    meta: [
      { title: `Review moderation | ${APP_NAME}` },
      { name: "description", content: "Approve, reject or feature customer reviews." },
      { property: "og:title", content: `Review moderation | ${APP_NAME}` },
      { property: "og:description", content: "Internal moderation queue for customer reviews." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminReviewsPage,
});

function AdminReviewsPage() {
  const { signedIn, ready } = useSession();
  const fetchAll = useServerFn(listAllReviews);
  const act = useServerFn(moderateReview);
  const qc = useQueryClient();
  const [notes, setNotes] = useState<Record<string, string>>({});

  const { data, error, isLoading } = useQuery({
    queryKey: ["admin-reviews"],
    queryFn: () => fetchAll({}),
    enabled: signedIn,
    retry: false,
  });

  const run = async (input: Parameters<typeof act>[0]["data"]) => {
    try {
      await act({ data: input });
      await qc.invalidateQueries({ queryKey: ["admin-reviews"] });
      await qc.invalidateQueries({ queryKey: ["reviews"] });
      toast.success("Saved.");
    } catch (e) {
      toast.error((e as Error).message || "Could not save.");
    }
  };

  if (!ready) return null;
  if (!signedIn || error)
    return (
      <p className="panel p-4 text-sm text-muted-foreground">
        This page is restricted to administrators.
      </p>
    );
  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-xl font-semibold tracking-tight">Review moderation</h1>
      {data.length === 0 ? (
        <p className="panel p-4 text-sm text-muted-foreground">No reviews submitted yet.</p>
      ) : null}

      {data.map((review) => (
        <article key={review.id} className="panel space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Stars rating={review.rating} />
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              {review.status}
              {review.featured ? " · featured" : ""}
            </span>
          </div>
          <div>
            <p className="text-sm font-semibold">{review.headline}</p>
            <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{review.body}</p>
          </div>
          <p className="text-xs text-muted-foreground">
            {review.display_name}
            {review.author_role ? ` · ${review.author_role}` : ""}
            {review.country_code ? ` · ${review.country_code}` : ""} · {review.plan_at_review}
          </p>

          <input
            className="input min-h-11 w-full"
            placeholder="Note to the reviewer (optional)"
            value={notes[review.id] ?? review.review_note ?? ""}
            onChange={(e) => setNotes((n) => ({ ...n, [review.id]: e.target.value }))}
          />

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-secondary min-h-11"
              onClick={() =>
                void run({ id: review.id, status: "approved", note: notes[review.id] ?? "" })
              }
            >
              Approve
            </button>
            <button
              type="button"
              className="btn-ghost min-h-11 text-negative"
              onClick={() =>
                void run({ id: review.id, status: "rejected", note: notes[review.id] ?? "" })
              }
            >
              Reject
            </button>
            <button
              type="button"
              className="btn-ghost min-h-11"
              onClick={() => void run({ id: review.id, featured: !review.featured })}
            >
              {review.featured ? "Unfeature" : "Feature"}
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
