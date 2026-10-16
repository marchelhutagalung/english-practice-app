import { useEffect, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { speak, stopSpeaking, ttsSupported } from '../tts';

export function SpeakerButton({ text, label = 'Read aloud', big = false }: { text: string; label?: string; big?: boolean }) {
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => () => stopSpeaking(), []);
  if (!ttsSupported()) return null;
  return (
    <button
      type="button"
      class={`btn speaker ${big ? 'big' : 'icon'} ${speaking ? 'speaking' : ''}`}
      aria-label={label}
      onClick={() => {
        // Must run synchronously inside the tap handler for iOS.
        setSpeaking(true);
        speak(text, { onEnd: () => setSpeaking(false) });
      }}
    >
      <span aria-hidden="true">{speaking ? '🔊' : '🔈'}</span>
      {big && <span>{label}</span>}
    </button>
  );
}

export function Stars({ count }: { count: 1 | 2 | 3 }) {
  return (
    <div class="stars" aria-label={`${count} of 3 stars`}>
      {[1, 2, 3].map((i) => (
        <span key={i} class={`star ${i <= count ? 'on' : ''}`} style={{ animationDelay: `${i * 0.25}s` }}>
          ★
        </span>
      ))}
    </div>
  );
}

const CONFETTI_COLORS = ['#ff8a5b', '#2ec4b6', '#9b5de5', '#f15bb5', '#fee440', '#5b6cff'];

/** CSS-only confetti: 60 absolutely positioned pieces with randomised keyframe params. */
export function Confetti() {
  const [pieces] = useState(() =>
    Array.from({ length: 60 }, (_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 1.2,
      duration: 2.4 + Math.random() * 1.8,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      rotate: Math.random() * 360,
      drift: (Math.random() - 0.5) * 160,
      round: i % 3 === 0,
    })),
  );
  return (
    <div class="confetti" aria-hidden="true">
      {pieces.map((p, i) => (
        <i
          key={i}
          class={p.round ? 'round' : ''}
          style={{
            left: `${p.left}%`,
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            '--r': `${p.rotate}deg`,
            '--dx': `${p.drift}px`,
          }}
        />
      ))}
    </div>
  );
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: ComponentChildren }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div class="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          type="button"
          key={String(o.value)}
          role="radio"
          aria-checked={o.value === value}
          class={o.value === value ? 'on' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function CategoryBadge({ category }: { category: string }) {
  return <span class={`badge cat-${category}`}>{category}</span>;
}

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
