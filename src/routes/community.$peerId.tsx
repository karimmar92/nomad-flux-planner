import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Ban, Flag, Send } from "lucide-react";
import { toast } from "sonner";
import { APP_NAME } from "@/lib/app";
import { lastSeenLabel } from "@/lib/geoprivacy";
import { safeUrl } from "@/lib/validate";
import {
  RADAR_CITY_ID,
  getPeer,
  useBlocks,
  useConnections,
  useMyRadar,
  useReports,
  visiblePeers,
} from "@/lib/radar-store";
import {
  AVAILABILITY_LABELS,
  INTRO_NOTE_MAX,
  LOOKING_FOR_LABELS,
  REPORT_REASONS,
  REPORT_REASON_LABELS,
  type ReportReason,
} from "@/lib/radar-types";
import { EmptyState } from "@/components/Primitives";
import { Avatar, Chip, peerDistanceLabel, useNow } from "@/components/radar/RadarBits";

export const Route = createFileRoute("/community/$peerId")({
  head: () => ({
    meta: [
      { title: `Profile — collaboration radar | ${APP_NAME}` },
      {
        name: "description",
        content:
          "What they build, what they're looking for, and roughly how far away they are. Send a written intro to connect.",
      },
      { property: "og:title", content: `Profile — collaboration radar | ${APP_NAME}` },
      {
        property: "og:description",
        content: "What they build and what they're looking for.",
      },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PeerDetail,
});

function localTime(timezone: string, nowIso: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: timezone,
    }).format(new Date(nowIso));
  } catch {
    return "—";
  }
}

