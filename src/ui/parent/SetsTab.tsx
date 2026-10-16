import { useEffect, useMemo, useState } from 'preact/hooks';
import { useContent } from '../content';
import { answersForProfile, deleteSet, listSets, saveSet } from '../../db/repo';
import type { Difficulty, PracticeSet, Profile, SetSource } from '../../domain/types';
import { CATEGORIES } from '../../domain/schema';
import { topicsNearGrade } from '../../domain/grade';
import { matchesDifficulty } from '../../domain/sampling';
import { weakTopics, WEAK_WINDOW, type TopicAccuracy } from '../../domain/stats';
import { timeLimitMinutes } from '../../domain/session';
import { newId } from '../../domain/random';
import { CategoryBadge, Segmented } from '../widgets';
import { confirmDialog } from '../dialog';

const COUNTS = [5, 10, 15, 20, 30];

export function SetsTab({ profile }: { profile: Profile }) {
  const content = useContent();
  const [sets, setSets] = useState<PracticeSet[]>([]);
  const [creating, setCreating] = useState(false);
  const refresh = () => listSets(profile.id).then(setSets);
  useEffect(() => {
    void refresh();
  }, [profile.id]);

  const describe = (s: PracticeSet) => {
    if (s.source === 'competition') return `Competition: ${content.competitions.find((c) => c.id === s.competition_id)?.name ?? 'missing'}`;
    const names = s.topic_ids.map((id) => content.topicById.get(id)?.name ?? id);
    return `${s.source === 'weak' ? 'Weak topics' : 'Topics'}: ${names.slice(0, 4).join(', ')}${names.length > 4 ? ` +${names.length - 4}` : ''}`;
  };

  if (creating) {
    return (
      <SetForm
        profile={profile}
        onCancel={() => setCreating(false)}
        onSaved={async () => {
          setCreating(false);
          await refresh();
        }}
      />
    );
  }

  return (
    <section>
      <p class="muted">These sets appear under "Today's practice" for {profile.name}.</p>
      <div class="list">
        {sets.length === 0 && <p class="card muted">No practice sets yet.</p>}
        {sets.map((s) => (
          <div key={s.id} class="list-item">
            <div class="grow">
              <strong>{s.name}</strong>
              <div class="muted">{describe(s)}</div>
              <div class="muted">
                {s.question_count} questions · difficulty {s.difficulty} · {s.timed ? `timed (${timeLimitMinutes(s, content.competitions)} min)` : 'untimed'}
              </div>
            </div>
            <button
              class="btn small danger-ghost"
              onClick={async () => {
                if (await confirmDialog(`Delete "${s.name}"?`, { okLabel: 'Delete', danger: true })) {
                  await deleteSet(s.id);
                  await refresh();
                }
              }}
            >
              Delete
            </button>
          </div>
        ))}
      </div>
      <button class="btn primary big" onClick={() => setCreating(true)}>
        + New practice set
      </button>
    </section>
  );
}

