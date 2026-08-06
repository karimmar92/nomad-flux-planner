/**
 * Emergency pack.
 *
 * The screen you open when something has gone wrong abroad. Everything here
 * renders from cache — no network call, no server round-trip — because the
 * state you are in when you need it is: foreign country, no roaming, possibly
 * a borrowed phone.
 *
 * FREE, deliberately and permanently. Charging for emergency information is
 * indefensible, and "the app wanted €9 before showing me the embassy number"
 * is a story that ends a product.
 *
 * NO PARTNER LINKS ON THIS SCREEN. Selling insurance to someone who opened
 * the app because they are already in trouble is the clearest violation of
 * the partner rules in src/config/partners.ts. The one factual insurance
 * mention lives inside the medical playbook, phrased as a policy check.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronDown, Lock, Phone, ShieldAlert } from "lucide-react";
import { APP_NAME } from "@/lib/app";
import { LegalFooter } from "@/components/LegalFooter";
import { PLAYBOOKS } from "@/lib/emergency/playbooks";
import {
  HEALTH_FIELDS,
  hasAnyDetails,
  useEmergencyDetails,
  type EmergencyDetails,
} from "@/lib/emergency/store";
import {
  COUNTRY_EMERGENCY,
  EMERGENCY_VERIFIED,
  emergencyFor,
} from "@/lib/emergency/countries";
import { useTrips } from "@/lib/store";
import { todayIso } from "@/lib/trip-dates";

export const Route = createFileRoute("/emergency")({
  head: () => ({
    meta: [
      { title: `Emergency | ${APP_NAME}` },
      {
        name: "description",
        content:
          "Your insurance and emergency contacts, plus what to do if your passport is stolen, you are hospitalised, robbed or detained. Works offline.",
      },
    ],
  }),
  component: EmergencyPage,
});

type FieldDef = {
  key: keyof EmergencyDetails;
  label: string;
  hint?: string;
  type?: string;
};

const CONTACT_FIELDS: FieldDef[] = [
  { key: "insuranceProvider", label: "Insurance provider" },
  { key: "insurancePolicy", label: "Policy number" },
  {
    key: "insuranceEmergencyPhone",
    label: "Insurer 24h emergency line",
    hint: "Not customer service — the assistance line. People reach for the wrong one under stress.",
    type: "tel",
  },
  { key: "contactName", label: "Emergency contact" },
  { key: "contactPhone", label: "Their number", hint: "Include the country code.", type: "tel" },
  { key: "passportNumber", label: "Passport number" },
  { key: "passportExpiry", label: "Passport expiry", type: "date" },
];

const MEDICAL_FIELDS: FieldDef[] = [
  { key: "bloodType", label: "Blood type" },
  { key: "allergies", label: "Allergies" },
  { key: "medication", label: "Current medication" },
];

function EmergencyPage() {
  const { details, patch, hydrated } = useEmergencyDetails();
  const [editing, setEditing] = useState(false);
  const { trips } = useTrips();

  // Default to wherever the user currently is, so the right numbers are
  // already on screen when they open this. Overridable — people check ahead.
  const [country, setCountry] = useState(() => {
    const today = todayIso();
    const open = trips.find(
      (t) => t.entry_date <= today && (t.exit_date === null || t.exit_date >= today),
    );
    return open?.country_code ?? COUNTRY_EMERGENCY[0]?.countryCode ?? "PT";
  });

  const local = emergencyFor(country);
  const filled = hasAnyDetails(details);

  return (
    <div className="space-y-4 pb-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Emergency</h1>
        <p className="text-sm text-muted-foreground">
          Everything on this page works with no signal. Fill it in before you need it.
        </p>
      </div>

      <section className="panel p-4">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-sm font-semibold">Your details</h2>
          <button
            onClick={() => setEditing((v) => !v)}
            className="rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-surface-2"
          >
            {editing ? "Done" : filled ? "Edit" : "Add"}
          </button>
        </div>

        {!hydrated ? null : editing ? (
          <div className="mt-3 space-y-3">
            {CONTACT_FIELDS.map((f) => (
              <Field key={f.key} def={f} value={details[f.key]} onChange={patch} />
            ))}

            <div className="rounded-md border border-border bg-surface-2 p-3">
              <p className="flex items-center gap-1.5 text-xs font-medium">
                <Lock className="h-3.5 w-3.5 text-primary" aria-hidden />
                Stored on this device only
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Health information is never sent to our servers, never included
                in sync, and never leaves this device. It stays available
                offline, which is the only place it is useful.
              </p>
              <div className="mt-3 space-y-3">
                {MEDICAL_FIELDS.map((f) => (
                  <Field key={f.key} def={f} value={details[f.key]} onChange={patch} />
                ))}
              </div>
            </div>
          </div>
        ) : filled ? (
          <dl className="mt-3 space-y-2 text-sm">
            {[...CONTACT_FIELDS, ...MEDICAL_FIELDS]
              .filter((f) => details[f.key].trim() !== "")
              .map((f) => (
                <div key={f.key} className="flex items-baseline justify-between gap-3">
                  <dt className="shrink-0 text-xs text-muted-foreground">
                    {f.label}
                    {HEALTH_FIELDS.includes(f.key) ? (
                      <Lock className="ms-1 inline h-3 w-3 align-[-1px]" aria-label="device only" />
                    ) : null}
                  </dt>
                  <dd className="min-w-0 text-end font-medium">
                    {f.type === "tel" ? (
                      <a href={`tel:${details[f.key]}`} className="text-primary hover:underline">
                        {details[f.key]}
                      </a>
                    ) : (
                      details[f.key]
                    )}
                  </dd>
                </div>
              ))}
          </dl>
        ) : (
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Your insurance policy number and 24-hour assistance line are the two
            things you will most want and least be able to look up. Two minutes
            now.
          </p>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">If something has happened</h2>
        {PLAYBOOKS.map((p) => (
          <details key={p.id} className="panel p-4">
            <summary className="flex cursor-pointer list-none items-start gap-2 marker:hidden">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{p.title}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{p.summary}</span>
              </span>
              <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            </summary>
            <ol className="mt-3 space-y-2.5">
              {p.steps.map((step, i) => (
                <li key={i} className="flex gap-2.5 text-sm leading-relaxed">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            {p.note ? (
              <p className="mt-3 border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
                {p.note}
              </p>
            ) : null}
          </details>
        ))}
      </section>

      <section className="panel p-4">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-sm font-semibold">Emergency numbers</h2>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="rounded-md border border-input bg-surface px-2 py-1 text-xs"
            aria-label="Country"
          >
            {COUNTRY_EMERGENCY.map((c) => (
              <option key={c.countryCode} value={c.countryCode}>
                {c.countryCode}
              </option>
            ))}
          </select>
        </div>

        {local ? (
          <div className="mt-3 space-y-2">
            <a
              href={`tel:${local.primary}`}
              className="flex items-center justify-between rounded-md bg-primary px-3 py-3 text-primary-foreground"
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <Phone className="h-4 w-4" aria-hidden />
                Emergency
              </span>
              <span className="text-xl font-semibold tabular-nums">{local.primary}</span>
            </a>

            {(
              [
                ["Police", local.police],
                ["Ambulance", local.ambulance],
                ["Fire", local.fire],
                ["Tourist police", local.touristPolice],
              ] as const
            )
              .filter(([, num]) => Boolean(num) && num !== local.primary)
              .map(([label, num]) => (
                <a
                  key={label}
                  href={`tel:${num}`}
                  className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
                >
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium tabular-nums text-primary">{num}</span>
                </a>
              ))}

            {local.euro112 && local.primary !== "112" ? (
              <p className="text-xs leading-relaxed text-muted-foreground">
                <strong className="text-foreground">112</strong> also works here,
                usually from any mobile even without a SIM or credit.
              </p>
            ) : null}

            {local.note ? (
              <p className="text-xs leading-relaxed text-muted-foreground">{local.note}</p>
            ) : null}

            <p className="pt-1 text-xs text-muted-foreground">
              Verified {EMERGENCY_VERIFIED}. Confirm locally if you can — numbers change.
            </p>
          </div>
        ) : (
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            We don&apos;t have verified numbers for this country yet. Try{" "}
            <strong className="text-foreground">112</strong> — it reaches emergency
            services in much of the world, often from any mobile without a SIM.
          </p>
        )}
      </section>

      <LegalFooter />
    </div>
  );
}

function Field({
  def,
  value,
  onChange,
}: {
  def: FieldDef;
  value: string;
  onChange: (fields: Partial<EmergencyDetails>) => void;
}) {
  return (
    <label className="block">
      <span className="label-xs">{def.label}</span>
      <input
        type={def.type ?? "text"}
        value={value}
        onChange={(e) => onChange({ [def.key]: e.target.value })}
        className="mt-1 w-full rounded-md border border-input bg-surface px-2 py-2 text-sm"
      />
      {def.hint ? (
        <span className="mt-1 block text-xs text-muted-foreground">{def.hint}</span>
      ) : null}
    </label>
  );
}
