import { render } from 'preact';
import './styles.css';
import { App } from './ui/App';
import { ContentProvider } from './ui/content';
import { ensureBuiltinPack, getSetting, setSetting } from './db/repo';
import { validatePack } from './import/validate';
import { setTtsPrefs, type TtsPrefs } from './tts';
import sample from './data/sample-grade3.json';

async function bootstrap() {
  // Ask the browser not to evict our IndexedDB data (first launch only; harmless if repeated).
  if (!(await getSetting('persist_requested', false))) {
    try {
      await navigator.storage?.persist?.();
    } catch {
      /* not supported */
    }
    await setSetting('persist_requested', true);
  }

  // Install or upgrade the built-in pack (upsert; never touches progress) unless a parent removed it.
  const removed = await getSetting<string[]>('removed_builtin_packs', []);
  const result = validatePack(sample);
  if (result.ok && !removed.includes(result.pack.pack_id)) await ensureBuiltinPack(result.pack);
  else if (!result.ok) console.error('Built-in pack is invalid', result.issues);

  setTtsPrefs(await getSetting<Partial<TtsPrefs>>('tts', {}));
}

const root = document.getElementById('app')!;
bootstrap()
  .catch((e) => console.error('Startup problem', e))
  .finally(() =>
    render(
      <ContentProvider>
        <App />
      </ContentProvider>,
      root,
    ),
  );