function PeerDetail() {
  const { peerId } = Route.useParams();
  const navigate = useNavigate();
  const nowIso = useNow();
  const { me } = useMyRadar();
  const { isBlocked, block } = useBlocks();
  const { withPeer, request } = useConnections();
  const { report } = useReports();

  const [note, setNote] = useState("");
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState<ReportReason>("harassment");
  const [detail, setDetail] = useState("");

  const peer = getPeer(peerId);
  const myCell =
    me.cell_lat !== null && me.cell_lng !== null
      ? { lat: me.cell_lat, lng: me.cell_lng }
      : null;

  const entry = useMemo(() => {
    if (!nowIso) return null;
    return (
      visiblePeers({ myCell, nowIso, cityId: RADAR_CITY_ID, isBlocked }).find(
        (e) => e.peer.id === peerId,
      ) ?? null
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nowIso, myCell?.lat, myCell?.lng, peerId]);

  const connection = withPeer(peerId);

  if (!nowIso) return null;

  if (!peer || !entry) {
    return (
      <div className="mx-auto max-w-2xl py-6">
        <EmptyState
          title="Not on the radar"
          body="This person is invisible, has gone quiet for more than a week, or you have blocked them. Either way there is nothing to show here."
          action={
            <Link to="/community" className="text-sm text-primary">
              Back to the radar
            </Link>
          }
        />
      </div>
    );
  }

  const band = peerDistanceLabel(entry, myCell);

  const sendIntro = () => {
    const trimmed = note.trim();
    if (trimmed.length < 10) {
      toast.error("Write a real intro — at least a sentence");
      return;
    }
    request(peerId, trimmed.slice(0, INTRO_NOTE_MAX));
    setNote("");
    toast.success("Intro sent. They decide whether it opens into a conversation.");
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4 py-2">
      <Link
        to="/community"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Radar
      </Link>

      <header className="flex gap-3">
        <Avatar name={peer.display_name} />
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight">{peer.display_name}</h1>
          <p className="text-sm text-foreground/90">{peer.headline}</p>
          <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
            <span>{band ?? "In this city"}</span>
            <span>{lastSeenLabel(peer.last_active_at, nowIso)}</span>
            <span>
              {peer.timezone} — {localTime(peer.timezone, nowIso)} local
            </span>
            <span>{AVAILABILITY_LABELS[peer.availability]}</span>
          </div>
        </div>
      </header>

      <section className="panel space-y-3 p-4">
        <div>
          <div className="label-xs">Looking for</div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {peer.looking_for.map((l) => (
              <Chip key={l} tone="accent">
                {LOOKING_FOR_LABELS[l]}
              </Chip>
            ))}
          </div>
        </div>
        <div>
          <div className="label-xs">Skills</div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {peer.skills.map((s) => (
              <Chip key={s}>{s}</Chip>
            ))}
          </div>
        </div>
        <div>
          <div className="label-xs">Bio</div>
          <p className="mt-1 text-sm">{peer.bio || "No bio yet."}</p>
        </div>
        {peer.links.length > 0 ? (
          <div>
            <div className="label-xs">Links</div>
            <ul className="mt-1 space-y-1 text-sm">
              {peer.links.map((l) => {
                // User-supplied URL. React escapes text but not href, so a
                // `javascript:` link would execute on click. Anything that
                // isn't http(s) renders as inert text instead.
                const href = safeUrl(l.url);
                return (
                <li key={l.url}>
                  {href ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="text-primary hover:underline"
                  >
                    {l.label}
                  </a>
                  ) : (
                    <span className="text-muted-foreground">{l.label}</span>
                  )}
                </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="panel space-y-2 p-4">
        <h2 className="text-sm font-semibold">Send intro</h2>
        {connection?.status === "accepted" ? (
          <p className="text-sm text-positive">
            Connected. Messaging opens here once threads ship.
          </p>
        ) : connection?.status === "pending" ? (
          <p className="text-sm text-muted-foreground">
            Intro sent. You&apos;ll see it here if they accept.
          </p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              A written note is required, and you can&apos;t message anyone until they
              accept. That is the whole anti-spam design.
            </p>
            <textarea
              value={note}
              maxLength={INTRO_NOTE_MAX}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Who you are and what you'd actually like to do together."
              className="w-full rounded-md border border-input bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <div className="flex items-center justify-between">
              <span className="num text-xs text-muted-foreground">
                {note.length}/{INTRO_NOTE_MAX}
              </span>
              <button type="button"
                onClick={sendIntro}
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
              >
                <Send className="me-1.5 inline h-3.5 w-3.5" />
                Send intro
              </button>
            </div>
          </>
        )}
      </section>

      <section className="flex flex-wrap gap-2">
        <button type="button"
          onClick={() => {
            block(peerId);
            toast.success("Blocked");
            navigate({ to: "/community" });
          }}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <Ban className="me-1.5 inline h-3.5 w-3.5" />
          Block
        </button>
        <button type="button"
          onClick={() => setReporting((v) => !v)}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <Flag className="me-1.5 inline h-3.5 w-3.5" />
          Report
        </button>
      </section>

      {reporting ? (
        <section className="panel space-y-2 p-4">
          <h2 className="text-sm font-semibold">Report {peer.display_name}</h2>
          <select
            aria-label="Reason"
            value={reason}
            onChange={(e) => setReason(e.target.value as ReportReason)}
            className="w-full rounded-md border border-input bg-surface px-3 py-2 text-sm"
          >
            {REPORT_REASONS.map((r) => (
              <option key={r} value={r}>
                {REPORT_REASON_LABELS[r]}
              </option>
            ))}
          </select>
          <textarea
            value={detail}
            maxLength={1000}
            rows={3}
            onChange={(e) => setDetail(e.target.value)}
            placeholder="What happened? Reviewed by a human."
            className="w-full rounded-md border border-input bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <button type="button"
            onClick={() => {
              report(peerId, reason, detail.trim());
              setReporting(false);
              setDetail("");
              toast.success("Report submitted");
            }}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
          >
            Submit report
          </button>
          <p className="text-xs text-muted-foreground">
            Reports are reviewed manually. Blocking takes effect immediately and is
            silent — they are told nothing.
          </p>
        </section>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Distances are shown as bands, never as numbers, and are computed between
        approximate areas rather than real positions.
      </p>
    </div>
  );
}
