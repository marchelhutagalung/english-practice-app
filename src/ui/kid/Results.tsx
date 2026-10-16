import { starsFor } from '../../domain/stats';
import { Confetti, Stars } from '../widgets';
import type { SessionResult } from './Quiz';

export function Results({ result, onRetry, onHome }: { result: SessionResult; onRetry: () => void; onHome: () => void }) {
  const { correct, total, wrongIds, timedOut } = result;
  const stars = starsFor(correct, total);
  const pct = total ? Math.round((correct / total) * 100) : 0;
  const headline = stars === 3 ? 'Amazing!' : stars === 2 ? 'Great work!' : 'Good practice!';
  return (
    <div class="screen center results">
      {stars >= 2 && <Confetti />}
      <div class="card results-card">
        {timedOut && <p class="pill warn">⏰ Time is up!</p>}
        <h1>{headline}</h1>
        <Stars count={stars} />
        <p class="score">
          <strong>{correct}</strong> out of <strong>{total}</strong> correct ({pct}%)
        </p>
        <p class="muted">{result.spec.title}</p>
        <div class="stack">
          {wrongIds.length > 0 && (
            <button class="btn primary big" onClick={onRetry}>
              🔁 Try mistakes again ({wrongIds.length})
            </button>
          )}
          <button class={`btn big ${wrongIds.length ? 'ghost' : 'primary'}`} onClick={onHome}>
            🏠 Back home
          </button>
        </div>
      </div>
    </div>
  );
}
