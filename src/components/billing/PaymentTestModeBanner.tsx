/**
 * Says out loud which payment environment the visitor is in.
 *
 * In test mode, nothing is charged — anyone trying to actually subscribe from
 * a preview link deserves to know that before typing a card number. In live
 * mode this renders nothing.
 *
 * The missing-token case is not a no-op: it means the site was published
 * before payments go-live finished, so every checkout button leads to a dead
 * end. Better to say so than to let people try and fail.
 */
const clientToken = import.meta.env["VITE_PAYMENTS_CLIENT_TOKEN"] as string | undefined;

export function PaymentTestModeBanner() {
  if (!clientToken) {
    return (
      <div className="w-full border-b border-accent-warning/40 bg-accent-warning-muted px-4 py-2 text-center text-xs">
        Payments are not fully set up yet, so checkout will not work. Finish the payment go-live
        steps to accept real payments.
      </div>
    );
  }

  if (clientToken.startsWith("pk_test_")) {
    return (
      <div className="w-full border-b border-accent-warning/40 bg-accent-warning-muted px-4 py-2 text-center text-xs">
        Test mode — no card is charged and no subscription is real.
      </div>
    );
  }

  return null;
}
