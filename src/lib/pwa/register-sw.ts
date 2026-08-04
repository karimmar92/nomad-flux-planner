/**
 * Service-worker registration wrapper. The ONLY place `sw.js` is registered.
 *
 * Offline support is a product requirement (see the offline-first work in
 * src/lib/offline), but a service worker in a Lovable preview or dev context
 * serves stale HTML and deleted chunks, so registration is refused there and
 * any matching registration is actively removed.
 */

const SW_URL = "/sw.js";

function isRefusedContext(): boolean {
  if (typeof window === "undefined") return true;
  if (!import.meta.env.PROD) return true;
  if (window.top !== window.self) return true;

  const host = window.location.hostname;
  const refusedHost =
    host.startsWith("id-preview--") ||
    host.startsWith("preview--") ||
    host === "lovableproject.com" ||
    host.endsWith(".lovableproject.com") ||
    host === "lovableproject-dev.com" ||
    host.endsWith(".lovableproject-dev.com") ||
    host === "beta.lovable.dev" ||
    host.endsWith(".beta.lovable.dev");
  if (refusedHost) return true;

  return new URLSearchParams(window.location.search).has("sw")
    ? new URLSearchParams(window.location.search).get("sw") === "off"
    : false;
}

async function unregisterMatching() {
  if (!("serviceWorker" in navigator)) return;
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.allSettled(
    registrations
      .filter((r) => (r.active?.scriptURL ?? r.installing?.scriptURL ?? "").endsWith(SW_URL))
      .map((r) => r.unregister()),
  );
}

export function registerServiceWorker(): void {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  if (isRefusedContext()) {
    void unregisterMatching();
    return;
  }

  window.addEventListener("load", () => {
    void navigator.serviceWorker.register(SW_URL, { scope: "/" }).catch(() => {
      /* offline support is best-effort; never break the app over it */
    });
  });
}

/**
 * A new build has taken control of the page. Workbox is configured with
 * skipWaiting + clientsClaim so the new service worker activates immediately,
 * but the already-open tab keeps running the old JS until it reloads — hence
 * the visible prompt rather than a silent swap.
 */
export function onServiceWorkerUpdate(notify: () => void): () => void {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return () => {};
  let hadController = Boolean(navigator.serviceWorker.controller);
  const handler = () => {
    // The first controller on a fresh load is not an update.
    if (!hadController) {
      hadController = true;
      return;
    }
    notify();
  };
  navigator.serviceWorker.addEventListener("controllerchange", handler);
  return () => navigator.serviceWorker.removeEventListener("controllerchange", handler);
}
