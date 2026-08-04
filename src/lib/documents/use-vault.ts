import { useCallback, useEffect, useState } from "react";
import { useOnline } from "@/lib/offline/use-online";
import { readCachedDocuments, syncVault, type VaultDocument } from "./vault";

/**
 * Reads the cached index first so the vault paints instantly and works with no
 * network, then refreshes from the server when there is one.
 */
export function useVault() {
  const online = useOnline();
  const [documents, setDocuments] = useState<VaultDocument[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const cached = await readCachedDocuments();
    setDocuments(cached);
    setLoading(false);
    if (!online) return;
    try {
      setDocuments(await syncVault());
    } catch {
      /* keep the cached copy — it is the one that matters */
    }
  }, [online]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { documents, loading, refresh, setDocuments };
}
