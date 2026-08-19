/**
 * Guided trip entry — one question per screen.
 *
 * WHY THIS REPLACES A PERFECTLY WORKING FORM. The old AddTrip put a country
 * dropdown, two date inputs, a checkbox and a purpose select on one row. Every
 * field was answerable, and the whole thing was still intimidating, because it
 * asked the user to hold four decisions at once and one of them ("purpose")
 * used vocabulary they had no way to map onto their own life.
 *
 * The Taxfix pattern is not "the same form, split up". It is:
 *
 *   1. ONE decision on screen. Nothing else is visible to weigh against it.
 *   2. The question is in the words the person would use, not the words the
 *      data model uses. The field is called `purpose`; the question is "What
 *      let you stay?", because that is the thing they actually know.
 *   3. Every option carries a concrete example. "Nomad visa" is jargon.
 *      "A visa you applied for, like Portugal's D8" is recognisable.
 *   4. The common answer is reachable in one tap. Most trips are recent and
 *      most people are tourists, so "Today", "Yesterday" and "Tourist" are
 *      chips rather than pickers.
 *   5. Going back is free and always visible. Fear of committing to a wrong
 *      answer is what makes people abandon forms.
 *
 * WHY THE PURPOSE QUESTION IS NOT OPTIONAL AND NOT DEFAULTED SILENTLY. It is
 * the one answer that changes the Schengen maths: days on a national long-stay
 * visa or residence permit do not consume the 90/180 allowance, days as a
 * visitor do. Getting it wrong in one direction wastes weeks of somebody's
 * allowance; in the other it produces an overstay, which under EES is now
 * flagged automatically and kept on file for five years. So it is asked
 * explicitly, in plain language, with examples.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO. No animated transitions between steps.
 * They look considered in a demo and cost real time on every entry once you
 * have logged your fifth trip. The quick-entry form exists for exactly that
 * person and is one tap away at all times.
 */
import { useState } from "react";
import { ArrowLeft, Check } from "lucide-react";
import { CITIES } from "@/lib/cities";
import { flagEmoji } from "@/lib/arbitrage";
import { todayIso, addDaysIso } from "@/lib/trip-dates";
import { SCHENGEN_COUNTRIES } from "@/lib/schengen";
import type { Trip, TripPurpose } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Countries offered as tiles, before the full list. */
const COUNTRY_OPTIONS = Array.from(
  new Set([...CITIES.map((c) => c.country_code), "ES", "FR", "IT", "DE", "MY", "MU", "AE", "ID"]),
).sort();

/**
 * Passports offered as one-tap tiles.
 *
 * Chosen as the ones most likely among people who need a 90/180 counter at
 * all, plus the two big free-movement cases so those users are recognised
 * immediately rather than hunting through a list.
 */
const COMMON_PASSPORTS = ["US", "GB", "CA", "AU", "DE", "NL", "IE", "ZA", "NZ", "IN"];

function countryName(code: string): string {
  return CITIES.find((c) => c.country_code === code)?.country ?? code;
}

type Step = "passport" | "country" | "arrived" | "left" | "purpose" | "confirm";

const PURPOSES: { value: TripPurpose; label: string; example: string }[] = [
  {
    value: "tourist",
    label: "I just turned up",
    example:
      "Visa-free, or a short-stay visitor visa. This is most trips. In Europe these days count toward your 90.",
  },
  {
    value: "nomad_visa",
    label: "A visa I applied for",
    example:
      "A national long-stay visa, like Portugal's D8 or Spain's digital nomad visa. In Europe these days do not count toward your 90.",
  },
  {
    value: "residence",
    label: "I live there",
    example:
      "A residence permit or citizenship. These days do not count toward a short-stay allowance.",
  },
];

