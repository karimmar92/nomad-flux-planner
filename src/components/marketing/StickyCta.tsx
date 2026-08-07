/**
 * Sticky bottom CTA — appears once the hero has scrolled away, disappears at
 * the closing CTA so two calls to action never compete on screen.
 *
 * The honest version of a persistent bar: it restates the offer and the price,
 * and it is dismissible. No countdown, no "3 people are viewing this", no fake
 * scarcity. Those lift a first conversion and cost the renewal — and invented
 * urgency in a commercial communication is a misleading practice under UWG,
 * not merely tacky.
 */
import { useEffect, useState } from "react";
import { ArrowRight, X } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { tier } from "@/config/pricing";

export function StickyCta() {
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      const bottom = document.body.scrollHeight - window.innerHeight - y;
      // Visible in the middle of the page only: after the hero, before the
      // page's own closing CTA.
      setShow(y > 600 && bottom > 700);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (dismissed) return null;

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur transition-transform duration-300",
        show ? "translate-y-0" : "translate-y-full",
      )}
      // Hidden from assistive tech when off-screen, so it is not read out of
      // context or focusable while invisible.
      aria-hidden={!show}
    >
      <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-2.5">
        <p className="flex-1 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Free forever to track.</span> Planning and
          reports from ${tier("starter").monthlyUsd}/mo.
        </p>
        <Link
          to="/tracker"
          tabIndex={show ? 0 : -1}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground"
        >
          Start free
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
        <button
          onClick={() => setDismissed(true)}
          tabIndex={show ? 0 : -1}
          aria-label="Dismiss"
          className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    </div>
  );
}
