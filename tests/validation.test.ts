import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { validatePack, validatePackText } from '../src/import/validate';
import { makePack } from './fixtures';

describe('pack validation', () => {
  it('accepts the built-in sample pack and it meets the content requirements', () => {
    const r = validatePackText(readFileSync('src/data/sample-grade3.json', 'utf8'));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const g3 = r.pack.questions.filter((q) => q.grade === 3);
    expect(g3.length).toBeGreaterThanOrEqual(60);
    expect(r.pack.questions.filter((q) => q.type === 'listening_mcq').length).toBeGreaterThanOrEqual(5);
    expect(r.pack.passages.length).toBe(6);
    for (const p of r.pack.passages) {
      const n = r.pack.questions.filter((q) => q.passage_id === p.id).length;
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(4);
    }
    expect(r.pack.competitions.map((c) => c.grade).sort()).toEqual([3, 5]);
  });

  it('accepts the full example in README.md', () => {
    const readme = readFileSync('README.md', 'utf8');
    const json = readme.match(/### Full example\n\n```json\n([\s\S]*?)```/)?.[1];
    expect(json).toBeTruthy();
    const r = validatePackText(json!);
    expect(r.ok ? [] : r.issues).toEqual([]);
  });

  it('accepts a minimal valid pack and defaults missing arrays', () => {
    const r = validatePack({ schema_version: 1, pack_id: 'p', pack_version: 1, title: 'P' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.pack.questions).toEqual([]);
  });

  it('reports which item and which field is wrong', () => {
    const pack = makePack();
    (pack.questions[1] as Record<string, unknown>).answer = 'kitty';
    const r = validatePack(pack);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.issues).toContainEqual(expect.objectContaining({ item: 'questions[1] (id "q2")', field: 'answer' }));
  });

  it('reports missing required fields and unknown fields', () => {
    const pack = makePack() as unknown as { questions: Record<string, unknown>[] };
    delete pack.questions[0].explanation;
    pack.questions[1].colour = 'red';
    const r = validatePack(pack);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.issues).toContainEqual({ item: 'questions[0] (id "q1")', field: 'explanation', message: 'is required' });
    expect(r.issues.some((i) => i.item.startsWith('questions[1]') && /colour/.test(i.message))).toBe(true);
  });

  it('enforces per-type rules', () => {
    const bad = [
      { type: 'mcq', options: undefined },
      { type: 'reading_mcq' }, // no passage_id
      { type: 'listening_mcq' }, // no tts_text
      { type: 'mcq', options: ['in', 'In', 'on'] }, // duplicate options
      { type: 'true_false', options: undefined, answer: 'Yes' },
      { type: 'fill_blank', prompt: 'No blank here', options: undefined },
    ];
    for (const patch of bad) {
      const pack = makePack();
      Object.assign(pack.questions[0], patch);
      expect(validatePack(pack).ok, JSON.stringify(patch)).toBe(false);
    }
  });

  it('rejects broken references and duplicate ids (whole file, no partial import)', () => {
    const pack = makePack({
      competitions: [{ id: 'c', name: 'C', grade: 3, format: { question_count: 10, time_limit_min: 10 }, topic_weights: { 't-missing': 1 } }],
    });
    pack.questions.push({ ...pack.questions[0] });
    pack.questions[1].topic_id = 'nope';
    const r = validatePack(pack);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    const fields = r.issues.map((i) => `${i.item}|${i.field}`);
    expect(fields).toContain('competitions[0] (id "c")|topic_weights.t-missing');
    expect(fields).toContain('questions[1] (id "q2")|topic_id');
    expect(fields).toContain('questions[2] (id "q1")|id');
  });

  it('reports invalid JSON clearly', () => {
    const r = validatePackText('{ not json');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues[0].message).toMatch(/not valid JSON/);
  });
});
