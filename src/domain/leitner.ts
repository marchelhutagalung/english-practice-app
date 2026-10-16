import type { ReviewEntry } from './types';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/**
 * Box intervals: box 1 is due again right away (next review session),
 * box 2 after 1 day, box 3 after 3 days. A correct answer from box 3 graduates
 * the question out of the queue.
 */
export const BOX_INTERVAL_MS: Record<1 | 2 | 3, number> = { 1: 0, 2: DAY, 3: 3 * DAY };

/**
 * Next state of a question in the review queue after an answer.
 * - wrong → box 1 (added to the queue if not there)
 * - correct & not in queue → stays out (null)
 * - correct & in box 1/2 → promoted one box
 * - correct & in box 3 → graduated (null = remove)
 */
export function scheduleReview(
  current: ReviewEntry | undefined,
  correct: boolean,
  ids: { profile_id: string; question_id: string },
  now: number,
): ReviewEntry | null {
  if (!correct) {
    return { ...ids, box: 1, due_at: now + BOX_INTERVAL_MS[1], last_reviewed_at: now };
  }
  if (!current) return null;
  if (current.box === 3) return null;
  const box = (current.box + 1) as 2 | 3;
  return { ...current, box, due_at: now + BOX_INTERVAL_MS[box], last_reviewed_at: now };
}

/** Due entries, lowest box first, then oldest due first. */
export function dueEntries(entries: readonly ReviewEntry[], now: number): ReviewEntry[] {
  return entries.filter((e) => e.due_at <= now).sort((a, b) => a.box - b.box || a.due_at - b.due_at);
}
