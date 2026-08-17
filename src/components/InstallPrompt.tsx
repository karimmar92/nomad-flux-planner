/**
 * "Install this" — the missing half of the offline promise.
 *
 * ── THE GAP THIS FILLS ─────────────────────────────────────────────────
 *
 * The offline machinery is real and already built: a service worker, workbox
 * runtime caching, a manifest with icons. The landing page says "Works offline"
 * and that claim is true.
 *
 * But almost nobody gets the benefit, because the app is only genuinely offline
 * once it has been INSTALLED, and nothing anywhere tells anyone to install it.
 * A visitor in Safari gets a cached tab that iOS will evict, not an icon on
 * their home screen. The promise on the landing page and the experience most
 * people actually have are different things.
 *
 * ── WHY iOS NEEDS ITS OWN PATH ─────────────────────────────────────────
 *
 * Chrome and Edge fire `beforeinstallprompt`, which lets us show a real button
 * that installs in one tap. Safari does not implement it and Apple has shown no
 * sign of adding it. On iOS the only route is Share, then "Add to Home Screen",
 * done by hand.
 *
 * That means a single generic "Install" button is wrong: on iOS it would either
 * do nothing or lie. So the component detects which world it is in and either
 * offers the real prompt or explains the manual steps. Two paths, because the
 * platforms genuinely differ.
 *
 * ── WHY IT MATTERS MORE FOR THIS PRODUCT THAN MOST ─────────────────────
 *
 * The moment this app is most needed is the passport queue: no roaming, no
 * signal, an officer waiting. That is exactly the moment a browser tab fails
 * and an installed app does not. Installing is not a nice-to-have here, it is
 * the difference between the product working when it matters and not.
 *
 * ── WHAT IT DELIBERATELY DOES NOT DO ───────────────────────────────────
 *
 * No interstitial, no modal over the content, no repeat nagging. It is a quiet
 * inline card, dismissable, and the dismissal sticks. An install prompt that
 * blocks the page is the single most complained-about pattern on mobile web,
 * and this audience is more allergic to it than most.
 */
import { useEffect, useState } from "react";
import { Share, Plus, X, Download } from "lucide-react";
import { APP_NAME } from "@/lib/app";

const DISMISS_KEY = "driftly.install-prompt.dismissed";

/** The Chrome/Edge event, which TypeScript's DOM lib does not describe. */
type InstallEvent = Event & { prompt: () => Promise<void> };

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // Safari's own, non-standard flag for a home-screen launch.
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<InstallEvent | null>(null);
  const [show, setShow] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    // Already installed: never ask. This is the check people forget, and it is
    // why so many PWAs nag you inside the app you just installed.
    if (isStandalone()) return;
    try {
      if (localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      // Private mode or blocked storage. Showing once is the safe failure.
    }

    if (isIos()) {
      setIos(true);
      setShow(true);
      return;
    }

    const onPrompt = (e: Event) => {
      // Stop Chrome's own mini-infobar so there is exactly one ask, ours.
      e.preventDefault();
      setDeferred(e as InstallEvent);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!show) return null;

  function dismiss() {
    setShow(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Nothing to do. Worst case it is offered again next visit.
    }
  }

  return (
    <section className="surface relative flex gap-3 p-4 text-sm">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute end-2 top-2 rounded p-1 text-muted-foreground hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" aria-hidden />
      </button>

      <Download className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />

      <div className="pe-6">
        <p className="font-medium">Put {APP_NAME} on your home screen.</p>

        {ios ? (
          <>
            <p className="mt-1 leading-relaxed text-muted-foreground">
              Your trips, the city data and every visa rule are then stored on the phone. It opens
              and counts with no signal, which is the state you will be in at the border.
            </p>
            {/* Spelled out, because Safari gives us no button to offer. */}
            <ol className="mt-3 space-y-1.5 text-muted-foreground">
              <li className="flex items-center gap-2">
                <span className="num text-xs">1.</span>
                <Share className="h-3.5 w-3.5" aria-hidden />
                <span>Tap Share, at the bottom of Safari</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="num text-xs">2.</span>
                <Plus className="h-3.5 w-3.5" aria-hidden />
                <span>Choose &ldquo;Add to Home Screen&rdquo;</span>
              </li>
            </ol>
          </>
        ) : (
          <>
            <p className="mt-1 leading-relaxed text-muted-foreground">
              It works with no signal once installed, which is the state you will be in at the
              border. Nothing is uploaded by installing.
            </p>
            <button
              type="button"
              onClick={async () => {
                if (!deferred) return;
                await deferred.prompt();
                // One ask either way. Someone who declined does not want it
                // offered again on the next page they open.
                dismiss();
              }}
              className="mt-3 rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground"
            >
              Install
            </button>
          </>
        )}
      </div>
    </section>
  );
}
