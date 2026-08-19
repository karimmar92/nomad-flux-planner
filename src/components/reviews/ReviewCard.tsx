import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { verifiedBadge, type PublicReview } from "@/lib/reviews/reviews";
import { flagEmoji } from "@/lib/arbitrage";

export function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          style={{ width: size, height: size }}
          className={cn(
            n <= rating ? "fill-accent-warning text-accent-warning" : "text-border",
          )}
          aria-hidden
        />
      ))}
    </span>
  );
}

export function ReviewCard({ review }: { review: PublicReview }) {
  return (
    <figure className="panel flex h-full flex-col p-4">
      <Stars rating={review.rating} />
      <blockquote className="mt-3 flex-1">
        <p className="text-sm font-semibold leading-snug">{review.headline}</p>
        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
          {review.body}
        </p>
      </blockquote>
      <figcaption className="mt-4 border-t border-border pt-3 text-xs">
        <span className="font-medium">{review.display_name}</span>
        {review.author_role ? (
          <span className="text-muted-foreground"> · {review.author_role}</span>
        ) : null}
        {review.country_code ? (
          <span className="text-muted-foreground">
            {" "}
            · {flagEmoji(review.country_code)} {review.country_code}
          </span>
        ) : null}
        <div className="mt-1 text-accent-positive">
          {verifiedBadge(review.plan_at_review, review.created_at)}
        </div>
      </figcaption>
    </figure>
  );
}
