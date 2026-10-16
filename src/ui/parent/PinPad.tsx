import { useState } from 'preact/hooks';

/** Big 4-digit keypad. Calls onComplete with the PIN; returns false to shake & clear. */
export function PinPad({ title, onComplete, error }: { title: string; onComplete: (pin: string) => Promise<boolean | void> | void; error?: string }) {
  const [pin, setPin] = useState('');
  const [shake, setShake] = useState(false);
  const press = async (d: string) => {
    if (pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    if (next.length === 4) {
      const ok = await onComplete(next);
      setPin('');
      if (ok === false) {
        setShake(true);
        setTimeout(() => setShake(false), 500);
      }
    }
  };
  return (
    <div class="pinpad">
      <h2>{title}</h2>
      <div class={`pin-dots ${shake ? 'shake' : ''}`} aria-label={`${pin.length} of 4 digits entered`}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} class={i < pin.length ? 'filled' : ''} />
        ))}
      </div>
      {error && <p class="error-text">{error}</p>}
      <div class="keys">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} class="key" onClick={() => press(d)}>
            {d}
          </button>
        ))}
        <span />
        <button class="key" onClick={() => press('0')}>
          0
        </button>
        <button class="key" aria-label="Delete" onClick={() => setPin(pin.slice(0, -1))}>
          ⌫
        </button>
      </div>
    </div>
  );
}
