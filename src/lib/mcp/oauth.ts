/**
 * Typed accessor for the Supabase auth OAuth namespace, used by the
 * MCP OAuth consent screen.
 *
 * Kept in its own module so it is never a module-level binding of the
 * consent route file — the TanStack code-splitter extracts such bindings
 * into the `?tsr-shared` virtual module, which broke the route at runtime.
 */
import { supabase } from "@/integrations/supabase/client";

export type AuthorizationDetails = {
  client?: { name?: string; client_uri?: string; redirect_uri?: string } | null;
  scope?: string | null;
  redirect_url?: string | null;
  redirect_to?: string | null;
};

export type OAuthResult = {
  data: AuthorizationDetails | null;
  error: { message: string } | null;
};

export type OAuthNamespace = {
  getAuthorizationDetails: (id: string) => Promise<OAuthResult>;
  approveAuthorization: (id: string) => Promise<OAuthResult>;
  denyAuthorization: (id: string) => Promise<OAuthResult>;
};

/** Supabase's experimental OAuth helpers are not in the generated types yet. */
export function oauth(): OAuthNamespace {
  return (supabase.auth as unknown as { oauth: OAuthNamespace }).oauth;
}
