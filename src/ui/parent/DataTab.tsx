import { useEffect, useRef, useState } from 'preact/hooks';
import { getDb } from '../../db/db';
import { getSetting, listPacks, setSetting } from '../../db/repo';
import type { PackRecord } from '../../domain/types';
import type { Pack, PackIssue } from '../../domain/schema';
import { validatePackText } from '../../import/validate';
import { applyImport, deletePack, previewImport, summarizePreview, type ImportPreview } from '../../import/merge';
import { exportBank, exportProgress, parseBackup, restoreProgress } from '../../import/backup';
import { useContent } from '../content';
import { alertDialog, confirmDialog } from '../dialog';
import { readFileText, saveJson, today } from '../files';
import { formatDate } from '../widgets';

const MAX_ISSUES_SHOWN = 50;

export function DataTab({ onChange }: { onChange: () => Promise<void> }) {
  const content = useContent();
  const [packs, setPacks] = useState<PackRecord[]>([]);
  const [pending, setPending] = useState<{ pack: Pack; preview: ImportPreview; fileName: string } | null>(null);
  const [issues, setIssues] = useState<{ fileName: string; list: PackIssue[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const packInput = useRef<HTMLInputElement>(null);
  const backupInput = useRef<HTMLInputElement>(null);

  const refresh = () => listPacks().then((p) => setPacks(p.sort((a, b) => b.imported_at - a.imported_at)));
  useEffect(() => {
    void refresh();
  }, []);

  const countFor = (packId: string) => content.questions.filter((q) => q.pack_id === packId).length;

  const onPackFile = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // allow choosing the same file again
    if (!file) return;
    setIssues(null);
    const result = validatePackText(await readFileText(file));
    if (!result.ok) {
      setIssues({ fileName: file.name, list: result.issues });
      return;
    }
    const preview = await previewImport(await getDb(), result.pack);
    setPending({ pack: result.pack, preview, fileName: file.name });
  };

  const confirmImport = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      await applyImport(await getDb(), pending.pack);
      const removed = await getSetting<string[]>('removed_builtin_packs', []);
      if (removed.includes(pending.pack.pack_id)) await setSetting('removed_builtin_packs', removed.filter((id) => id !== pending.pack.pack_id));
      await content.reload();
      await refresh();
      const summary = summarizePreview(pending.preview);
      setPending(null);
      await alertDialog('Import complete ✓', summary);
    } catch (err) {
      await alertDialog('Import failed', `Nothing was changed. ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const removePack = async (p: PackRecord) => {
    const n = countFor(p.pack_id);
    const ok = await confirmDialog(`Delete "${p.title}"?`, {
      message: `This removes ${n} question${n === 1 ? '' : 's'} from this device (topics still used by other packs are kept). Kids' progress is kept. You can import the pack again later.`,
      okLabel: 'Delete pack',
      danger: true,
    });
    if (!ok) return;
    await deletePack(await getDb(), p.pack_id);
    if (p.builtin) {
      const removed = await getSetting<string[]>('removed_builtin_packs', []);
      await setSetting('removed_builtin_packs', [...new Set([...removed, p.pack_id])]);
    }
    await content.reload();
    await refresh();
  };

  const onBackupFile = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const parsed = parseBackup(await readFileText(file));
    if (!parsed.ok) return void alertDialog('Cannot restore', parsed.error);
    const b = parsed.backup;
    const ok = await confirmDialog('Restore this backup?', {
      message: `Backup from ${formatDate(b.exported_at)}: ${b.data.profiles.length} kid(s), ${b.data.answers.length} answers.\n\nThis REPLACES all kids, practice sets and progress on this iPad. The question bank and PIN are not changed.`,
      okLabel: 'Restore',
      danger: true,
    });
    if (!ok) return;
    await restoreProgress(await getDb(), b);
    await onChange();
    await alertDialog('Backup restored ✓');
  };

  return (
    <section class="data-tab">
      <div class="card">
        <h2>Question packs</h2>
        <div class="list">
          {packs.map((p) => (
            <div key={p.pack_id} class="list-item">
              <div class="grow">
                <strong>{p.title}</strong>
                <div class="muted">
                  {p.pack_id} · v{p.version} · {countFor(p.pack_id)} questions · imported {formatDate(p.imported_at)}
                  {p.builtin ? ' · built-in' : ''}
                </div>
              </div>
              <button class="btn small danger-ghost" onClick={() => removePack(p)}>
                Delete
              </button>
            </div>
          ))}
          {packs.length === 0 && <p class="muted">No packs installed.</p>}
        </div>
        <p class="muted">
          Bank: {content.questions.length} questions · {content.topics.length} topics · {content.passages.length} passages · {content.competitions.length} competitions
        </p>
        <input ref={packInput} type="file" accept=".json,application/json" hidden onChange={onPackFile} />
        <div class="row wrap">
          <button class="btn primary" onClick={() => packInput.current?.click()}>
            📥 Import pack (.json)
          </button>
          <button class="btn" onClick={async () => saveJson(`question-bank-${today()}.json`, await exportBank(await getDb()))}>
            📤 Export question bank
          </button>
        </div>
      </div>

      {issues && (
        <div class="card error-card" role="alert">
          <h2>❌ "{issues.fileName}" was not imported</h2>
          <p>
            Found {issues.list.length} problem{issues.list.length === 1 ? '' : 's'}. Nothing was changed — fix the file and import it again.
          </p>
          <ul class="issues">
            {issues.list.slice(0, MAX_ISSUES_SHOWN).map((i, k) => (
              <li key={k}>
                <strong>{i.item}</strong> → <code>{i.field}</code>: {i.message}
              </li>
            ))}
          </ul>
          {issues.list.length > MAX_ISSUES_SHOWN && <p class="muted">…and {issues.list.length - MAX_ISSUES_SHOWN} more.</p>}
          <button class="btn ghost" onClick={() => setIssues(null)}>
            Dismiss
          </button>
        </div>
      )}

      {pending && (
        <div class="modal-backdrop">
          <div class="modal" role="dialog" aria-modal="true" aria-labelledby="imp-title">
            <h2 id="imp-title">Import "{pending.preview.title}"?</h2>
            <p class="muted">
              {pending.fileName} · {pending.preview.pack_id} v{pending.preview.version}
            </p>
            {pending.preview.installed_version !== undefined && (
              <p class={pending.preview.installed_version > pending.preview.version ? 'warn-text' : 'muted'}>
                Installed version: v{pending.preview.installed_version}
                {pending.preview.installed_version > pending.preview.version ? ' — this file is OLDER than what is installed.' : ''}
              </p>
            )}
            <p class="preview-summary">{summarizePreview(pending.preview)}</p>
            <table class="preview-table">
              <thead>
                <tr>
                  <th />
                  <th>New</th>
                  <th>Updated</th>
                  <th>Same</th>
                </tr>
              </thead>
              <tbody>
                {(['questions', 'topics', 'passages', 'competitions'] as const).map((k) => (
                  <tr key={k}>
                    <th>{k}</th>
                    <td>{pending.preview.kinds[k].added}</td>
                    <td>{pending.preview.kinds[k].updated}</td>
                    <td>{pending.preview.kinds[k].unchanged}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p class="muted">Items are matched by id. Kids' progress is never removed.</p>
            <div class="row end">
              <button class="btn ghost" disabled={busy} onClick={() => setPending(null)}>
                Cancel
              </button>
              <button class="btn primary" disabled={busy} onClick={confirmImport}>
                {busy ? 'Importing…' : 'Import'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div class="card">
        <h2>Progress backup</h2>
        <p class="muted">Kids, practice sets, answers and review queue. Keep a copy in the Files app or iCloud Drive.</p>
        <input ref={backupInput} type="file" accept=".json,application/json" hidden onChange={onBackupFile} />
        <div class="row wrap">
          <button class="btn primary" onClick={async () => saveJson(`english-practice-backup-${today()}.json`, await exportProgress(await getDb()))}>
            💾 Export backup
          </button>
          <button class="btn" onClick={() => backupInput.current?.click()}>
            ♻️ Restore backup
          </button>
        </div>
      </div>
    </section>
  );
}
