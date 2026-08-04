import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { APP_NAME } from "@/lib/app";
import { ME_ID, getPeer, useConnections } from "@/lib/radar-store";
import { EmptyState } from "@/components/Primitives";
import { Avatar, useNow } from "@/components/radar/RadarBits";
import { lastSeenLabel } from "@/lib/geoprivacy";

export const Route = createFileRoute("/community/requests")({
  head: () => ({
    meta: [
      { title: `Intro requests | ${APP_NAME}` },
      {
        name: "description",
        content:
          "Incoming intros from people on the radar, each with a written note. Accept to open a conversation, or decline silently.",
      },
      { property: "og:title", content: `Intro requests | ${APP_NAME}` },
      {
        property: "og:description",
        content: "Incoming intros with a written note. Accept or decline.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Requests,
});

function Requests() {
  const { connections, setStatus } = useConnections();
  const nowIso = useNow();

  const incoming = connections.filter((c) => c.recipient_id === ME_ID);
  const outgoing = connections.filter((c) => c.requester_id === ME_ID);
  const pending = incoming.filter((c) => c.status === "pending");
  const accepted = incoming.filter((c) => c.status === "accepted");

  return (
    <div className="mx-auto max-w-2xl space-y-4 py-2">
      <Link
        to="/community"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Radar
      </Link>

      <header>
        <span className="label-xs">Community</span>
        <h1 className="text-2xl font-semibold tracking-tight">Intro requests</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every request carries a written note. Declining is silent — they are never
          told.
        </p>
      </header>

      {pending.length === 0 ? (
        <EmptyState
          title="No pending intros"
          body="When someone on the radar wants to work with you, their note lands here. Nobody can message you before you accept."
        />
      ) : (
        <div className="space-y-2">
          {pending.map((c) => {
            const peer = getPeer(c.requester_id);
            return (
              <div key={c.id} className="panel space-y-3 p-3">
                <div className="flex gap-3">
                  <Avatar name={peer?.display_name ?? "Unknown"} />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">
                      {peer?.display_name ?? "Unknown"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {peer?.headline}
                      {peer && nowIso
                        ? ` — ${lastSeenLabel(peer.last_active_at, nowIso)}`
                        : ""}
                    </div>
                  </div>
                </div>
                <p className="rounded-md bg-surface-2 p-3 text-sm">{c.intro_note}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setStatus(c.id, "accepted");
                      toast.success("Accepted");
                    }}
                    className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => setStatus(c.id, "declined")}
                    className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
                  >
                    Decline
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {accepted.length + outgoing.length > 0 ? (
        <section className="panel space-y-2 p-4">
          <h2 className="text-sm font-semibold">Elsewhere</h2>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {accepted.map((c) => (
              <li key={c.id}>
                Connected with {getPeer(c.requester_id)?.display_name ?? "someone"}
              </li>
            ))}
            {outgoing.map((c) => (
              <li key={c.id}>
                Intro to {getPeer(c.recipient_id)?.display_name ?? "someone"} —{" "}
                {c.status}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
