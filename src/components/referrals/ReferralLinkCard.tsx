import { useEffect, useState } from "react";
import { Check, Copy, QrCode } from "lucide-react";
import QRCode from "qrcode";
import { referralUrl } from "@/lib/referrals/config";

/**
 * Link + one-tap copy + QR. The QR earns its place here: this audience does
 * in-person meetups and coworking talks.
 */
export function ReferralLinkCard({
  code,
  title = "Your link",
  note,
}: {
  code: string;
  title?: string;
  note?: string;
}) {
  const url = referralUrl(code);
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);

  useEffect(() => {
    let active = true;
    void QRCode.toDataURL(url, { margin: 1, width: 320 }).then((dataUrl) => {
      if (active) setQr(dataUrl);
    });
    return () => {
      active = false;
    };
  }, [url]);

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <section className="panel space-y-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="label-xs">{title}</h2>
        <button
          onClick={() => setShowQr((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <QrCode className="h-3.5 w-3.5" />
          {showQr ? "Hide QR" : "QR code"}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <code className="num min-w-0 flex-1 truncate rounded-md bg-surface-2 px-3 py-2 text-sm">
          {url}
        </code>
        <button
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <p className="text-xs text-muted-foreground">
        Code <span className="num font-medium text-foreground">{code}</span>
        {note ? ` — ${note}` : null}
      </p>

      {showQr && qr ? (
        <img
          src={qr}
          alt={`QR code for referral link ${url}`}
          className="h-40 w-40 rounded-lg bg-white p-2"
        />
      ) : null}
    </section>
  );
}
