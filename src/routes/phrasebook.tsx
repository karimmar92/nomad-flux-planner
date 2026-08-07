/**
 * Situation phrasebook.
 *
 * Deliberately NOT a translator — see the header of src/lib/phrasebook/types.ts
 * for why a fixed, human-verified list is the only honest thing to put in front
 * of someone at an immigration counter.
 *
 * Free, not Pro. Someone whose passport was just stolen is the same person the
 * emergency border-run unlock exists for.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Languages, Maximize2, Volume2, X } from "lucide-react";
import { APP_NAME } from "@/lib/app";
import { PHRASEBOOKS, phrasebookFor } from "@/lib/phrasebook/data";
import {
  SITUATIONS,
  situationsWithContent,
  usablePhrases,
  verificationOf,
  type Phrase,
  type SituationId,
} from "@/lib/phrasebook/types";
import { speak, stopSpeaking, voiceSupport, whenVoicesReady } from "@/lib/phrasebook/speech";
import { useTrips } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/phrasebook")({
  head: () => ({
    meta: [
      { title: `Situation phrasebook | ${APP_NAME}` },
      {
        name: "description",
        content:
          "The sentences that matter at an immigration counter, a visa office or a police station — offline, spoken aloud, and checked by a person rather than generated.",
      },
    ],
  }),
  component: Phrasebook,
});

function Phrasebook() {
  const { trips } = useTrips();

  // Default to where they actually are: the most recent trip with no exit date.
  const currentCountry = useMemo(() => {
    const open = [...trips]
      .filter((t) => !t.exit_date)
      .sort((a, b) => (a.entry_date < b.entry_date ? 1 : -1))[0];
    return open && phrasebookFor(open.country_code) ? open.country_code.toUpperCase() : "VN";
  }, [trips]);

  const [code, setCode] = useState(currentCountry);
  const [situation, setSituation] = useState<SituationId | "all">("all");
  const [fullscreen, setFullscreen] = useState<Phrase | null>(null);
  const [voicesLoaded, setVoicesLoaded] = useState(false);

  const locale = phrasebookFor(code) ?? PHRASEBOOKS[0]!;
  const verified = verificationOf(locale) === "verified";
  const available = situationsWithContent(locale);
  const phrases = usablePhrases(locale, situation === "all" ? undefined : situation);

  useEffect(() => {
    void whenVoicesReady().then(() => setVoicesLoaded(true));
    return () => stopSpeaking();
  }, []);

  const support = voicesLoaded ? voiceSupport(locale.bcp47) : "unsupported";

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <Languages className="h-5 w-5 text-primary" aria-hidden />
          Situation phrasebook
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Not a translator. A short list of the sentences that are expensive to get wrong, checked
          by a person, stored on your device and readable with no signal. Tap a phrase to show it
          full-screen to whoever you are talking to.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {PHRASEBOOKS.map((p) => (
          <button
            key={p.countryCode}
            onClick={() => setCode(p.countryCode)}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm",
              code === p.countryCode
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {p.country}
          </button>
        ))}
      </div>

      {/* The honesty gate. An unchecked phrase list is still useful, but
          claiming it is verified when nobody has checked it would destroy the
          only advantage this has over a translator. */}
      {!verified ? (
        <div className="flex items-start gap-2.5 rounded-md border border-accent-warning/50 bg-accent-warning/5 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-accent-warning" aria-hidden />
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-accent-warning">Draft — not yet checked.</span> These{" "}
            {locale.languageName} phrases are awaiting review by a native speaker. Treat them as a
            starting point, not as authoritative, and do not rely on them for anything legal.
          </p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          {locale.languageName} phrases checked by {locale.verifiedBy} on {locale.verifiedOn}.
        </p>
      )}

      <div className="flex flex-wrap gap-1.5">
        <Chip active={situation === "all"} onClick={() => setSituation("all")}>
          All
        </Chip>
        {available.map((s) => (
          <Chip key={s.id} active={situation === s.id} onClick={() => setSituation(s.id)}>
            {s.label}
          </Chip>
        ))}
      </div>

      {situation !== "all" ? (
        <p className="text-xs text-muted-foreground">
          {SITUATIONS.find((s) => s.id === situation)?.context}
        </p>
      ) : null}

      {support === "no_voice" ? (
        <p className="text-xs text-muted-foreground">
          Your device has no {locale.languageName} voice installed, so the speak button is off —
          reading it aloud with the wrong voice would be worse than showing the text. Install the
          language in your phone&apos;s settings to enable it.
        </p>
      ) : null}

      <ul className="space-y-2">
        {phrases.map((p) => (
          <li key={p.id} className="panel p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{p.en}</p>
                <p className="mt-1 text-lg font-medium leading-snug">{p.target}</p>
                {p.pronunciation ? (
                  <p className="mt-0.5 text-xs italic text-muted-foreground">{p.pronunciation}</p>
                ) : null}
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  onClick={() => speak(p.target, locale.bcp47)}
                  disabled={support !== "ready"}
                  aria-label="Speak this phrase"
                  className="grid h-9 w-9 place-items-center rounded-md border border-border text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-40"
                >
                  <Volume2 className="h-4 w-4" aria-hidden />
                </button>
                <button
                  onClick={() => setFullscreen(p)}
                  aria-label="Show full screen"
                  className="grid h-9 w-9 place-items-center rounded-md border border-border text-muted-foreground hover:border-primary hover:text-primary"
                >
                  <Maximize2 className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </div>

            {p.likelyReplies?.length ? (
              <div className="mt-3 rounded-md bg-surface p-2.5">
                <div className="label-xs">You may hear</div>
                <ul className="mt-1 space-y-0.5 text-xs">
                  {p.likelyReplies.map((r) => (
                    <li key={r.target}>
                      <span className="font-medium">{r.target}</span>{" "}
                      <span className="text-muted-foreground">— {r.en}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {p.note ? <p className="mt-2 text-xs text-muted-foreground">{p.note}</p> : null}
          </li>
        ))}
      </ul>

      {fullscreen ? (
        <ShowToScreen phrase={fullscreen} onClose={() => setFullscreen(null)} />
      ) : null}
    </div>
  );
}

/**
 * Show-to-screen: the phrase, huge, for handing the phone across a counter.
 * The English is small and secondary — the reader is the other person now.
 */
function ShowToScreen({ phrase, onClose }: { phrase: Phrase; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background p-6"
    >
      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute end-4 top-4 grid h-10 w-10 place-items-center rounded-md border border-border text-muted-foreground"
      >
        <X className="h-5 w-5" aria-hidden />
      </button>
      <p className="text-center text-3xl font-semibold leading-snug sm:text-4xl">
        {phrase.target}
      </p>
      {phrase.pronunciation ? (
        <p className="mt-3 text-center text-base italic text-muted-foreground">
          {phrase.pronunciation}
        </p>
      ) : null}
      <p className="mt-6 max-w-md text-center text-sm text-muted-foreground">{phrase.en}</p>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
