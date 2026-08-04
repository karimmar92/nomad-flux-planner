import { useState } from "react";
import { CITIES } from "@/lib/cities";
import { useProfile } from "@/lib/store";
import type { IncomeType } from "@/lib/types";
import { APP_NAME } from "@/lib/app";
import { flagEmoji } from "@/lib/arbitrage";
import { cn } from "@/lib/utils";

const NATIONALITIES = [
  ["GB", "United Kingdom"],
  ["US", "United States"],
  ["CA", "Canada"],
  ["AU", "Australia"],
  ["DE", "Germany"],
  ["FR", "France"],
  ["NL", "Netherlands"],
  ["IE", "Ireland"],
  ["ZA", "South Africa"],
  ["IN", "India"],
  ["BR", "Brazil"],
] as const;

const INCOME_TYPES: [IncomeType, string, string][] = [
  ["employed", "Employed", "Salaried by one company"],
  ["freelance", "Freelance", "Multiple clients, invoiced"],
  ["founder", "Founder", "Own company, variable draw"],
];

/** Four-step, skippable first-run flow. Writes straight into the profile. */
export function Onboarding({ onDone }: { onDone: () => void }) {
  const { profile, patchProfile } = useProfile();
  const [step, setStep] = useState(0);
  const [nationality, setNationality] = useState(profile.nationality);
  const [income, setIncome] = useState<string>(profile.monthly_income_usd?.toString() ?? "");
  const [incomeType, setIncomeType] = useState<IncomeType>(profile.income_type);
  const [homeCity, setHomeCity] = useState<string | null>(profile.home_city_id);

  const finish = (skipped: boolean) => {
    patchProfile(
      skipped
        ? { onboarded: true }
        : {
            nationality,
            monthly_income_usd: income ? Number(income) : null,
            income_type: incomeType,
            home_city_id: homeCity,
            onboarded: true,
          },
    );
    onDone();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 p-0 backdrop-blur sm:items-center sm:p-4">
      <div className="panel w-full max-w-md p-5 sm:rounded-lg">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="label-xs">
              {APP_NAME} · step {step + 1} of 4
            </p>
            <h2 className="text-lg font-semibold">
              {["Your passport", "Your income", "How you earn", "Where you are now"][step]}
            </h2>
          </div>
          <button
            onClick={() => finish(true)}
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            Skip
          </button>
        </div>

        <div className="mb-5 flex gap-1">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={cn("h-1 flex-1 rounded-full", i <= step ? "bg-primary" : "bg-surface-2")}
            />
          ))}
        </div>

        {step === 0 ? (
          <div className="grid max-h-72 grid-cols-2 gap-2 overflow-y-auto">
            {NATIONALITIES.map(([code, name]) => (
              <button
                key={code}
                onClick={() => {
                  setNationality(code);
                  setStep(1);
                }}
                className={cn(
                  "flex items-center gap-2 rounded-md border border-border px-3 py-2 text-left text-sm hover:border-primary/50",
                  nationality === code && "border-primary bg-primary/10",
                )}
              >
                <span aria-hidden>{flagEmoji(code)}</span>
                <span className="truncate">{name}</span>
              </button>
            ))}
          </div>
        ) : null}

        {step === 1 ? (
          <div>
            <label className="label-xs" htmlFor="ob-income">
              Monthly income (USD)
            </label>
            <input
              id="ob-income"
              inputMode="numeric"
              value={income}
              onChange={(e) => setIncome(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="5000"
              className="num mt-1 w-full rounded-md border border-input bg-surface px-3 py-2.5 text-2xl font-semibold outline-none focus:border-primary"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Everything in {APP_NAME} is computed from this number. You can change it any time.
            </p>
            <button
              onClick={() => setStep(2)}
              className="mt-4 w-full rounded-md bg-primary py-2.5 text-sm font-medium text-primary-foreground"
            >
              Continue
            </button>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-2">
            {INCOME_TYPES.map(([value, label, hint]) => (
              <button
                key={value}
                onClick={() => {
                  setIncomeType(value);
                  setStep(3);
                }}
                className={cn(
                  "w-full rounded-md border border-border px-3 py-2.5 text-left hover:border-primary/50",
                  incomeType === value && "border-primary bg-primary/10",
                )}
              >
                <div className="text-sm font-medium">{label}</div>
                <div className="text-xs text-muted-foreground">{hint}</div>
              </button>
            ))}
          </div>
        ) : null}

        {step === 3 ? (
          <div>
            <div className="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto">
              {CITIES.map((city) => (
                <button
                  key={city.id}
                  onClick={() => setHomeCity(city.id)}
                  className={cn(
                    "flex items-center gap-2 rounded-md border border-border px-3 py-2 text-left text-sm hover:border-primary/50",
                    homeCity === city.id && "border-primary bg-primary/10",
                  )}
                >
                  <span aria-hidden>{flagEmoji(city.country_code)}</span>
                  <span className="truncate">{city.city}</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => finish(false)}
              className="mt-4 w-full rounded-md bg-primary py-2.5 text-sm font-medium text-primary-foreground"
            >
              Show me my numbers
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
