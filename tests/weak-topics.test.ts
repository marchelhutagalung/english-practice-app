import { describe, expect, it } from 'vitest';
import { starsFor, streakDays, topicAccuracy, weakTopics } from '../src/domain/stats';
import type { AnswerRecord } from '../src/domain/types';

let t = 0;
function answers(topic_id: string, pattern: string): AnswerRecord[] {
  // pattern of "1"/"0", oldest first
  return [...pattern].map((c) => ({
    attempt_id: 'a', profile_id: 'kid', question_id: `${topic_id}-${t}`, topic_id,
    given: '', correct: c === '1', time_ms: 1000, answered_at: ++t,
  }));
}

describe('weak-topic detection', () => {
  it('flags topics under 70% and sorts weakest first', () => {
    const data = [...answers('good', '1111111101'), ...answers('weak', '1010100000'), ...answers('edge', '1110111001')];
    // good 90%, weak 30%, edge 70% (not < 70%)
    expect(weakTopics(data).map((w) => w.topic_id)).toEqual(['weak']);
    expect(topicAccuracy(data).map((x) => x.topic_id)).toEqual(['weak', 'edge', 'good']);
  });

  it('only looks at the last 20 answers of each topic', () => {
    // 20 old wrong answers, then 20 recent correct answers → not weak
    const recovered = answers('t', '0'.repeat(20) + '1'.repeat(20));
    expect(weakTopics(recovered)).toEqual([]);
    // the reverse: was good, now struggling → weak
    const slipping = answers('s', '1'.repeat(20) + '0'.repeat(20));
    expect(weakTopics(slipping)[0]).toMatchObject({ topic_id: 's', total: 20, accuracy: 0 });
  });

  it('needs a minimum number of answers before judging', () => {
    expect(weakTopics(answers('x', '00'))).toEqual([]);
    expect(weakTopics(answers('x', '000')).length).toBe(1);
  });
});

describe('stars and streak', () => {
  it('awards 1–3 stars', () => {
    expect(starsFor(9, 10)).toBe(3);
    expect(starsFor(7, 10)).toBe(2);
    expect(starsFor(2, 10)).toBe(1);
    expect(starsFor(0, 0)).toBe(1);
  });

  it('counts consecutive practice days', () => {
    const day = (d: number) => new Date(2026, 0, d, 10).getTime();
    expect(streakDays([day(10), day(11), day(12)], day(12))).toBe(3);
    expect(streakDays([day(10), day(11)], day(12))).toBe(2); // not yet today
    expect(streakDays([day(9), day(11)], day(12))).toBe(1);
    expect(streakDays([day(5)], day(12))).toBe(0);
  });
});
