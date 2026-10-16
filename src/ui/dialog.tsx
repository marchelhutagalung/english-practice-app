import { useEffect, useState } from 'preact/hooks';

/** Promise-based in-app dialogs (bigger and friendlier than window.confirm on iPad). */
interface DialogRequest {
  title: string;
  message?: string;
  okLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  resolve: (ok: boolean) => void;
}

let current: DialogRequest | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function confirmDialog(title: string, opts: { message?: string; okLabel?: string; danger?: boolean } = {}): Promise<boolean> {
  return new Promise((resolve) => {
    current = { title, message: opts.message, okLabel: opts.okLabel ?? 'OK', cancelLabel: 'Cancel', danger: opts.danger, resolve };
    emit();
  });
}

export function alertDialog(title: string, message?: string): Promise<void> {
  return new Promise((resolve) => {
    current = { title, message, okLabel: 'OK', resolve: () => resolve() };
    emit();
  });
}

export function DialogHost() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => listeners.delete(l);
  }, []);
  if (!current) return null;
  const req = current;
  const close = (ok: boolean) => {
    current = null;
    emit();
    req.resolve(ok);
  };
  return (
    <div class="modal-backdrop" role="presentation">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="dlg-title">
        <h2 id="dlg-title">{req.title}</h2>
        {req.message && <p class="pre-line">{req.message}</p>}
        <div class="row end">
          {req.cancelLabel && (
            <button class="btn ghost" onClick={() => close(false)}>
              {req.cancelLabel}
            </button>
          )}
          <button class={`btn ${req.danger ? 'danger' : 'primary'}`} onClick={() => close(true)}>
            {req.okLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
