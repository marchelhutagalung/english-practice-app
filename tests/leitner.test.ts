import { describe, expect, it } from 'vitest';
import { BOX_INTERVAL_MS, dueEntries, scheduleReview } from '../src/domain/leitner';
import type { ReviewEntry } from '../src/domain/types';

const ids = { profile_id: 'kid', question_id: 'q1' };
const DAY = 86_400_000;

describe('Leitner review scheduling', () => {
  it('a wrong answer puts a question in box 1, due now', () => {
    const e = scheduleReview(undefined, false, ids, 1000);
    expect(e).toEqual({ ...ids, box: 1, due_at: 1000, last_reviewed_at: 1000 });
  });

  it('a correct answer to a question not in the queue keeps it out', () => {
    expect(scheduleReview(undefined, true, ids, 1000)).toBeNull();
  });

  it('correct answers promote 1 → 2 → 3 → graduated', () => {
    const b1 = scheduleReview(undefined, false, ids, 0)!;
    const b2 = scheduleReview(b1, true, ids, 10)!;
    expect(b2.box).toBe(2);
    expect(b2.due_at).toBe(10 + BOX_INTERVAL_MS[2]);
    expect(BOX_INTERVAL_MS[2]).toBe(DAY);
    const b3 = scheduleReview(b2, true, ids, 20)!;
    expect(b3.box).toBe(3);
    expect(b3.due_at).toBe(20 + 3 * DAY);
    expect(scheduleReview(b3, true, ids, 30)).toBeNull();
  });

  it('a wrong answer from any box drops back to box 1', () => {
    const b3: ReviewEntry = { ...ids, box: 3, due_at: 0, last_reviewed_at: 0 };
    expect(scheduleReview(b3, false, ids, 50)).toMatchObject({ box: 1, due_at: 50 });
  });

  it('lists due entries, lowest box first', () => {
    const entries: ReviewEntry[] = [
      { profile_id: 'k', question_id: 'a', box: 2, due_at: 100, last_reviewed_at: 0 },
      { profile_id: 'k', question_id: 'b', box: 1, due_at: 200, last_reviewed_at: 0 },
      { profile_id: 'k', question_id: 'c', box: 3, due_at: 9999, last_reviewed_at: 0 },
      { profile_id: 'k', question_id: 'd', box: 1, due_at: 50, last_reviewed_at: 0 },
    ];
    expect(dueEntries(entries, 500).map((e) => e.question_id)).toEqual(['d', 'b', 'a']);
  });
});
