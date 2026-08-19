import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * A failed session read must never leave the UI hanging.
 *
 * getSession() previously had a .then() and no .catch(). If it rejected —
 * offline, a corrupt stored token, a blocked network call — `ready` stayed
 * false forever, and every control gated on `ready` (the paid CTAs on
 * /pricing among them) rendered permanently disabled. Both a rejection and a
 * promise that simply never settles are now treated as "signed out, carry on".
 */
const SESSION_READY_TIMEOUT_MS = 5000;

export function useSession() {
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    // Safety net: if the promise never settles at all, unblock the UI anyway.
    const timer = setTimeout(() => {
      if (active) setReady(true);
    }, SESSION_READY_TIMEOUT_MS);

    void supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        setUserId(data.session?.user.id ?? null);
        setEmail(data.session?.user.email ?? null);
        setReady(true);
      })
      .catch(() => {
        // Treat an unreadable session as signed out rather than as pending.
        if (!active) return;
        setUserId(null);
        setEmail(null);
        setReady(true);
      });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null);
      setEmail(session?.user.email ?? null);
      setReady(true);
    });
    return () => {
      active = false;
      clearTimeout(timer);
      sub.subscription.unsubscribe();
    };
  }, []);

  return { userId, email, ready, signedIn: Boolean(userId) };
}

/**
 * Resolve the session at click time.
 *
 * Purchase buttons are never disabled while auth hydrates — a disabled buy
 * button is indistinguishable from a broken site. Instead the click handler
 * awaits this, which returns the current session state without ever hanging.
 */
export async function resolveSignedIn(): Promise<boolean> {
  try {
    const result = await Promise.race([
      supabase.auth.getSession().then(({ data }) => Boolean(data.session?.user.id)),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), SESSION_READY_TIMEOUT_MS)),
    ]);
    return result;
  } catch {
    return false;
  }
}
