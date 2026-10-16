import { useEffect, useState } from 'preact/hooks';
import { useContent } from '../content';
import { answersForProfile, attemptsForProfile, reviewQueue } from '../../db/repo';
import type { AnswerRecord, Attempt, Profile, ReviewEntry } from '../../domain/types';
import { streakDays, topicAccuracy, WEAK_THRESHOLD, WEAK_WINDOW } from '../../domain/stats';
import { formatDate } from '../widgets';

export function ProgressTab({ profile }: { profile: Profile }) {
  const { topicById } = useContent();
  const [answers, setAnswers] = useState<AnswerRecord[] | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [queue, setQueue] = useState<ReviewEntry[]>([]);

  useEffect(() => {
    void answersForProfile(profile.id).then(setAnswers);
    void attemptsForProfile(profile.id).then(setAttempts);
    void reviewQueue(profile.id).then(setQueue);
  }, [profile.id]);

  if (!answers) return <p class="muted">Loading…</p>;

  const total = answers.length;
  const correct = answers.filter((a) => a.correct).length;
  const streak = streakDays(answers.map((a) => a.answered_at), Date.now());
  const perTopic = topicAccuracy(answers, WEAK_WINDOW);
  const recent = attempts.filter((a) => a.finished_at).slice(0, 10);

  return (
    <section class="progress-tab">
      <div class="stat-row">
        <div class="stat">
          <div class="stat-value">{total}</div>
          <div class="stat-label">questions answered</div>
        </div>
        <div class="stat">
          <div class="stat-value">{total ? Math.round((correct / total) * 100) : 0}%</div>
          <div class="stat-label">overall accuracy</div>
        </div>
        <div class="stat">
          <div class="stat-value">🔥 {streak}</div>
          <div class="stat-label">day streak</div>
        </div>
        <div class="stat">
          <div class="stat-value">{queue.length}</div>
          <div class="stat-label">in review queue</div>
        </div>
      </div>

      <div class="card">
        <h2>Accuracy by topic</h2>
        <p class="muted">Last {WEAK_WINDOW} answers per topic, weakest first. Red = below {Math.round(WEAK_THRESHOLD * 100)}%.</p>
        {perTopic.length === 0 && <p class="muted">No answers yet.</p>}
        <ul class="bars">
          {perTopic.map((t) => {
            const pct = Math.round(t.accuracy * 100);
            const cls = t.accuracy < WEAK_THRESHOLD ? 'low' : t.accuracy < 0.9 ? 'mid' : 'high';
            return (
              <li key={t.topic_id}>
                <div class="bar-label">
                  <span>{topicById.get(t.topic_id)?.name ?? `${t.topic_id} (removed)`}</span>
                  <span class="muted">
                    {pct}% · {t.correct}/{t.total}
                  </span>
                </div>
                <div class="bar-track" role="img" aria-label={`${pct} percent`}>
                  <div class={`bar-fill ${cls}`} style={{ width: `${Math.max(pct, 2)}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div class="card">
        <h2>Recent sessions</h2>
        {recent.length === 0 && <p class="muted">No finished sessions yet.</p>}
        <ul class="sessions">
          {recent.map((a) => (
            <li key={a.id}>
              <div>
                <strong>{a.title}</strong>
                <div class="muted">
                  {formatDate(a.started_at)}
                  {a.timed_out ? ' · time ran out' : ''}
                </div>
              </div>
              <span class="pill">
                {a.correct}/{a.total}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
