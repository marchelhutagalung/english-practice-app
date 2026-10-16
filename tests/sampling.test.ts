import { describe, expect, it } from 'vitest';
import { allocateByWeight, orderForSession, sampleQuestions } from '../src/domain/sampling';
import { seededRng } from '../src/domain/random';
import { question } from './fixtures';
import type { Question } from '../src/domain/schema';

const pool = (topic: string, count: number, extra: Record<string, unknown> = {}): Question[] =>
  Array.from({ length: count }, (_, i) => question(`${topic}-${i}`, topic, extra) as Question);

describe('allocateByWeight', () => {
  it('splits proportionally and sums to the total', () => {
    const a = allocateByWeight({ x: 0.5, y: 0.3, z: 0.2 }, { x: 100, y: 100, z: 100 }, 30);
    expect(a).toEqual({ x: 15, y: 9, z: 6 });
  });

  it('accepts weights that do not sum to 1 and rounds by largest remainder', () => {
    const a = allocateByWeight({ x: 1, y: 1, z: 1 }, { x: 10, y: 10, z: 10 }, 10);
    expect(Object.values(a).reduce((s, v) => s + v, 0)).toBe(10);
    expect(Object.values(a).sort()).toEqual([3, 3, 4]);
  });

  it('redistributes the shortfall of a small topic to the others', () => {
    const a = allocateByWeight({ x: 0.5, y: 0.25, z: 0.25 }, { x: 2, y: 100, z: 100 }, 20);
    expect(a.x).toBe(2);
    expect(a.y + a.z).toBe(18);
    expect(a.y).toBe(9);
  });

  it('never exceeds what is available', () => {
    expect(allocateByWeight({ x: 1, y: 1 }, { x: 2, y: 3 }, 50)).toEqual({ x: 2, y: 3 });
    expect(allocateByWeight({ x: 1 }, {}, 5)).toEqual({ x: 0 });
  });
});

describe('sampleQuestions', () => {
  const all = [...pool('gram', 40), ...pool('voc', 40), ...pool('read', 40)];

  it('follows competition topic weights without repeats', () => {
    const picked = sampleQuestions(all, { weights: { gram: 0.5, voc: 0.3, read: 0.2 }, count: 30, rng: seededRng(1) });
    expect(picked).toHaveLength(30);
    expect(new Set(picked.map((q) => q.id)).size).toBe(30);
    const count = (t: string) => picked.filter((q) => q.topic_id === t).length;
    expect([count('gram'), count('voc'), count('read')]).toEqual([15, 9, 6]);
  });

  it('ignores topics outside the weights, honours difficulty and exclusions', () => {
    const mixed = [...pool('gram', 5), ...pool('hard', 5, { difficulty: 3 }).map((q) => ({ ...q, topic_id: 'gram' }))];
    const picked = sampleQuestions([...mixed, ...pool('other', 5)], {
      weights: { gram: 1 },
      count: 10,
      difficulty: 3,
      exclude: new Set(['hard-0']),
      rng: seededRng(2),
    });
    expect(picked.map((q) => q.id).sort()).toEqual(['hard-1', 'hard-2', 'hard-3', 'hard-4']);
  });

  it('is reproducible with a seeded rng and varies across seeds', () => {
    const opts = { weights: { gram: 1, voc: 1 }, count: 10 };
    const a = sampleQuestions(all, { ...opts, rng: seededRng(7) }).map((q) => q.id);
    const b = sampleQuestions(all, { ...opts, rng: seededRng(7) }).map((q) => q.id);
    const c = sampleQuestions(all, { ...opts, rng: seededRng(8) }).map((q) => q.id);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it('keeps questions of the same passage together', () => {
    const reading = [
      ...['p1a', 'p1b', 'p1c'].map((id) => question(id, 'read', { type: 'reading_mcq', passage_id: 'p1' })),
      ...['p2a', 'p2b', 'p2c'].map((id) => question(id, 'read', { type: 'reading_mcq', passage_id: 'p2' })),
      ...pool('gram', 6),
    ] as Question[];
    for (let seed = 0; seed < 20; seed++) {
      const ordered = orderForSession(reading, seededRng(seed)).map((q) => q.passage_id ?? '-');
      const p1 = ordered.map((p, i) => (p === 'p1' ? i : -1)).filter((i) => i >= 0);
      expect(p1[2] - p1[0]).toBe(2);
    }
  });
});
