import { z } from 'zod';
import type { DB } from '../db/db';
import { PROGRESS_STORES } from '../db/db';
import type { Pack } from '../domain/schema';

export const BACKUP_APP = 'english-practice-backup';

const BackupSchema = z.object({
  app: z.literal(BACKUP_APP),
  backup_version: z.literal(1),
  exported_at: z.number(),
  data: z.object({
    profiles: z.array(z.object({ id: z.string(), name: z.string(), grade: z.number() }).passthrough()),
    practice_sets: z.array(z.object({ id: z.string(), profile_id: z.string() }).passthrough()),
    attempts: z.array(z.object({ id: z.string(), profile_id: z.string() }).passthrough()),
    answers: z.array(
      z.object({ profile_id: z.string(), question_id: z.string(), topic_id: z.string(), correct: z.boolean(), answered_at: z.number() }).passthrough(),
    ),
    review_queue: z.array(z.object({ profile_id: z.string(), question_id: z.string(), box: z.number() }).passthrough()),
    settings: z.array(z.object({ key: z.string(), value: z.unknown() })).default([]),
  }),
});
export type Backup = z.infer<typeof BackupSchema>;

/** Settings that are never exported/restored (the parent PIN stays on the device). */
const PRIVATE_SETTINGS = new Set(['pin_hash', 'pin_salt']);

export async function exportProgress(db: DB, now = Date.now()): Promise<Backup> {
  const data: Record<string, unknown[]> = {};
  for (const store of PROGRESS_STORES) data[store] = await db.getAll(store);
  data.settings = (await db.getAll('settings')).filter((s) => !PRIVATE_SETTINGS.has(s.key));
  return { app: BACKUP_APP, backup_version: 1, exported_at: now, data: data as Backup['data'] };
}

export function parseBackup(text: string): { ok: true; backup: Backup } | { ok: false; error: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'This file is not valid JSON.' };
  }
  const r = BackupSchema.safeParse(raw);
  if (!r.success) {
    const first = r.error.issues[0];
    return { ok: false, error: `Not a progress backup file (${first.path.join('.') || 'root'}: ${first.message}).` };
  }
  return { ok: true, backup: r.data };
}

/** Replace all progress with the backup's contents, in one transaction. Content stores are untouched. */
export async function restoreProgress(db: DB, backup: Backup): Promise<void> {
  const tx = db.transaction([...PROGRESS_STORES, 'settings'], 'readwrite');
  for (const store of PROGRESS_STORES) {
    const s = tx.objectStore(store);
    await s.clear();
    for (const row of backup.data[store]) await (s.put as (v: unknown) => Promise<unknown>)(row);
  }
  const settings = tx.objectStore('settings');
  for (const row of backup.data.settings) if (!PRIVATE_SETTINGS.has(row.key)) await settings.put({ key: row.key, value: row.value });
  await tx.done;
}

/** Export everything in the bank as one importable pack. */
export async function exportBank(db: DB, now = Date.now()): Promise<Pack> {
  const strip = <T extends { pack_id?: string }>(rows: T[]) => rows.map(({ pack_id: _p, ...rest }) => rest);
  return {
    schema_version: 1,
    pack_id: 'question-bank-export',
    pack_version: Math.floor(now / 1000),
    title: `Question bank export ${new Date(now).toISOString().slice(0, 10)}`,
    topics: strip(await db.getAll('topics')),
    competitions: strip(await db.getAll('competitions')),
    passages: strip(await db.getAll('passages')),
    questions: strip(await db.getAll('questions')),
  } as Pack;
}
