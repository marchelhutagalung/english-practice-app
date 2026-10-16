import { useEffect, useState } from 'preact/hooks';
import { checkPin, hasPin, setPin } from '../../pin';
import { PinPad } from './PinPad';

export function PinGate({ onUnlock, onCancel }: { onUnlock: () => void; onCancel: () => void }) {
  const [mode, setMode] = useState<'loading' | 'enter' | 'create' | 'confirm'>('loading');
  const [first, setFirst] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    void hasPin().then((h) => setMode(h ? 'enter' : 'create'));
  }, []);

  return (
    <div class="screen center">
      <div class="card pin-card">
        {mode === 'enter' && (
          <PinPad
            title="🔒 Parent PIN"
            error={error}
            onComplete={async (p) => {
              if (await checkPin(p)) return onUnlock();
              setError('That PIN is not right. Try again.');
              return false;
            }}
          />
        )}
        {mode === 'create' && (
          <>
            <p class="muted center-text">First time here! Choose a 4-digit PIN so only grown-ups can open Parent mode.</p>
            <PinPad
              title="Create a parent PIN"
              onComplete={(p) => {
                setFirst(p);
                setError('');
                setMode('confirm');
              }}
            />
          </>
        )}
        {mode === 'confirm' && (
          <PinPad
            title="Type the PIN again"
            error={error}
            onComplete={async (p) => {
              if (p !== first) {
                setError('The PINs did not match. Start again.');
                setMode('create');
                return false;
              }
              await setPin(p);
              onUnlock();
            }}
          />
        )}
        <button class="btn ghost full" onClick={onCancel}>
          ← Back to kids
        </button>
      </div>
    </div>
  );
}