export function GuidedTripFlow({
  passport,
  onSetPassport,
  onAdd,
  onSwitchToQuick,
}: {
  /** Stored passport, or null when it has never been asked. */
  passport: string | null;
  onSetPassport: (code: string) => void;
  onAdd: (trip: Trip) => void;
  onSwitchToQuick: () => void;
}) {
  // Skip the passport question once it is known. Asking a returning user for
  // their nationality on every trip is the kind of thing that makes people
  // stop logging trips.
  const [step, setStep] = useState<Step>(passport ? "country" : "passport");
  const [country, setCountry] = useState<string | null>(null);
  const [entry, setEntry] = useState<string | null>(todayIso());
  const [exit, setExit] = useState<string | null>(null);
  const [stillThere, setStillThere] = useState(false);
  const [purpose, setPurpose] = useState<TripPurpose | null>(null);
  const [showAllCountries, setShowAllCountries] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const order: Step[] = passport
    ? ["country", "arrived", "left", "purpose", "confirm"]
    : ["passport", "country", "arrived", "left", "purpose", "confirm"];
  const index = order.indexOf(step);

  function back() {
    setError(null);
    if (index > 0) setStep(order[index - 1]!);
  }

  function reset() {
    setCountry(null);
    setEntry(todayIso());
    setExit(null);
    setStillThere(false);
    setPurpose(null);
    setShowAllCountries(false);
    setError(null);
    setStep("country");
  }

  function save() {
    if (!country || !entry || !purpose) return;
    if (!stillThere && !exit) {
      setError("Pick the day you left, or say you are still there.");
      return;
    }
    if (!stillThere && exit && exit < entry) {
      setError("That is before the day you arrived.");
      return;
    }
    onAdd({
      id: crypto.randomUUID(),
      country_code: country,
      city_id: CITIES.find((c) => c.country_code === country)?.id ?? null,
      entry_date: entry,
      exit_date: stillThere ? null : exit,
      purpose,
      notes: "",
      created_at: new Date().toISOString(),
    });
    reset();
  }

  return (
    <section className="panel p-5 sm:p-7">
      {/* Progress. Dots rather than a percentage: a percentage invites the
          question "how long is this going to take", a short row of dots
          answers it at a glance. */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5" role="presentation">
          {order.map((s, i) => (
            <span
              key={s}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i < index && "w-6 bg-primary/40",
                i === index && "w-6 bg-primary",
                i > index && "w-1.5 bg-border",
              )}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={onSwitchToQuick}
          className="text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          Quick entry
        </button>
      </div>

      {index > 0 ? (
        <button
          type="button"
          onClick={back}
          className="mt-5 -ml-1 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back
        </button>
      ) : null}

      <div className="mt-4 min-h-[19rem]">
        {step === "passport" ? (
          <Question
            title="Which passport do you travel on?"
            hint="This decides which rules apply to you at all. EU, EEA and Swiss citizens have free movement and no 90-day limit in Europe."
          >
            <Tiles>
              {COMMON_PASSPORTS.map((code) => (
                <Tile
                  key={code}
                  onClick={() => {
                    onSetPassport(code);
                    setStep("country");
                  }}
                >
                  <span aria-hidden>{flagEmoji(code)}</span>
                  <span>{code}</span>
                </Tile>
              ))}
            </Tiles>
            <Native
              label="Another passport"
              value=""
              onChange={(v) => {
                if (!v) return;
                onSetPassport(v);
                setStep("country");
              }}
              options={COUNTRY_OPTIONS}
            />
          </Question>
        ) : null}

        {step === "country" ? (
          <Question
            title="Where did you go?"
            hint="One country per trip. Add another for the next leg."
          >
            <Tiles>
              {(showAllCountries ? COUNTRY_OPTIONS : COUNTRY_OPTIONS.slice(0, 11)).map((code) => (
                <Tile
                  key={code}
                  selected={country === code}
                  onClick={() => {
                    setCountry(code);
                    setStep("arrived");
                  }}
                >
                  <span aria-hidden>{flagEmoji(code)}</span>
                  <span className="truncate">{countryName(code)}</span>
                </Tile>
              ))}
              {!showAllCountries ? (
                <Tile onClick={() => setShowAllCountries(true)}>
                  <span aria-hidden>…</span>
                  <span>More</span>
                </Tile>
              ) : null}
            </Tiles>
          </Question>
        ) : null}

        {step === "arrived" ? (
          <Question
            title={`When did you arrive in ${countryName(country ?? "")}?`}
            hint="The day you landed counts as a full day, even if you arrived at midnight."
          >
            <div className="flex flex-wrap gap-2">
              <Chip
                onClick={() => {
                  setEntry(todayIso());
                  setStep("left");
                }}
              >
                Today
              </Chip>
              <Chip
                onClick={() => {
                  setEntry(addDaysIso(todayIso(), -1));
                  setStep("left");
                }}
              >
                Yesterday
              </Chip>
            </div>
            <DateField
              label="Or pick the date"
              value={entry ?? ""}
              max={todayIso()}
              onChange={(v) => setEntry(v)}
            />
            <Primary disabled={!entry} onClick={() => setStep("left")}>
              Continue
            </Primary>
          </Question>
        ) : null}

        {step === "left" ? (
          <Question title="Have you left yet?" hint="The day you leave also counts as a full day.">
            <Tiles>
              <Tile
                onClick={() => {
                  setStillThere(true);
                  setExit(null);
                  setStep("purpose");
                }}
                selected={stillThere}
              >
                <span aria-hidden>📍</span>
                <span>Still there</span>
              </Tile>
              <Tile
                onClick={() => {
                  setStillThere(false);
                  setExit((e) => e ?? todayIso());
                }}
                selected={!stillThere && exit !== null}
              >
                <span aria-hidden>✈️</span>
                <span>I have left</span>
              </Tile>
            </Tiles>
            {!stillThere && exit !== null ? (
              <>
                <DateField
                  label="The day you left"
                  value={exit}
                  min={entry ?? undefined}
                  max={todayIso()}
                  onChange={(v) => {
                    setExit(v);
                    setError(null);
                  }}
                />
                <Primary disabled={!exit} onClick={() => setStep("purpose")}>
                  Continue
                </Primary>
              </>
            ) : null}
          </Question>
        ) : null}

        {step === "purpose" ? (
          <Question
            title="What let you stay?"
            hint="This changes the maths. Days on a visa you applied for are counted separately from days as a visitor."
          >
            <div className="space-y-2.5">
              {PURPOSES.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => {
                    setPurpose(p.value);
                    setStep("confirm");
                  }}
                  className={cn(
                    "w-full rounded-xl border p-4 text-left transition-colors",
                    purpose === p.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50 hover:bg-surface-2",
                  )}
                >
                  <span className="block text-sm font-medium">{p.label}</span>
                  <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                    {p.example}
                  </span>
                </button>
              ))}
            </div>
          </Question>
        ) : null}

        {step === "confirm" ? (
          <Question title="Does this look right?" hint="You can change any of it afterwards.">
            <dl className="divide-y divide-border rounded-xl border border-border">
              <Summary
                label="Country"
                value={`${flagEmoji(country ?? "")} ${countryName(country ?? "")}`}
              />
              <Summary label="Arrived" value={entry ?? ""} />
              <Summary label="Left" value={stillThere ? "Still there" : (exit ?? "")} />
              <Summary
                label="Status"
                value={PURPOSES.find((p) => p.value === purpose)?.label ?? ""}
              />
            </dl>

            {country && SCHENGEN_COUNTRIES.has(country) && purpose !== "tourist" ? (
              <p className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                These days will not count toward your Schengen 90. If you were actually there
                visa-free, go back and pick “I just turned up”, or the count will be too low.
              </p>
            ) : null}

            {error ? (
              <p
                role="alert"
                className="rounded-lg border border-negative/50 bg-negative-muted px-3 py-2 text-xs text-negative"
              >
                {error}
              </p>
            ) : null}

            <Primary onClick={save}>
              <Check className="h-4 w-4" aria-hidden />
              Save this trip
            </Primary>
          </Question>
        ) : null}
      </div>
    </section>
  );
}

