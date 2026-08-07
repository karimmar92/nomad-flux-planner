/**
 * Spoken output via the browser's SpeechSynthesis.
 *
 * On-device on essentially every modern phone, so it works with no signal and
 * costs nothing — which is the only reason audio is in scope at all. A hosted
 * TTS service would break the offline promise and add per-character cost to a
 * flat-price plan.
 *
 * THE RULE THAT MATTERS: if no voice exists for the target language, say so and
 * stay silent. Reading Vietnamese with an English voice produces confident
 * nonsense that a listener will genuinely try to parse — worse than showing
 * the text and letting them read it.
 */

export type VoiceSupport = "ready" | "no_voice" | "unsupported";

function synth(): SpeechSynthesis | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  return window.speechSynthesis;
}

/** Best voice for a BCP-47 tag: exact match, else same base language. */
export function findVoice(bcp47: string): SpeechSynthesisVoice | null {
  const s = synth();
  if (!s) return null;
  const voices = s.getVoices();
  const lower = bcp47.toLowerCase();
  const base = lower.split("-")[0]!;
  return (
    voices.find((v) => v.lang.toLowerCase() === lower) ??
    voices.find((v) => v.lang.toLowerCase().replace("_", "-").split("-")[0] === base) ??
    null
  );
}

export function voiceSupport(bcp47: string): VoiceSupport {
  if (!synth()) return "unsupported";
  return findVoice(bcp47) ? "ready" : "no_voice";
}

/**
 * Speaks text in the target language, or returns false without speaking.
 *
 * Slightly slower than default: this is read aloud TO somebody, often in a
 * noisy office, by a phone held at arm's length.
 */
export function speak(text: string, bcp47: string): boolean {
  const s = synth();
  if (!s) return false;
  const voice = findVoice(bcp47);
  if (!voice) return false;

  s.cancel(); // never queue — a stack of phrases playing over each other is chaos
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = voice;
  utterance.lang = voice.lang;
  utterance.rate = 0.85;
  s.speak(utterance);
  return true;
}

export function stopSpeaking(): void {
  synth()?.cancel();
}

/**
 * Voice lists load asynchronously in some browsers, so a first call can see an
 * empty list. Resolves once voices exist, or after a short timeout.
 */
export function whenVoicesReady(): Promise<void> {
  const s = synth();
  if (!s) return Promise.resolve();
  if (s.getVoices().length > 0) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      s.removeEventListener("voiceschanged", done);
      resolve();
    };
    s.addEventListener("voiceschanged", done);
    setTimeout(done, 1500);
  });
}
