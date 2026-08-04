import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useSession() {
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setUserId(data.session?.user.id ?? null);
      setEmail(data.session?.user.email ?? null);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null);
      setEmail(session?.user.email ?? null);
      setReady(true);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { userId, email, ready, signedIn: Boolean(userId) };
}
