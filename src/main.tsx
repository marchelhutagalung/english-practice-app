import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import './styles.css';
import { App } from './ui/App';
import { ContentProvider } from './ui/content';
import { ensureBuiltinPack, getSetting, setSetting } from './db/repo';
import { validatePack } from './import/validate';
import { setTtsPrefs, type TtsPrefs } from './tts';
import sample from './data/sample-grade3.json';

const STARTUP_TIMEOUT_MS = 15_000;

async function bootstrap() {
  // Ask the browser not to evict our IndexedDB data. Never awaited: some browsers
  // show a prompt or never settle, and startup must not wait on it.
  if (!(await getSetting('persist_requested', false))) {
    void Promise.resolve()
      .then(() => navigator.storage?.persist?.())
      .catch(() => undefined);
    await setSetting('persist_requested', true);
  }

  // Install or upgrade the built-in pack (upsert; never touches progress) unless a parent removed it.
  const removed = await getSetting<string[]>('removed_builtin_packs', []);
  const result = validatePack(sample);
  if (result.ok && !removed.includes(result.pack.pack_id)) await ensureBuiltinPack(result.pack);
  else if (!result.ok) console.error('Built-in pack is invalid', result.issues);

  setTtsPrefs(await getSetting<Partial<TtsPrefs>>('tts', {}));
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('The on-device database did not open in time.')), ms);
    p.then(
      (v) => (clearTimeout(t), resolve(v)),
      (e) => (clearTimeout(t), reject(e)),
    );
  });
}

function Root() {
  const [state, setState] = useState<'loading' | 'ready' | { error: string }>('loading');
  useEffect(() => {
    withTimeout(bootstrap(), STARTUP_TIMEOUT_MS).then(
      () => setState('ready'),
      (e) => {
        console.error('Startup problem', e);
        setState({ error: e instanceof Error ? e.message : String(e) });
      },
    );
  }, []);

  if (state === 'loading') {
    return (
      <div class="screen center">
        <p class="big-emoji" aria-hidden="true">
          🦉
        </p>
        <p>Getting ready…</p>
      </div>
    );
  }
  if (state !== 'ready') {
    return (
      <div class="screen center">
        <div class="card center-text">
          <p class="big-emoji" aria-hidden="true">
            😕
          </p>
          <h2>The app could not start</h2>
          <p class="muted">{state.error}</p>
          <p class="muted">
            Private Browsing or blocked website data can stop the app from saving. Try normal Safari, or add the app to the Home Screen.
          </p>
          <button class="btn primary" onClick={() => location.reload()}>
            Try again
          </button>
        </div>
      </div>
    );
  }
  return (
    <ContentProvider>
      <App />
    </ContentProvider>
  );
}

const root = document.getElementById('app')!;
root.textContent = '';
render(<Root />, root);
