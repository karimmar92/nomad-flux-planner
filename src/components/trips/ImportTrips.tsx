/**
 * Bulk trip import UI.
 *
 * Parse → preview → confirm. The preview is not politeness: these numbers feed
 * a compliance calculation, and a silently misread date produces a confident
 * wrong answer, which is worse than no answer.
 */
import { useMemo, useState } from "react";
import { AlertTriangle, ClipboardPaste, Check } from "lucide-react";
import {
  findDuplicates,
  findOverlaps,
  parseTripText,
  type ParsedRow,
} from "@/lib/trips/import-parse";
import { useTrips } from "@/lib/store";
import { cn } from "@/lib/utils";

const EXAMPLE = `Portugal, 2026-01-10, 2026-03-15
Thailand, 14/01/2026, 02/02/2026
Spain, 2026-05-01, still here`;

export function ImportTrips({ onDone }: { onDone?: (added: number) => void }) {
  const { trips, setTrips } = useTrips();
  const [text, setText] = useState("");
  const [skip, setSkip] = useState<Set<number>>(new Set());
  const [done, setDone] = useState<number | null>(null);

  const parsed = useMemo(() => (text.trim() ? parseTripText(text) : null), [text]);
  const duplicates = useMemo(
    () => (parsed ? findDuplicates(parsed.rows, trips) : new Set<number>()),
    [parsed, trips],
  );
  const overlaps = useMemo(
    () => (parsed ? findOverlaps(parsed.rows) : new Set<number>()),
    [parsed],
  );

  // Duplicates are excluded by default. Importing them again would double
  // every day count for that country, which is the single worst outcome here.
  const effectiveSkip = useMemo(() => {
    const s = new Set(skip);
    for (const line of duplicates) s.add(line);
    return s;
  }, [skip, duplicates]);

  const toImport = parsed?.rows.filter((r) => !effectiveSkip.has(r.line)) ?? [];

  const commit = () => {
    // ONE write, not a loop of addTrip. addTrip closes over the trips array as
    // it was when the callback was created, so calling it N times in a row
    // would save only the last trip and silently discard the rest — the exact
    // failure an import must never have.
    const created = toImport.map((row) => ({
      id: crypto.randomUUID(),
      country_code: row.country_code,
      city_id: null,
      entry_date: row.entry_date,
      exit_date: row.exit_date,
      purpose: row.purpose,
      notes: "",
    }));
    setTrips([...trips, ...created]);
    setDone(created.length);
    setText("");
    setSkip(new Set());
    onDone?.(toImport.length);
  };

  if (done !== null) {
    return (
      <div className="panel flex items-start gap-2.5 p-4">
        <Check className="mt-0.5 h-4 w-4 shrink-0 text-positive" aria-hidden />
        <div>
          <p className="text-sm font-medium">
            {done} {done === 1 ? "trip" : "trips"} imported.
          </p>
          <button type="button"
            onClick={() => setDone(null)}
            className="mt-1 text-xs text-primary underline-offset-2 hover:underline"
          >
            Import more
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="panel space-y-3 p-4">
      <div className="flex items-start gap-2.5">
        <ClipboardPaste className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
        <div>
          <h2 className="text-sm font-semibold">Import your travel history</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            One trip per line: country, entry date, exit date. Dates in almost any format, and
            &ldquo;still here&rdquo; for a stay that has not ended. Nothing is saved until you
            confirm the preview.
          </p>
        </div>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        placeholder={EXAMPLE}
        className="w-full rounded-md border border-input bg-surface px-3 py-2 font-mono text-xs outline-none focus:border-primary"
      />

      {parsed ? (
        <>
          {parsed.failures.length > 0 ? (
            <div className="rounded-md border border-accent-warning/50 bg-accent-warning/5 p-3">
              <p className="flex items-center gap-1.5 text-xs font-medium text-accent-warning">
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                {parsed.failures.length} {parsed.failures.length === 1 ? "line" : "lines"} could
                not be read — fix or remove them
              </p>
              <ul className="mt-1.5 space-y-1 text-xs text-muted-foreground">
                {parsed.failures.map((f) => (
                  <li key={f.line}>
                    <span className="num">Line {f.line}:</span> {f.reason}{" "}
                    <span className="opacity-70">“{f.raw}”</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {parsed.ambiguousDates ? (
            <p className="text-xs text-accent-warning">
              Some dates could be read day-first or month-first and were read as day-first
              (14/03 = 14 March). Check those rows, or paste them as 2026-03-14 to be certain.
            </p>
          ) : null}

          {parsed.rows.length > 0 ? (
            <div className="overflow-hidden rounded-md border border-border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-start">
                    <th className="px-3 py-2 text-start font-medium">Import</th>
                    <th className="px-3 py-2 text-start font-medium">Country</th>
                    <th className="px-3 py-2 text-start font-medium">Entry</th>
                    <th className="px-3 py-2 text-start font-medium">Exit</th>
                    <th className="px-3 py-2 text-start font-medium">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.rows.map((row) => (
                    <PreviewRow
                      key={row.line}
                      row={row}
                      duplicate={duplicates.has(row.line)}
                      overlapping={overlaps.has(row.line)}
                      checked={!effectiveSkip.has(row.line)}
                      onToggle={() =>
                        setSkip((s) => {
                          const next = new Set(s);
                          if (next.has(row.line)) next.delete(row.line);
                          else next.add(row.line);
                          return next;
                        })
                      }
                    />
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          <button type="button"
            onClick={commit}
            disabled={toImport.length === 0}
            className="w-full rounded-md bg-primary py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {toImport.length === 0
              ? "Nothing to import"
              : `Import ${toImport.length} ${toImport.length === 1 ? "trip" : "trips"}`}
          </button>
        </>
      ) : null}
    </div>
  );
}

function PreviewRow({
  row,
  duplicate,
  overlapping,
  checked,
  onToggle,
}: {
  row: ParsedRow;
  duplicate: boolean;
  overlapping: boolean;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <tr className={cn("border-b border-border/60 last:border-0", !checked && "opacity-50")}>
      <td className="px-3 py-2">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          aria-label={`Import ${row.country} ${row.entry_date}`}
        />
      </td>
      <td className="px-3 py-2">{row.country}</td>
      <td className="num px-3 py-2">{row.entry_date}</td>
      <td className="num px-3 py-2">{row.exit_date ?? "still there"}</td>
      <td className="px-3 py-2 text-muted-foreground">
        {duplicate ? "Already logged — skipped" : null}
        {overlapping ? "Overlaps another trip" : null}
        {row.warnings.join(" ")}
      </td>
    </tr>
  );
}
