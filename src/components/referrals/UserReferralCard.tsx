import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Gift } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { ReferralLinkCard } from "./ReferralLinkCard";
import { getUserReferralSummary } from "@/lib/referrals/user.functions";
import { USER_PROGRAM } from "@/lib/referrals/config";

/**
 * Program B only. Free months, never cash. Deliberately separate from the
 * creator dashboard — mixing the two is how referral accounting stops being
 * auditable.
 */
export function UserReferralCard({ signedIn }: { signedIn: boolean }) {
  const fetchSummary = useServerFn(getUserReferralSummary);
  const { data, isLoading } = useQuery({
    queryKey: ["user-referrals"],
    queryFn: () => fetchSummary({}),
    enabled: signedIn,
  });

  if (!signedIn) {
    return (
      <section className="panel space-y-2 p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Gift className="h-4 w-4 text-positive" /> Invite a friend
        </h2>
        <p className="text-sm text-muted-foreground">
          You both get one free month of Pro.{" "}
          <Link to="/auth" search={{ next: "/profile" }} className="underline">
            Sign in
          </Link>{" "}
          to get your code.
        </p>
      </section>
    );
  }

  if (isLoading || !data?.code) {
    return (
      <section className="panel p-4 text-sm text-muted-foreground">Loading your code…</section>
    );
  }

  return (
    <div className="space-y-3">
      <ReferralLinkCard
        code={data.code}
        title="Invite a friend"
        note="you both get one free month of Pro"
      />
      <section className="panel grid grid-cols-3 gap-3 p-4">
        <Metric label="Friends joined" value={data.friendsJoined} />
        <Metric label="Free months earned" value={data.monthsEarned} />
        <Metric label="Pending" value={data.monthsPending} />
      </section>
      <p className="text-xs text-muted-foreground">
        Your friend's free month applies at signup. Yours lands once they've been active{" "}
        {data.qualifyingDays} days. Capped at {USER_PROGRAM.maxEarnedMonthsPerRollingYear} earned
        months per rolling year — {data.monthsRemainingThisYear} left this year. No cash is ever
        paid on this program;{" "}
        <Link to="/creators" className="underline">
          the creator program
        </Link>{" "}
        is separate.
      </p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="label-xs">{label}</div>
      <div className="num text-2xl font-semibold">{value}</div>
    </div>
  );
}
