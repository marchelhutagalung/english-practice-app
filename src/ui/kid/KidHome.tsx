import { useEffect, useState } from 'preact/hooks';
import { useContent } from '../content';
import { answersForProfile, dueReviews, listSets } from '../../db/repo';
import type { PracticeSet, Profile } from '../../domain/types';
import { buildSetQuestions, freePracticeWeights, timeLimitMinutes } from '../../domain/session';
import { sampleQuestions } from '../../domain/sampling';
import { streakDays } from '../../domain/stats';
import type { SessionSpec } from './Quiz';
import { alertDialog } from '../dialog';

const FREE = [
  { value: 'mix', label: 'Mix', emoji: '🎲' },
  { value: 'grammar', label: 'Grammar', emoji: '✏️' },
  { value: 'vocabulary', label: 'Words', emoji: '🔤' },
  { value: 'reading', label: 'Reading', emoji: '📖' },
  { value: 'listening', label: 'Listening', emoji: '🎧' },
] as const;

const REVIEW_SIZE = 10;
const FREE_SIZE = 10;

export function KidHome({ profile, onStart, onBack }: { profile: Profile; onStart: (s: SessionSpec) => void; onBack: () => void }) {
  const content = useContent();
  const [sets, setSets] = useState<PracticeSet[]>([]);
  const [dueIds, setDueIds] = useState<string[] | null>(null);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    void listSets(profile.id).then(setSets);
    void dueReviews(profile.id).then((d) => setDueIds(d.map((e) => e.question_id)));
    void answersForProfile(profile.id).then((a) => setStreak(streakDays(a.map((x) => x.answered_at), Date.now())));
  }, [profile.id]);

  const reviewIds = (dueIds ?? []).filter((id) => content.questionById.has(id));

  const startSet = (set: PracticeSet) => {
    const qs = buildSetQuestions(set, content.questions, content.competitions);
    if (!qs.length) return void alertDialog('No questions yet', 'This practice has no questions. Ask a grown-up to check it.');
    onStart({
      profile,
      mode: 'set',
      setId: set.id,
      title: set.name,
      questionIds: qs.map((q) => q.id),
      timeLimitMin: set.timed ? timeLimitMinutes(set, content.competitions) : undefined,
    });
  };

  const startFree = (category: string) => {
    const weights = freePracticeWeights(content.topics, profile.grade, category);
    const qs = sampleQuestions(content.questions, { weights, count: FREE_SIZE });
    if (!qs.length) return void alertDialog('No questions yet', 'There are no questions for this choice yet.');
    const label = FREE.find((f) => f.value === category)?.label ?? 'Mix';
    onStart({ profile, mode: 'free', title: `Free practice: ${label}`, questionIds: qs.map((q) => q.id) });
  };

  const startReview = () => {
    onStart({ profile, mode: 'review', title: 'Review mistakes', questionIds: reviewIds.slice(0, REVIEW_SIZE) });
  };

  return (
    <div class="screen">
      <header class="kid-header">
        <button class="btn ghost" onClick={onBack} aria-label="Change player">
          ← Players
        </button>
        <div class="kid-hello">
          <span class="avatar small" aria-hidden="true">
            {profile.avatar}
          </span>
          <h1>Hi, {profile.name}!</h1>
        </div>
        <div class="pill" title="Days in a row">
          🔥 {streak} day{streak === 1 ? '' : 's'}
        </div>
      </header>

      <section>
        <h2 class="section-title">⭐ Today's practice</h2>
        {sets.length === 0 ? (
          <p class="card muted">No practice assigned yet. Try free practice below!</p>
        ) : (
          <div class="set-list">
            {sets.map((s) => (
              <button key={s.id} class="set-card" onClick={() => startSet(s)}>
                <span class="set-name">{s.name}</span>
                <span class="muted">
                  {s.question_count} questions{s.timed ? ` · ⏱ ${timeLimitMinutes(s, content.competitions)} min` : ''}
                </span>
                <span class="go" aria-hidden="true">
                  ▶
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 class="section-title">🎈 Free practice</h2>
        <div class="free-grid">
          {FREE.map((f) => (
            <button key={f.value} class={`free-card cat-${f.value}`} onClick={() => startFree(f.value)}>
              <span class="emoji" aria-hidden="true">
                {f.emoji}
              </span>
              {f.label}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 class="section-title">🔁 Review mistakes</h2>
        <button class="btn big review-btn" disabled={reviewIds.length === 0} onClick={startReview}>
          {dueIds === null ? '…' : reviewIds.length === 0 ? 'Nothing to review — great!' : `Review ${Math.min(reviewIds.length, REVIEW_SIZE)} question${reviewIds.length === 1 ? '' : 's'}`}
        </button>
      </section>
    </div>
  );
}
