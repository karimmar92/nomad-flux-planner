/**
 * The landing page's central argument, made executable.
 *
 * One trip, entered once, evaluated against four different rules — and the four
 * answers genuinely differ, because the counting conventions contradict each
 * other. Schengen counts your arrival day; FEIE does not. That contradiction is
 * the product, and asserting it in copy is far weaker than letting someone
 * watch it happen to their own dates.
 *
 * It runs the real engines from src/lib/rules, never a marketing approximation.
 * A landing page that disagrees with the app is a lie discovered on day one.
 */
import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, Info } from "lucide-react";
import { evaluateAll, type RuleId, type RuleResult } from "@/lib/rules";
import { addDaysIso, todayIso } from "@/lib/trip-dates";
import { useTrips } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { Trip } from "@/lib/types";

/** Presets chosen so each one makes a different rule the interesting one. */
const PLACES = [
  { code: "PT", label: "Portugal", hint: "Schengen" },
  { code: "GB", label: "UK", hint: "SRT" },
  { code: "TH", label: "Thailand", hint: "183-day" },
  { code: "VN", label: "Vietnam", hint: "183-day" },
];

export function RuleCalculator({
  only,
  initialCountry,
}: {
  /** Show a single rule (used by the per-rule SEO pages). */
  only?: RuleId;
  initialCountry?: string;
} = {}) {
  const navigate = useNavigate();
  const { trips, setTrips } = useTrips();
  const today = useMemo(() => todayIso(), []);

  const [country, setCountry] = useState(initialCountry ?? "PT");
  const [entry, setEntry] = useState(() => addDaysIso(todayIso(), -120));
  const [stillHere, setStillHere] = useState(true);
  const [exit, setExit] = useState(() => todayIso());
  const [open, setOpen] = useState<string | null>(only ?? "schengen");

  const probe: Trip[] = useMemo(
    () => [
      {
        id: "hero-probe",
        country_code: country,
        city_id: null,
        entry_date: entry,
        exit_date: stillHere ? null : exit,
        purpose: "tourist",
        notes: "",
      },
    ],
    [country, entry, exit, stillHere],
  );

  const results = useMemo(() => {
    if (!entry || entry > today) return [];
    const all = evaluateAll({
      trips: probe,
      today,
      homeCountry: "US",
      ukTies: 2,
      ukResidentRecently: true,
    });
    return only ? all.filter((r) => r.id === only) : all;
  }, [probe, today, entry, only]);

  const save = () => {
    setTrips([...trips, { ...probe[0]!, id: crypto.randomUUID() }]);
    void navigate({ to: "/tracker" });
  };

  return (
    <div className="panel overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <span className="label-xs">
          {only ? "Try it with your dates · no account" : "One trip · four rules · no account"}
        </span>
      </div>

      <div className="space-y-4 p-4">
        <div className="flex flex-wrap gap-1.5">
          {PLACES.map((p) => (
            <button
              type="button"
              key={p.code}
              onClick={() => setCountry(p.code)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs",
                country === p.code
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="label-xs">I arrived on</span>
            <input
              type="date"
              value={entry}
              max={today}
              onChange={(e) => setEntry(e.target.value)}
              className="num mt-1 w-full rounded-md border border-input bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>
          <label className="block">
            <span className="label-xs">and left on</span>
            <input
              type="date"
              value={stillHere ? today : exit}
              min={entry}
              max={today}
              disabled={stillHere}
              onChange={(e) => setExit(e.target.value)}
              className="num mt-1 w-full rounded-md border border-input bg-surface px-3 py-2 text-sm outline-none focus:border-primary disabled:opacity-50"
            />
            <span className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={stillHere}
                onChange={(e) => setStillHere(e.target.checked)}
              />
              I&apos;m still here
            </span>
          </label>
        </div>

        {results.length > 0 ? (
          <ul className="space-y-1.5">
            {results.map((r) => (
              <RuleRow
                key={r.id}
                result={r}
                open={open === r.id}
                onToggle={() => setOpen(open === r.id ? null : r.id)}
              />
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">Pick an arrival date to see all four.</p>
        )}

        <button
          type="button"
          onClick={save}
          className="flex w-full items-center justify-center gap-1.5 rounded-md bg-primary py-2.5 text-sm font-medium text-primary-foreground"
        >
          {only ? "Save this trip and track it" : "Save this trip and track all four"}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </button>
        <p className="text-center text-[11px] text-muted-foreground">
          Saves to this device. No account, no email.
        </p>
      </div>
    </div>
  );
}

function RuleRow({
  result,
  open,
  onToggle,
}: {
  result: RuleResult;
  open: boolean;
  onToggle: () => void;
}) {
  const tone =
    result.status === "exceeded"
      ? result.higherIsBetter
        ? "text-accent-warning"
        : "text-negative"
      : result.status === "watch" || result.status === "at_limit"
        ? "text-accent-warning"
        : result.status === "insufficient_data"
          ? "text-muted-foreground"
          : "text-positive";

  const pct = result.threshold > 0 ? Math.min(100, (result.value / result.threshold) * 100) : 0;

  return (
    <li className="rounded-md border border-border">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-start"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-medium">{result.label}</span>
          <span className="mt-1 block h-1 w-full overflow-hidden rounded-full bg-surface-2">
            <span
              className={cn(
                "block h-full rounded-full transition-[width] duration-200 ease-out",
                result.status === "ok" ? "bg-positive" : "bg-accent-warning",
                result.status === "exceeded" && !result.higherIsBetter && "bg-negative",
              )}
              style={{ width: `${pct}%` }}
            />
          </span>
        </span>
        <span className={cn("num shrink-0 text-lg font-semibold", tone)}>
          {result.value}
          <span className="text-xs font-normal text-muted-foreground">/{result.threshold}</span>
        </span>
      </button>

      {open ? (
        <div className="space-y-1.5 border-t border-border px-3 py-2.5">
          <p className="text-xs">{result.headline}</p>
          <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
            <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
            <span>{result.convention}</span>
          </p>
          {result.detail ? (
            <p className="text-[11px] text-muted-foreground">{result.detail}</p>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
