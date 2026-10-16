/**
 * speechSynthesis wrapper.
 * iOS Safari only speaks when speak() runs inside a user gesture, so every call
 * site is a button tap handler — never call speak() from an effect or timer.
 */
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

/** English voices, en-US and en-GB first. */
export function englishVoices(): SpeechSynthesisVoice[] {
  if (!ttsSupported()) return [];
  const rank = (v: SpeechSynthesisVoice) => (/^en[-_]US/i.test(v.lang) ? 0 : /^en[-_]GB/i.test(v.lang) ? 1 : 2);
  return speechSynthesis
    .getVoices()
    .filter((v) => /^en([-_]|$)/i.test(v.lang))
    .sort((a, b) => rank(a) - rank(b) || Number(b.localService) - Number(a.localService) || a.name.localeCompare(b.name));
}

/** Voices load asynchronously on some browsers. */
export function onVoicesChanged(cb: () => void): () => void {
  if (!ttsSupported()) return () => {};
  speechSynthesis.addEventListener('voiceschanged', cb);
  return () => speechSynthesis.removeEventListener('voiceschanged', cb);
}

function pickVoice(): SpeechSynthesisVoice | undefined {
  const voices = englishVoices();
  return voices.find((v) => v.voiceURI === prefs.voiceURI) ?? voices.find((v) => /^en[-_](US|GB)/i.test(v.lang)) ?? voices[0];
}

export function speak(text: string, opts: { onEnd?: () => void; rate?: number } = {}): void {
  if (!ttsSupported()) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/_{2,}/g, ' blank '));
  const voice = pickVoice();
  if (voice) {
    u.voice = voice;
    u.lang = voice.lang;
  } else u.lang = 'en-US';
  u.rate = opts.rate ?? prefs.rate;
  u.onend = () => opts.onEnd?.();
  u.onerror = () => opts.onEnd?.();
  speechSynthesis.speak(u);
}

export function stopSpeaking(): void {
  if (ttsSupported()) speechSynthesis.cancel();
}