function SetForm({ profile, onCancel, onSaved }: { profile: Profile; onCancel: () => void; onSaved: () => void }) {
  const content = useContent();
  const [source, setSource] = useState<SetSource>('competition');
  const [competitionId, setCompetitionId] = useState<string>('');
  const [topicIds, setTopicIds] = useState<string[]>([]);
  const [allGrades, setAllGrades] = useState(false);
  const [count, setCount] = useState(10);
  const [difficulty, setDifficulty] = useState<Difficulty>('mixed');
  const [timed, setTimed] = useState(false);
  const [minutes, setMinutes] = useState<number | ''>('');
  const [name, setName] = useState('');
  const [weak, setWeak] = useState<TopicAccuracy[] | null>(null);

  useEffect(() => {
    void answersForProfile(profile.id).then((a) => setWeak(weakTopics(a)));
  }, [profile.id]);

  // Default competition: closest to the kid's grade.
  useEffect(() => {
    if (competitionId || !content.competitions.length) return;
    const best = [...content.competitions].sort((a, b) => Math.abs(a.grade - profile.grade) - Math.abs(b.grade - profile.grade))[0];
    setCompetitionId(best.id);
  }, [content.competitions]);

  const competition = content.competitions.find((c) => c.id === competitionId);
  useEffect(() => {
    if (source === 'competition' && competition) {
      setCount(competition.format.question_count);
      setTimed(true);
    }
  }, [source, competitionId]);
  useEffect(() => {
    if (source === 'topics') setTopicIds([]);
  }, [source]);
  useEffect(() => {
    if (source === 'weak' && weak) setTopicIds(weak.map((w) => w.topic_id).filter((id) => content.topicById.has(id)));
  }, [source, weak]);

  const visibleTopics = useMemo(
    () => (allGrades ? content.topics : topicsNearGrade(content.topics, profile.grade)),
    [content.topics, allGrades, profile.grade],
  );

  const chosenTopics = source === 'competition' ? Object.keys(competition?.topic_weights ?? {}) : topicIds;
  const available = useMemo(() => {
    const set = new Set(chosenTopics);
    return content.questions.filter((q) => set.has(q.topic_id) && matchesDifficulty(q, difficulty)).length;
  }, [chosenTopics.join(','), difficulty, content.questions]);

  const autoName =
    source === 'competition'
      ? (competition?.name ?? 'Competition practice')
      : source === 'weak'
        ? 'Weak topics practice'
        : chosenTopics.length === 1
          ? (content.topicById.get(chosenTopics[0])?.name ?? 'Practice')
          : `Mixed practice (${chosenTopics.length} topics)`;

  const draft: PracticeSet = {
    id: newId(),
    profile_id: profile.id,
    name: name.trim() || autoName,
    source,
    topic_ids: chosenTopics,
    competition_id: source === 'competition' ? competitionId : undefined,
    question_count: count,
    difficulty,
    timed,
    time_limit_min: timed && minutes ? Number(minutes) : undefined,
    created_at: Date.now(),
  };
  const canSave = chosenTopics.length > 0 && available > 0 && count > 0;

  const toggleTopic = (id: string) => setTopicIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  return (
    <section class="card form">
      <h2>New practice set for {profile.name}</h2>
      <Segmented
        label="How to choose questions"
        value={source}
        onChange={setSource}
        options={[
          { value: 'competition', label: '🏆 Competition' },
          { value: 'topics', label: '📚 Pick topics' },
          { value: 'weak', label: '💪 Weak topics' },
        ]}
      />

      {source === 'competition' && (
        <div class="choice-list">
          {content.competitions.length === 0 && <p class="muted">No competitions in the question bank. Import a pack that has some.</p>}
          {content.competitions.map((c) => (
            <button type="button" key={c.id} class={`choice ${c.id === competitionId ? 'on' : ''}`} aria-pressed={c.id === competitionId} onClick={() => setCompetitionId(c.id)}>
              <strong>{c.name}</strong>
              <span class="muted">
                Grade {c.grade} · {c.format.question_count} questions · {c.format.time_limit_min} min
                {c.grade !== profile.grade ? ' · different grade' : ''}
              </span>
            </button>
          ))}
        </div>
      )}

      {source === 'topics' && (
        <div>
          <label class="check">
            <input type="checkbox" checked={allGrades} onChange={(e) => setAllGrades((e.target as HTMLInputElement).checked)} />
            Show all grades (default: grade {profile.grade} ± 1)
          </label>
          {CATEGORIES.map((cat) => {
            const list = visibleTopics.filter((t) => t.category === cat);
            if (!list.length) return null;
            return (
              <fieldset key={cat} class="topic-group">
                <legend>
                  <CategoryBadge category={cat} />
                </legend>
                <div class="topic-grid">
                  {list.map((t) => {
                    const n = content.questions.filter((q) => q.topic_id === t.id).length;
                    const on = topicIds.includes(t.id);
                    return (
                      <button type="button" key={t.id} class={`topic-chip ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => toggleTopic(t.id)}>
                        {on ? '✓ ' : ''}
                        {t.name}
                        <span class="muted">
                          {' '}
                          · G{t.grade_min === t.grade_max ? t.grade_min : `${t.grade_min}–${t.grade_max}`} · {n}q
                        </span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            );
          })}
        </div>
      )}

      {source === 'weak' && (
        <div>
          {weak === null ? (
            <p class="muted">Checking…</p>
          ) : weak.length === 0 ? (
            <p class="muted">
              No weak topics yet: every practised topic is at 70% or better over its last {WEAK_WINDOW} answers (topics need at least 3 answers to count).
            </p>
          ) : (
            <ul class="weak-list">
              {weak.map((w) => (
                <li key={w.topic_id}>
                  {content.topicById.get(w.topic_id)?.name ?? w.topic_id} — {Math.round(w.accuracy * 100)}% ({w.correct}/{w.total})
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <label>
        Number of questions
        <div class="row wrap">
          {COUNTS.map((c) => (
            <button type="button" key={c} class={`chip ${count === c ? 'on' : ''}`} aria-pressed={count === c} onClick={() => setCount(c)}>
              {c}
            </button>
          ))}
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={200}
            class="num"
            value={count}
            aria-label="Custom number of questions"
            onInput={(e) => setCount(Math.max(1, Math.min(200, Number((e.target as HTMLInputElement).value) || 1)))}
          />
        </div>
      </label>

      <div>
        <div class="label">Difficulty</div>
        <Segmented
          label="Difficulty"
          value={difficulty}
          onChange={setDifficulty}
          options={[
            { value: 'mixed', label: 'Mixed' },
            { value: 1, label: '1 · Easy' },
            { value: 2, label: '2 · Medium' },
            { value: 3, label: '3 · Hard' },
          ]}
        />
      </div>

      <label class="check">
        <input type="checkbox" checked={timed} onChange={(e) => setTimed((e.target as HTMLInputElement).checked)} />
        Timed (countdown, auto-submit at zero)
      </label>
      {timed && (
        <label>
          Minutes (leave empty for automatic: {timeLimitMinutes({ ...draft, time_limit_min: undefined }, content.competitions)} min)
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={300}
            class="num"
            value={minutes}
            onInput={(e) => {
              const v = (e.target as HTMLInputElement).value;
              setMinutes(v === '' ? '' : Math.max(1, Math.min(300, Number(v))));
            }}
          />
        </label>
      )}

      <label>
        Name
        <input value={name} placeholder={autoName} maxLength={60} onInput={(e) => setName((e.target as HTMLInputElement).value)} />
      </label>

      <p class={available < count ? 'warn-text' : 'muted'}>
        {available} matching question{available === 1 ? '' : 's'} in the bank
        {available < count && available > 0 ? ` — the set will have ${available} questions.` : ''}
      </p>

      <div class="row end">
        <button class="btn ghost" onClick={onCancel}>
          Cancel
        </button>
        <button
          class="btn primary"
          disabled={!canSave}
          onClick={async () => {
            await saveSet(draft);
            onSaved();
          }}
        >
          Save set
        </button>
      </div>
    </section>
  );
}