/* ── Presentational pieces ──────────────────────────────────────────────
   Kept in this file rather than shared. They encode the decisions above
   (48px targets, one question per screen) and exporting them would invite
   reuse in contexts where those decisions do not apply. */

function Question({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-balance">{title}</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground text-pretty">{hint}</p>
      </div>
      {children}
    </div>
  );
}

function Tiles({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{children}</div>;
}

function Tile({
  children,
  onClick,
  selected = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  selected?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        // min-h-12 is the accessible tap target, not a style preference.
        "flex min-h-12 items-center gap-2 rounded-xl border px-3 py-3 text-sm font-medium transition-colors",
        selected
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/50 hover:bg-surface-2",
      )}
    >
      {children}
    </button>
  );
}

function Chip({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-11 rounded-full border border-border px-4 text-sm font-medium transition-colors hover:border-primary/50 hover:bg-surface-2"
    >
      {children}
    </button>
  );
}

function DateField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: string;
  min?: string | undefined;
  max?: string | undefined;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="label-xs">{label}</span>
      <input
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 min-h-12 w-full rounded-xl border border-input bg-surface px-3 text-sm"
      />
    </label>
  );
}

function Native({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <label className="block">
      <span className="label-xs">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 min-h-12 w-full rounded-xl border border-input bg-surface px-3 text-sm"
      >
        <option value="">Choose…</option>
        {options.map((code) => (
          <option key={code} value={code}>
            {flagEmoji(code)} {countryName(code)}
          </option>
        ))}
      </select>
    </label>
  );
}

function Primary({
  children,
  onClick,
  disabled = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition-opacity disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
