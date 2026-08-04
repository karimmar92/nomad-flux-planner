import { useEffect, useState } from "react";
import { flushQueue, pendingCount } from "./sync-queue";

/** Live connectivity state. `true` during SSR so nothing renders an offline flash. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  return online;
}

/** Number of local writes waiting to reconcile with the server. */
export function usePendingSync(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let alive = true;
    const refresh = () => {
      void pendingCount().then((n) => {
        if (alive) setCount(n);
      });
    };
    refresh();
    const onOnline = () => {
      void flushQueue().then(refresh);
    };
    window.addEventListener("driftly:sync", refresh);
    window.addEventListener("online", onOnline);
    return () => {
      alive = false;
      window.removeEventListener("driftly:sync", refresh);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  return count;
}
