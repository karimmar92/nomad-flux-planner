import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { CITIES } from "@/lib/cities";
import { useProfile } from "@/lib/store";
import type { IncomeType, UserStage } from "@/lib/types";
import { APP_NAME } from "@/lib/app";
import { flagEmoji } from "@/lib/arbitrage";
import { cn } from "@/lib/utils";
import { BANKING_DISCLAIMER, PARTNERS, partnerUrl } from "@/config/partners";
import { logPartnerClick } from "@/lib/partner-clicks";

// Business account only: this line exists because someone just said they
// freelance or run a company. Personal accounts are on the Nomad kit page.
const bankingPartner = PARTNERS.find((p) => p.id === "wise-business");


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

const INCOME_TYPES: IncomeType[] = ["employed", "freelance", "founder"];

/** Five-step, skippable first-run flow. Writes straight into the profile. */
export function Onboarding({ onDone }: { onDone: (stage: UserStage) => void }) {
  const { t } = useTranslation("common");
  const { profile, patchProfile } = useProfile();
  const [step, setStep] = useState(0);
  const [stage, setStage] = useState<UserStage>(profile.stage);
  const [nationality, setNationality] = useState(profile.nationality);
  const [income, setIncome] = useState<string>(profile.monthly_income_usd?.toString() ?? "");
  const [incomeType, setIncomeType] = useState<IncomeType>(profile.income_type);
  const [bankingDismissed, setBankingDismissed] = useState(false);

  const [homeCity, setHomeCity] = useState<string | null>(profile.home_city_id);

  const STEP_TITLES = [
    t("onboarding.steps.0"),
    t("onboarding.steps.1"),
    t("onboarding.steps.2"),
    t("onboarding.steps.3"),
    t("onboarding.steps.4"),
  ];

  const INCOME_TYPE_LABELS: Record<IncomeType, [string, string]> = {
    employed: [t("onboarding.incomeType.employedLabel"), t("onboarding.incomeType.employedHint")],
    freelance: [t("onboarding.incomeType.freelanceLabel"), t("onboarding.incomeType.freelanceHint")],
    founder: [t("onboarding.incomeType.founderLabel"), t("onboarding.incomeType.founderHint")],
  };

  const finish = (skipped: boolean) => {
    patchProfile(
      skipped
        ? { stage, onboarded: true }
        : {
            stage,
            nationality,
            monthly_income_usd: income ? Number(income) : null,
            income_type: incomeType,
            home_city_id: homeCity,
            onboarded: true,
          },
    );
    onDone(stage);
  };

  // A first-run modal that traps the user is worse than no onboarding: Escape
  // and a backdrop click both dismiss it, and dismissing marks it done for good.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 p-0 backdrop-blur sm:items-center sm:p-4"
      onClick={() => finish(true)}
      role="presentation"
    >
      <div
        className="panel w-full max-w-md p-5 sm:rounded-lg"
        role="dialog"
        aria-modal="true"
        aria-label={`${APP_NAME} ${t("onboarding.ariaLabelSuffix")}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="label-xs">
              {t("onboarding.appStep", { app: APP_NAME, current: step + 1, total: STEP_TITLES.length })}
            </p>
            <h2 className="text-lg font-semibold">
              {STEP_TITLES[step]}
            </h2>
          </div>
          <button type="button"
            onClick={() => finish(true)}
            aria-label={t("onboarding.skipAria")}
            className="flex shrink-0 items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:border-primary/50 hover:bg-surface-2"
          >
            {t("onboarding.skip")}
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>


        <div className="mb-5 flex gap-1">
          {STEP_TITLES.map((_, i) => (
            <div
              key={i}
              className={cn("h-1 flex-1 rounded-full", i <= step ? "bg-primary" : "bg-surface-2")}
            />
          ))}
        </div>

        {step === 0 ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {t("onboarding.stage.intro")}
            </p>
            {(
              [
                [
                  "abroad",
                  t("onboarding.stage.abroadLabel"),
                  t("onboarding.stage.abroadBlurb"),
                ],
                [
                  "planning",
                  t("onboarding.stage.planningLabel"),
                  t("onboarding.stage.planningBlurb"),
                ],
              ] as [UserStage, string, string][]
            ).map(([value, label, blurb]) => (
              <button type="button"
                key={value}
                onClick={() => {
                  setStage(value);
                  setStep(1);
                }}
                className={cn(
                  "w-full rounded-md border border-border px-3 py-3 text-start hover:border-primary/50",
                  stage === value && "border-primary bg-primary/10",
                )}
              >
                <span className="block text-sm font-medium">{label}</span>
                <span className="block text-xs text-muted-foreground">{blurb}</span>
              </button>
            ))}
          </div>
        ) : null}

        {step === 1 ? (
          <div className="grid max-h-72 grid-cols-2 gap-2 overflow-y-auto">
            {NATIONALITIES.map(([code, name]) => (
              <button type="button"
                key={code}
                onClick={() => {
                  setNationality(code);
                  setStep(2);
                }}
                className={cn(
                  "flex items-center gap-2 rounded-md border border-border px-3 py-2 text-start text-sm hover:border-primary/50",
                  nationality === code && "border-primary bg-primary/10",
                )}
              >
                <span aria-hidden>{flagEmoji(code)}</span>
                <span className="truncate">{name}</span>
              </button>
            ))}
          </div>
        ) : null}

        {step === 2 ? (
          <div>
            <label className="label-xs" htmlFor="ob-income">
              {t("onboarding.income.label")}
            </label>
            <input
              id="ob-income"
              inputMode="numeric"
              value={income}
              onChange={(e) => setIncome(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder={t("onboarding.income.placeholder")}
              className="num mt-1 w-full rounded-md border border-input bg-surface px-3 py-2.5 text-2xl font-semibold outline-none focus:border-primary"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              {t("onboarding.income.helper", { app: APP_NAME })}
            </p>
            <button type="button"
              onClick={() => setStep(3)}
              className="mt-4 w-full rounded-md bg-primary py-2.5 text-sm font-medium text-primary-foreground"
            >
              {t("onboarding.income.continue")}
            </button>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-2">
            {INCOME_TYPES.map((value) => {
              const [label, hint] = INCOME_TYPE_LABELS[value];
              return (
                <button type="button"
                  key={value}
                  onClick={() => {
                    setIncomeType(value);
                    // Freelance and founder stay on this step for a beat: it's the
                    // one moment a business account is genuinely relevant.
                    if (value === "employed") setStep(4);
                  }}
                  className={cn(
                    "w-full rounded-md border border-border px-3 py-2.5 text-start hover:border-primary/50",
                    incomeType === value && "border-primary bg-primary/10",
                  )}
                >
                  <div className="text-sm font-medium">{label}</div>
                  <div className="text-xs text-muted-foreground">{hint}</div>
                </button>
              );
            })}

            {/*
              One quiet, dismissible line — never a card stack, never on any
              other step, and nowhere near tax content. Banking is a regulated
              financial promotion: comparative fact only, standing disclaimer
              always visible. See the BANKING RULE in src/config/partners.ts.
            */}
            {(incomeType === "freelance" || incomeType === "founder") && !bankingDismissed ? (
              <div className="rounded-md border border-border bg-surface-2 px-3 py-2.5">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {t("onboarding.banking.prompt")}{" "}
                    <a
                      href={bankingPartner ? partnerUrl(bankingPartner) : "#"}
                      target="_blank"
                      rel="sponsored noopener"
                      onClick={() =>
                        bankingPartner &&
                        logPartnerClick({
                          partner_id: bankingPartner.id,
                          placement: "onboarding",
                        })
                      }
                      className="font-semibold text-foreground underline underline-offset-2"
                    >
                      {bankingPartner?.name}
                    </a>{" "}
                    {t("onboarding.banking.offer")}{" "}
                    <span className="text-muted-foreground/80">
                      {t("onboarding.banking.affiliate")}
                    </span>
                  </p>
                  <button
                    type="button"
                    onClick={() => setBankingDismissed(true)}
                    aria-label={t("onboarding.banking.dismissAria")}
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground/80">
                  {BANKING_DISCLAIMER}
                </p>
              </div>
            ) : null}

            <button type="button"
              onClick={() => setStep(4)}
              className="mt-2 w-full rounded-md bg-primary py-2.5 text-sm font-medium text-primary-foreground"
            >
              {t("onboarding.incomeType.continue")}
            </button>
          </div>
        ) : null}


        {step === 4 ? (
          <div>
            <div className="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto">
              {CITIES.map((city) => (
                <button type="button"
                  key={city.id}
                  onClick={() => setHomeCity(city.id)}
                  className={cn(
                    "flex items-center gap-2 rounded-md border border-border px-3 py-2 text-start text-sm hover:border-primary/50",
                    homeCity === city.id && "border-primary bg-primary/10",
                  )}
                >
                  <span aria-hidden>{flagEmoji(city.country_code)}</span>
                  <span className="truncate">{city.city}</span>
                </button>
              ))}
            </div>
            <button type="button"
              onClick={() => finish(false)}
              className="mt-4 w-full rounded-md bg-primary py-2.5 text-sm font-medium text-primary-foreground"
            >
              {stage === "planning" ? t("onboarding.home.finishPlanning") : t("onboarding.home.finishAbroad")}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
