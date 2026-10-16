/**
 * speechSynthesis wrapper.
 * iOS Safari only speaks when speak() runs inside a user gesture, so every call
 * site is a button tap handler — never call speak() from an effect or timer.
 */
import { rankVoices, speechChunks } from './domain/voices';

export interface TtsPrefs {
  voiceURI: string | null;
  rate: number;
}

export const ttsSupported = (): boolean => typeof window !== 'undefined' && 'speechSynthesis' in window;

let prefs: TtsPrefs = { voiceURI: null, rate: 0.9 };
export function setTtsPrefs(p: Partial<TtsPrefs>): void {
  prefs = { ...prefs, ...p };
}
export const getTtsPrefs = (): TtsPrefs => prefs;

/** English voices worth offering, best first (novelty voices removed). */
export function englishVoices(): SpeechSynthesisVoice[] {
  if (!ttsSupported()) return [];
  return rankVoices(speechSynthesis.getVoices());
}

/** Voices load asynchronously on some browsers. */
export function onVoicesChanged(cb: () => void): () => void {
  if (!ttsSupported()) return () => {};
  speechSynthesis.addEventListener('voiceschanged', cb);
  return () => speechSynthesis.removeEventListener('voiceschanged', cb);
}

// Warm the voice list early so the first tap already has a good voice.
if (ttsSupported()) {
  speechSynthesis.getVoices();
  onVoicesChanged(() => speechSynthesis.getVoices());
}

export function pickVoice(voiceURI: string | null = prefs.voiceURI): SpeechSynthesisVoice | undefined {
  const voices = englishVoices();
  return voices.find((v) => v.voiceURI === voiceURI) ?? voices[0];
}

let session = 0;

export function speak(text: string, opts: { onEnd?: () => void; rate?: number; voiceURI?: string | null } = {}): void {
  if (!ttsSupported()) return;
  const id = ++session;
  speechSynthesis.cancel();
  const voice = pickVoice(opts.voiceURI === undefined ? prefs.voiceURI : opts.voiceURI);
  const chunks = speechChunks(text);
  if (!chunks.length) return void opts.onEnd?.();
  let done = false;
  const finish = () => {
    if (!done && id === session) {
      done = true;
      opts.onEnd?.();
    }
  };
  chunks.forEach((chunk, i) => {
    const u = new SpeechSynthesisUtterance(chunk);
    if (voice) {
      u.voice = voice;
      u.lang = voice.lang;
    } else u.lang = 'en-US';
    u.rate = opts.rate ?? prefs.rate;
    u.pitch = 1;
    u.volume = 1;
    if (i === chunks.length - 1) u.onend = finish;
    u.onerror = finish;
    // Queue all chunks synchronously inside the tap handler (required on iOS).
    speechSynthesis.speak(u);
  });
}

export function stopSpeaking(): void {
  if (!ttsSupported()) return;
  session++;
  speechSynthesis.cancel();
}
