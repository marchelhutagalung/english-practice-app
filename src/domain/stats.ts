import type { AnswerRecord } from './types';

export interface TopicAccuracy {
  topic_id: string;
  correct: number;
  total: number;
  accuracy: number;
}

/**
 * Accuracy per topic over each topic's most recent `window` answers.
 * Sorted weakest first (ties: more answers first, then id).
 */
export function topicAccuracy(answers: readonly AnswerRecord[], window = Infinity): TopicAccuracy[] {
  const byTopic = new Map<string, AnswerRecord[]>();
  for (const a of answers) {
    const list = byTopic.get(a.topic_id) ?? [];
    list.push(a);
    byTopic.set(a.topic_id, list);
  }
  const out: TopicAccuracy[] = [];
  for (const [topic_id, list] of byTopic) {
    const recent = [...list].sort((a, b) => b.answered_at - a.answered_at).slice(0, window);
    const correct = recent.filter((a) => a.correct).length;
    out.push({ topic_id, correct, total: recent.length, accuracy: recent.length ? correct / recent.length : 0 });
  }
  return out.sort((a, b) => a.accuracy - b.accuracy || b.total - a.total || a.topic_id.localeCompare(b.topic_id));
}

export const WEAK_THRESHOLD = 0.7;
export const WEAK_WINDOW = 20;
export const WEAK_MIN_ANSWERS = 3;

/**
 * Weak topics: accuracy < 70% over the topic's last 20 answers.
 * Topics with fewer than `minAnswers` answers are not judged yet.
 */
export function weakTopics(
  answers: readonly AnswerRecord[],
  opts: { threshold?: number; window?: number; minAnswers?: number } = {},
): TopicAccuracy[] {
  const threshold = opts.threshold ?? WEAK_THRESHOLD;
  const minAnswers = opts.minAnswers ?? WEAK_MIN_ANSWERS;
  return topicAccuracy(answers, opts.window ?? WEAK_WINDOW).filter((t) => t.total >= minAnswers && t.accuracy < threshold);
}

export function localDayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Consecutive days with at least one answer, ending today (or yesterday if not practised yet today). */
export function streakDays(answerTimes: readonly number[], now: number): number {
  const days = new Set(answerTimes.map(localDayKey));
  const cursor = new Date(now);
  cursor.setHours(12, 0, 0, 0);
  if (!days.has(localDayKey(cursor.getTime()))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (days.has(localDayKey(cursor.getTime()))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** 3 stars ≥ 90%, 2 stars ≥ 70%, otherwise 1 star (always at least one for trying). */
export function starsFor(correct: number, total: number): 1 | 2 | 3 {
  if (total <= 0) return 1;
  const p = correct / total;
  if (p >= 0.9) return 3;
  if (p >= 0.7) return 2;
  return 1;
}
