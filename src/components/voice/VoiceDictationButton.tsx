/**
 * Mic button wrapping the browser's own SpeechRecognition API.
 *
 * Deliberately not a cloud speech API: the browser does the transcribing, so
 * this app's server never receives audio. No new sub-processor, no privacy
 * policy change, no per-minute cost — the same reasoning that put photo
 * OCR on-device instead of behind a cloud vision API. The cost is browser
 * support: Chrome and Edge are solid, Firefox and older Safari are not, so
 * this renders nothing when the API is absent rather than a broken control.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Mic } from "lucide-react";
import { cn } from "@/lib/utils";

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const LOCALE_TO_SPEECH_LANG: Record<string, string> = {
  en: "en-US",
  de: "de-DE",
  es: "es-ES",
};

export function VoiceDictationButton({
  onTranscript,
  lang,
  className,
  label = "Dictate",
}: {
  /** Called once per completed utterance with the recognised text. */
  onTranscript: (text: string) => void;
  /** i18n language code ("en", "de", "es"), mapped to a speech locale. */
  lang?: string;
  className?: string;
  label?: string;
}) {
  const Ctor = useMemo(() => getSpeechRecognitionCtor(), []);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  // Stop listening if the component unmounts mid-capture (e.g. the user
  // navigates away), rather than leaving the microphone open.
  useEffect(() => {
    return () => recognitionRef.current?.stop();
  }, []);

  if (!Ctor) return null;

  const start = () => {
    setError(null);
    const recognition = new Ctor();
    recognition.lang = LOCALE_TO_SPEECH_LANG[lang ?? "en"] ?? "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript;
      if (transcript) onTranscript(transcript);
    };
    recognition.onerror = (event) => {
      setError(
        event.error === "not-allowed"
          ? "Microphone access was blocked. Allow it in your browser settings to dictate."
          : "Could not hear that. Try again.",
      );
      setListening(false);
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  };

  const stop = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={listening ? stop : start}
        aria-label={listening ? "Listening…" : label}
        aria-pressed={listening}
        className={cn(
          "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
          listening
            ? "motion-safe:animate-pulse border-primary bg-primary/10 text-primary"
            : "border-border text-muted-foreground hover:text-foreground",
          className,
        )}
      >
        <Mic className="h-3.5 w-3.5" aria-hidden />
        {listening ? "Listening…" : label}
      </button>
      <span aria-live="polite" className="sr-only">
        {listening ? "Listening" : ""}
      </span>
      {error ? <span className="text-[11px] text-negative">{error}</span> : null}
    </div>
  );
}
