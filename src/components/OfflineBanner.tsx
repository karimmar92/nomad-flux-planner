import { CloudOff, RefreshCcw } from "lucide-react";
import { useOnline, usePendingSync } from "@/lib/offline/use-online";

/**
 * Persistent, non-blocking offline state. Never an error, never a spinner:
 * every screen the user needs offline already has its data locally.
 */
export function OfflineBanner() {
  const online = useOnline();
  const pending = usePendingSync();

  if (online && pending === 0) return null;

  if (!online) {
    return (
      <div
        role="status"
        className="flex items-center justify-center gap-2 border-b border-border bg-surface-2 px-4 py-1.5 text-xs text-muted-foreground"
      >
        <CloudOff className="h-3.5 w-3.5" aria-hidden />
        Offline — your data is saved and will sync.
      </div>
    );
  }

  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 border-b border-border bg-surface-2 px-4 py-1.5 text-xs text-muted-foreground"
    >
      <RefreshCcw className="h-3.5 w-3.5" aria-hidden />
      Syncing {pending} saved {pending === 1 ? "change" : "changes"}…
    </div>
  );
}

/**
 * For the handful of features that genuinely cannot work without a network
 * (partner links, radar, creator dashboard). Visibly disabled with a reason,
 * rather than failing when tapped.
 */
export function RequiresNetwork({
  reason,
  children,
}: {
  reason: string;
  children: React.ReactNode;
}) {
  const online = useOnline();
  if (online) return <>{children}</>;

  return (
    <div
      aria-disabled
      className="rounded-md border border-dashed border-border bg-surface-2/50 px-3 py-2 text-xs text-muted-foreground"
    >
      <span className="inline-flex items-center gap-1.5">
        <CloudOff className="h-3.5 w-3.5" aria-hidden />
        {reason}
      </span>
    </div>
  );
}
