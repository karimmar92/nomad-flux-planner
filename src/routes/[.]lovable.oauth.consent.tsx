/**
 * OAuth consent screen. Supabase redirects here with an authorization_id when an
 * external client (ChatGPT, Claude, Cursor…) asks to use Driftly's MCP tools as
 * the signed-in user.
 */
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { APP_NAME } from "@/lib/app";
import { oauth, type AuthorizationDetails } from "@/lib/mcp/oauth";

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s["authorization_id"] === "string" ? s["authorization_id"] : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({
        to: "/auth",
        search: { next: location.pathname + location.searchStr },
      });
    }
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauth().getAuthorizationDetails(authorizationId);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  errorComponent: ({ error }) => (
    <main className="mx-auto max-w-md py-10">
      <h1 className="text-xl font-semibold">Could not load this authorization request</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {String((error as Error)?.message ?? error)}
      </p>
    </main>
  ),
  component: Consent,
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientName = details?.client?.name ?? "an app";

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const { data, error: err } = approve
      ? await oauth().approveAuthorization(authorization_id)
      : await oauth().denyAuthorization(authorization_id);
    if (err) {
      setBusy(false);
      return setError(err.message);
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      return setError("No redirect returned by the authorization server.");
    }
    window.location.href = target;
  }

  return (
    <main className="mx-auto max-w-md space-y-5 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Connect {clientName} to {APP_NAME}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          This lets {clientName} call Driftly&apos;s tools while you are signed in — city costs,
          visa rules and the Schengen 90/180 engine.
        </p>
      </div>

      <div className="panel space-y-2 p-4 text-sm">
        <Row label="Client" value={clientName} />
        {details?.client?.redirect_uri ? (
          <Row label="Redirects to" value={details.client.redirect_uri} />
        ) : null}
        <Row label="Requested access" value={details?.scope || "Basic profile and email"} />
      </div>

      <p className="text-xs text-muted-foreground">
        This does not bypass Driftly&apos;s permissions or backend policies.
      </p>

      {error ? (
        <p role="alert" className="text-sm text-negative">
          {error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <button type="button"
          disabled={busy}
          onClick={() => decide(true)}
          className="flex-1 rounded-lg bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          Approve
        </button>
        <button type="button"
          disabled={busy}
          onClick={() => decide(false)}
          className="flex-1 rounded-lg border border-border px-3 py-2.5 text-sm disabled:opacity-60"
        >
          Cancel connection
        </button>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="label-xs">{label}</span>
      <span className="truncate text-end">{value}</span>
    </div>
  );
}
