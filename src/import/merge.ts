import type { DB } from '../db/db';
import type { Pack } from '../domain/schema';
import type { PackRecord } from '../domain/types';

type Kind = 'topics' | 'competitions' | 'passages' | 'questions';
const KINDS: Kind[] = ['topics', 'competitions', 'passages', 'questions'];

export interface KindDiff {
  added: number;
  updated: number;
  unchanged: number;
}

export interface ImportPreview {
  pack_id: string;
  title: string;
  version: number;
  /** Version already installed for this pack_id, if any. */
  installed_version?: number;
  kinds: Record<Kind, KindDiff>;
}

/** Stable JSON for content comparison (key order independent, pack_id ignored). */
function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v && typeof v === 'object') {
    const entries = Object.entries(v as Record<string, unknown>)
      .filter(([k, x]) => k !== 'pack_id' && x !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([k, x]) => `${JSON.stringify(k)}:${canonical(x)}`).join(',')}}`;
  }
  return JSON.stringify(v);
}

export async function previewImport(db: DB, pack: Pack): Promise<ImportPreview> {
  const tx = db.transaction([...KINDS, 'packs'], 'readonly');
  const kinds = {} as Record<Kind, KindDiff>;
  for (const kind of KINDS) {
    const store = tx.objectStore(kind);
    const diff: KindDiff = { added: 0, updated: 0, unchanged: 0 };
    for (const item of pack[kind]) {
      const existing = await store.get(item.id);
      if (!existing) diff.added++;
      else if (canonical(existing) === canonical(item)) diff.unchanged++;
      else diff.updated++;
    }
    kinds[kind] = diff;
  }
  const installed = await tx.objectStore('packs').get(pack.pack_id);
  await tx.done;
  return { pack_id: pack.pack_id, title: pack.title, version: pack.pack_version, installed_version: installed?.version, kinds };
}

/** "+12 new questions, 3 updated, 2 new topics" */
export function summarizePreview(p: ImportPreview): string {
  const parts: string[] = [];
  const label: Record<Kind, [string, string]> = {
    topics: ['topic', 'topics'],
    competitions: ['competition', 'competitions'],
    passages: ['passage', 'passages'],
    questions: ['question', 'questions'],
  };
  for (const kind of ['questions', 'topics', 'passages', 'competitions'] as Kind[]) {
    const d = p.kinds[kind];
    const [one, many] = label[kind];
    if (d.added) parts.push(`+${d.added} new ${d.added === 1 ? one : many}`);
    if (d.updated) parts.push(`${d.updated} ${d.updated === 1 ? one : many} updated`);
  }
  return parts.length ? parts.join(', ') : 'No changes — everything is already up to date';
}

/**
 * Upsert every item by id in ONE transaction (all or nothing).
 * Progress stores (profiles, answers, attempts, review_queue…) are never touched,
 * so re-importing a pack keeps all of a kid's history.
 */
export async function applyImport(db: DB, pack: Pack, opts: { builtin?: boolean; now?: number } = {}): Promise<void> {
  const tx = db.transaction([...KINDS, 'packs'], 'readwrite');
  for (const kind of KINDS) {
    const store = tx.objectStore(kind);
    for (const item of pack[kind]) {
      // Stores are typed per kind; the item shapes match their store by construction.
      await (store.put as (v: unknown) => Promise<unknown>)({ ...item, pack_id: pack.pack_id });
    }
  }
  const prev = await tx.objectStore('packs').get(pack.pack_id);
  const record: PackRecord = {
    pack_id: pack.pack_id,
    version: pack.pack_version,
    title: pack.title,
    imported_at: opts.now ?? Date.now(),
    builtin: opts.builtin ?? prev?.builtin ?? false,
  };
  await tx.objectStore('packs').put(record);
  await tx.done;
}

/**
 * Remove a pack's content (items it last wrote). Progress is kept.
 * Topics and passages that other packs' questions still use are kept too,
 * so deleting one pack never breaks another.
 */
export async function deletePack(db: DB, packId: string): Promise<number> {
  const tx = db.transaction([...KINDS, 'packs'], 'readwrite');
  let removed = 0;
  /** Delete the pack's items; an item still in use is handed over to a pack that uses it. */
  const deleteOwned = async (kind: Kind, newOwner: (id: string) => string | undefined = () => undefined) => {
    let cursor = await tx.objectStore(kind).index('pack_id').openCursor(packId);
    while (cursor) {
      const owner = newOwner(cursor.primaryKey);
      if (owner) await cursor.update({ ...cursor.value, pack_id: owner });
      else {
        await cursor.delete();
        removed++;
      }
      cursor = await cursor.continue();
    }
  };
  await deleteOwned('questions');
  await deleteOwned('competitions');
  const passageUser = new Map<string, string>();
  const topicUser = new Map<string, string>();
  for (const q of await tx.objectStore('questions').getAll()) {
    if (q.passage_id) passageUser.set(q.passage_id, q.pack_id);
    topicUser.set(q.topic_id, q.pack_id);
  }
  await deleteOwned('passages', (id) => passageUser.get(id));
  for (const p of await tx.objectStore('passages').getAll()) topicUser.set(p.topic_id, p.pack_id);
  for (const c of await tx.objectStore('competitions').getAll()) {
    for (const t of Object.keys(c.topic_weights)) topicUser.set(t, c.pack_id);
  }
  await deleteOwned('topics', (id) => topicUser.get(id));
  await tx.objectStore('packs').delete(packId);
  await tx.done;
  return removed;
}
