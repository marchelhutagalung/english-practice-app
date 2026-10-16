import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { openAppDb, type DB } from '../src/db/db';
import { applyImport, deletePack, previewImport, summarizePreview } from '../src/import/merge';
import { recordAnswer } from '../src/db/repo';
import { exportProgress, parseBackup, restoreProgress } from '../src/import/backup';
import { makePack, question } from './fixtures';

let db: DB;
let n = 0;
beforeEach(async () => {
  db = await openAppDb(`test-merge-${n++}`);
});

describe('import upsert merge', () => {
  it('previews new / updated / unchanged items', async () => {
    const pack = makePack();
    const first = await previewImport(db, pack);
    expect(first.kinds.questions).toEqual({ added: 2, updated: 0, unchanged: 0 });
    expect(first.kinds.topics.added).toBe(2);
    expect(summarizePreview(first)).toBe('+2 new questions, +2 new topics');

    await applyImport(db, pack);
    const v2 = makePack({ pack_version: 2 });
    v2.questions[0] = { ...v2.questions[0], explanation: 'Better explanation.' };
    v2.questions.push(question('q3', 't-a'));
    const second = await previewImport(db, v2);
    expect(second.installed_version).toBe(1);
    expect(second.kinds.questions).toEqual({ added: 1, updated: 1, unchanged: 1 });
    expect(summarizePreview(second)).toBe('+1 new question, 1 question updated');
  });

  it('keeps progress when a pack is re-imported', async () => {
    const pack = makePack();
    await applyImport(db, pack);
    await db.put('profiles', { id: 'kid', name: 'Ana', grade: 3, avatar: '🐱', created_at: 1 });
    await recordAnswer({ attempt_id: 'a1', profile_id: 'kid', question_id: 'q1', topic_id: 't-a', given: 'on', correct: false, time_ms: 900, answered_at: 1000 }, db);

    const v2 = makePack({ pack_version: 2 });
    v2.questions[0] = { ...v2.questions[0], prompt: 'The dog is ___ the box.' };
    await applyImport(db, v2);

    expect(await db.count('answers')).toBe(1);
    expect(await db.get('profiles', 'kid')).toBeDefined();
    expect(await db.get('review_queue', ['kid', 'q1'])).toMatchObject({ box: 1 });
    expect((await db.get('questions', 'q1'))?.prompt).toBe('The dog is ___ the box.');
    expect(await db.count('questions')).toBe(2);
    expect((await db.get('packs', 'test-pack'))?.version).toBe(2);
  });

  it('upserts by id across packs and deleting a pack keeps progress', async () => {
    await applyImport(db, makePack());
    const other = makePack({ pack_id: 'other', questions: [question('q9', 't-a')] });
    await applyImport(db, other);
    expect(await db.count('questions')).toBe(3);
    await recordAnswer({ attempt_id: 'a', profile_id: 'kid', question_id: 'q9', topic_id: 't-a', given: 'a', correct: true, time_ms: 1, answered_at: 1 }, db);

    await deletePack(db, 'other');
    expect(await db.get('questions', 'q9')).toBeUndefined();
    expect(await db.count('questions')).toBe(2);
    // topics t-a/t-b were last written by "other" but test-pack questions still use them
    expect(await db.count('topics')).toBe(2);
    expect(await db.count('answers')).toBe(1);
    expect(await db.get('packs', 'other')).toBeUndefined();

    await deletePack(db, 'test-pack');
    expect(await db.count('questions')).toBe(0);
    expect(await db.count('topics')).toBe(0);
  });

  it('round-trips a progress backup without touching content', async () => {
    await applyImport(db, makePack());
    await db.put('profiles', { id: 'kid', name: 'Ana', grade: 3, avatar: '🐱', created_at: 1 });
    await db.put('settings', { key: 'pin_hash', value: 'secret' });
    await recordAnswer({ attempt_id: 'a1', profile_id: 'kid', question_id: 'q1', topic_id: 't-a', given: 'on', correct: false, time_ms: 900, answered_at: 1000 }, db);
    const backup = await exportProgress(db);
    expect(backup.data.settings.find((s) => s.key === 'pin_hash')).toBeUndefined();

    await db.clear('answers');
    await db.clear('profiles');
    const parsed = parseBackup(JSON.stringify(backup));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) await restoreProgress(db, parsed.backup);
    expect(await db.count('answers')).toBe(1);
    expect(await db.count('profiles')).toBe(1);
    expect(await db.count('questions')).toBe(2);
    expect(parseBackup('{"app":"nope"}').ok).toBe(false);
  });
});
