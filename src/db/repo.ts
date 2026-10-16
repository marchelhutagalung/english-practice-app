import { getDb, PROGRESS_STORES, type DB } from './db';
import { scheduleReview, dueEntries } from '../domain/leitner';
import { newId } from '../domain/random';
import type {
  AnswerRecord,
  Attempt,
  AttemptMode,
  PackRecord,
  PracticeSet,
  Profile,
  ReviewEntry,
  StoredCompetition,
  StoredPassage,
  StoredQuestion,
  StoredTopic,
} from '../domain/types';
import type { Pack } from '../domain/schema';
import { applyImport } from '../import/merge';

// ---------- settings ----------
export async function getSetting<T>(key: string, fallback: T, db?: DB): Promise<T> {
  const d = db ?? (await getDb());
  const row = await d.get('settings', key);
  return row === undefined ? fallback : (row.value as T);
}
export async function setSetting(key: string, value: unknown, db?: DB): Promise<void> {
  const d = db ?? (await getDb());
  await d.put('settings', { key, value });
}

// ---------- content ----------
export const listTopics = async (): Promise<StoredTopic[]> => (await getDb()).getAll('topics');
export const listCompetitions = async (): Promise<StoredCompetition[]> => (await getDb()).getAll('competitions');
export const listQuestions = async (): Promise<StoredQuestion[]> => (await getDb()).getAll('questions');
export const listPassages = async (): Promise<StoredPassage[]> => (await getDb()).getAll('passages');
export const listPacks = async (): Promise<PackRecord[]> => (await getDb()).getAll('packs');

/** Install / refresh the bundled pack when it is missing or older than the bundled copy. */
export async function ensureBuiltinPack(pack: Pack, db?: DB): Promise<boolean> {
  const d = db ?? (await getDb());
  const installed = await d.get('packs', pack.pack_id);
  if (installed && installed.version >= pack.pack_version) return false;
  await applyImport(d, pack, { builtin: true });
  return true;
}

// ---------- profiles ----------
export const listProfiles = async (): Promise<Profile[]> =>
  (await (await getDb()).getAll('profiles')).sort((a, b) => a.created_at - b.created_at);

export async function saveProfile(p: Omit<Profile, 'id' | 'created_at'> & Partial<Pick<Profile, 'id' | 'created_at'>>): Promise<Profile> {
  const profile: Profile = { ...p, id: p.id ?? newId(), created_at: p.created_at ?? Date.now() };
  await (await getDb()).put('profiles', profile);
  return profile;
}

/** Delete a profile and everything that belongs to it. */
export async function deleteProfile(profileId: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction([...PROGRESS_STORES], 'readwrite');
  await tx.objectStore('profiles').delete(profileId);
  for (const store of ['practice_sets', 'attempts', 'answers', 'review_queue'] as const) {
    const index = tx.objectStore(store).index('profile_id');
    let cursor = await index.openCursor(profileId);
    while (cursor) {
      await cursor.delete();
      cursor = await cursor.continue();
    }
  }
  await tx.done;
}

// ---------- practice sets ----------
export const listSets = async (profileId: string): Promise<PracticeSet[]> =>
  (await (await getDb()).getAllFromIndex('practice_sets', 'profile_id', profileId)).sort((a, b) => b.created_at - a.created_at);
export const saveSet = async (s: PracticeSet) => (await getDb()).put('practice_sets', s);
export const deleteSet = async (id: string) => (await getDb()).delete('practice_sets', id);

// ---------- attempts & answers ----------
export async function startAttempt(a: { profile_id: string; mode: AttemptMode; set_id?: string; title: string; question_ids: string[] }): Promise<Attempt> {
  const attempt: Attempt = { ...a, id: newId(), started_at: Date.now(), correct: 0, total: a.question_ids.length };
  await (await getDb()).put('attempts', attempt);
  return attempt;
}

export async function finishAttempt(attempt: Attempt, correct: number, timedOut: boolean): Promise<Attempt> {
  const done: Attempt = { ...attempt, correct, finished_at: Date.now(), timed_out: timedOut || undefined };
  await (await getDb()).put('attempts', done);
  return done;
}

/** Store an answer and update the Leitner queue atomically. */
export async function recordAnswer(rec: Omit<AnswerRecord, 'id'>, db?: DB): Promise<void> {
  const d = db ?? (await getDb());
  const tx = d.transaction(['answers', 'review_queue'], 'readwrite');
  await tx.objectStore('answers').add(rec as AnswerRecord);
  const rq = tx.objectStore('review_queue');
  const key: [string, string] = [rec.profile_id, rec.question_id];
  const current = await rq.get(key);
  const next = scheduleReview(current, rec.correct, { profile_id: rec.profile_id, question_id: rec.question_id }, rec.answered_at);
  if (next) await rq.put(next);
  else if (current) await rq.delete(key);
  await tx.done;
}

export const answersForProfile = async (profileId: string): Promise<AnswerRecord[]> =>
  (await getDb()).getAllFromIndex('answers', 'profile_id', profileId);

export const attemptsForProfile = async (profileId: string): Promise<Attempt[]> =>
  (await (await getDb()).getAllFromIndex('attempts', 'profile_id', profileId)).sort((a, b) => b.started_at - a.started_at);

export async function reviewQueue(profileId: string): Promise<ReviewEntry[]> {
  return (await getDb()).getAllFromIndex('review_queue', 'profile_id', profileId);
}

export async function dueReviews(profileId: string, now = Date.now()): Promise<ReviewEntry[]> {
  return dueEntries(await reviewQueue(profileId), now);
}
