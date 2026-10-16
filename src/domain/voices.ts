/**
 * Pick a clear, natural English voice. Browsers list voices in no useful order, and on
 * iPad/macOS the list includes joke voices ("Albert", "Bubbles", "Zarvox"…) and old
 * robotic ones, so we score every voice instead of taking the first match.
 */
export interface VoiceInfo {
  name: string;
  lang: string;
  voiceURI: string;
  localService: boolean;
  default: boolean;
}

/** Apple novelty voices: never offer these to kids. */
const NOVELTY = new Set(
  [
    'Albert', 'Bad News', 'Bahh', 'Bells', 'Boing', 'Bubbles', 'Cellos', 'Deranged', 'Good News', 'Hysterical',
    'Jester', 'Organ', 'Pipe Organ', 'Superstar', 'Trinoids', 'Whisper', 'Wobble', 'Zarvox',
  ].map((n) => n.toLowerCase()),
);

/** Old MacinTalk / Eloquence voices: understandable but robotic. Kept, ranked last. */
const ROBOTIC = new Set(
  [
    'Agnes', 'Bruce', 'Fred', 'Junior', 'Kathy', 'Princess', 'Ralph', 'Vicki', 'Victoria',
    'Eddy', 'Flo', 'Grandma', 'Grandpa', 'Reed', 'Rocko', 'Sandy', 'Shelley',
  ].map((n) => n.toLowerCase()),
);

/** Natural-sounding voices commonly found on iPad, Mac, Chrome and Edge. */
const GOOD = [
  'samantha', 'ava', 'allison', 'susan', 'zoe', 'nicky', 'evan', 'nathan', 'tom', 'joelle', 'noelle', 'alex',
  'daniel', 'kate', 'serena', 'arthur', 'martha', 'stephanie', 'karen', 'lee', 'moira', 'tessa', 'catherine',
  'google us english', 'google uk english female', 'google uk english male',
];

/** Base name without quality suffix, e.g. "Ava (Premium)" → "ava". */
export function baseVoiceName(name: string): string {
  return name.replace(/\s*\((enhanced|premium|compact|[^)]*)\)\s*$/i, '').trim().toLowerCase();
}

export const isNoveltyVoice = (v: Pick<VoiceInfo, 'name'>) => NOVELTY.has(baseVoiceName(v.name));

export function isEnglish(v: Pick<VoiceInfo, 'lang'>): boolean {
  return /^en([-_]|$)/i.test(v.lang);
}

export function voiceScore(v: VoiceInfo): number {
  if (!isEnglish(v) || isNoveltyVoice(v)) return -Infinity;
  const name = v.name.toLowerCase();
  const uri = v.voiceURI.toLowerCase();
  const base = baseVoiceName(v.name);
  let s = 0;
  if (/premium/.test(name) || /\.premium\./.test(uri)) s += 100;
  else if (/enhanced/.test(name) || /\.enhanced\./.test(uri)) s += 80;
  if (/natural|neural/.test(name)) s += 90; // Edge "Microsoft Aria Online (Natural)" etc.
  if (GOOD.some((g) => base === g || base.startsWith(`${g} `) || name.startsWith(g))) s += 40;
  if (ROBOTIC.has(base) || /eloquence/.test(uri)) s -= 60;
  if (/^en[-_]US/i.test(v.lang)) s += 20;
  else if (/^en[-_]GB/i.test(v.lang)) s += 15;
  else s += 5;
  if (v.default) s += 3;
  if (v.localService) s += 2; // works offline
  return s;
}

/** English, non-novelty voices, best first. */
export function rankVoices<V extends VoiceInfo>(voices: readonly V[]): V[] {
  return voices
    .map((v) => ({ v, s: voiceScore(v) }))
    .filter((x) => x.s > -Infinity)
    .sort((a, b) => b.s - a.s || a.v.name.localeCompare(b.v.name))
    .map((x) => x.v);
}

export const isHighQuality = (v: VoiceInfo) => voiceScore(v) >= 80;

/** Split text into sentence-sized chunks; iOS can garble or stop on long utterances. */
export function speechChunks(text: string, maxLen = 160): string[] {
  const sentences = text
    .replace(/_{2,}/g, ' blank ')
    .replace(/\s+/g, ' ')
    .trim()
    .match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) ?? [];
  const out: string[] = [];
  for (const raw of sentences) {
    const s = raw.trim();
    if (!s) continue;
    const last = out[out.length - 1];
    if (last && last.length + s.length + 1 <= maxLen && last.length < 40) out[out.length - 1] = `${last} ${s}`;
    else out.push(s);
  }
  return out;
}
