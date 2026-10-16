import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useContent } from '../content';
import { baseOptions, isCorrect } from '../../domain/answer';
import { shuffle } from '../../domain/random';
import type { Attempt, AttemptMode, Profile, StoredQuestion } from '../../domain/types';
import { finishAttempt, recordAnswer, startAttempt } from '../../db/repo';
import { SpeakerButton } from '../widgets';
import { confirmDialog } from '../dialog';
import { stopSpeaking } from '../../tts';

export interface SessionSpec {
  profile: Profile;
  mode: AttemptMode;
  title: string;
  setId?: string;
  questionIds: string[];
  timeLimitMin?: number;
}

export interface SessionResult {
  spec: SessionSpec;
  attempt: Attempt;
  correct: number;
  total: number;
  wrongIds: string[];
  timedOut: boolean;
}

const PRAISE = ['Great job!', 'Awesome!', 'You got it!', 'Super!', 'Well done!', 'Brilliant!'];
const ENCOURAGE = ['Nice try!', 'Almost!', 'Keep going!', "Let's learn this one!"];
const pick = (a: string[]) => a[Math.floor(Math.random() * a.length)];

export function Quiz({ spec, onDone, onQuit }: { spec: SessionSpec; onDone: (r: SessionResult) => void; onQuit: () => void }) {
  const { questionById, passageById } = useContent();
  const questions = useMemo(
    () => spec.questionIds.map((id) => questionById.get(id)).filter((q): q is StoredQuestion => !!q),
    [],
  );
  // Shuffle option order once per attempt (true/false keeps its natural order).
  const optionOrder = useMemo(
    () => new Map(questions.map((q) => [q.id, q.type === 'true_false' ? baseOptions(q) : shuffle(baseOptions(q))])),
    [questions],
  );

  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [index, setIndex] = useState(0);
  const [given, setGiven] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const [message, setMessage] = useState('');
  const [showPassage, setShowPassage] = useState(true);
  const [remainingSec, setRemainingSec] = useState<number | null>(spec.timeLimitMin ? spec.timeLimitMin * 60 : null);
  const results = useRef<{ id: string; correct: boolean }[]>([]);
  const shownAt = useRef(Date.now());
  const finished = useRef(false);
  const topRef = useRef<HTMLDivElement>(null);

  const q = questions[index];

  useEffect(() => {
    void startAttempt({ profile_id: spec.profile.id, mode: spec.mode, set_id: spec.setId, title: spec.title, question_ids: questions.map((x) => x.id) }).then(setAttempt);
    return () => stopSpeaking();
  }, []);

  const finish = async (timedOut: boolean) => {
    if (finished.current || !attempt) return;
    finished.current = true;
    stopSpeaking();
    const correct = results.current.filter((r) => r.correct).length;
    const answered = new Set(results.current.map((r) => r.id));
    // Unanswered questions (time ran out) count as not correct but are not recorded as answers.
    const wrongIds = [...results.current.filter((r) => !r.correct).map((r) => r.id), ...questions.filter((x) => !answered.has(x.id)).map((x) => x.id)];
    const done = await finishAttempt(attempt, correct, timedOut);
    onDone({ spec, attempt: done, correct, total: questions.length, wrongIds, timedOut });
  };

  // Countdown; auto-submit at zero.
  const endsAt = useRef<number | null>(spec.timeLimitMin ? Date.now() + spec.timeLimitMin * 60_000 : null);
  useEffect(() => {
    if (!endsAt.current || !attempt) return;
    const tick = () => {
      const left = Math.max(0, Math.round((endsAt.current! - Date.now()) / 1000));
      setRemainingSec(left);
      if (left <= 0) void finish(true);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [attempt]);

  if (questions.length === 0) {
    return (
      <div class="screen center">
        <div class="card">
          <h2>No questions here yet</h2>
          <p>Ask a grown-up to add more questions in Parent mode.</p>
          <button class="btn primary" onClick={onQuit}>
            Back
          </button>
        </div>
      </div>
    );
  }

  const answer = (value: string) => {
    if (given !== null || !attempt || finished.current) return;
    const correct = isCorrect(q, value);
    setGiven(value);
    setMessage(correct ? pick(PRAISE) : pick(ENCOURAGE));
    results.current.push({ id: q.id, correct });
    void recordAnswer({
      attempt_id: attempt.id,
      profile_id: spec.profile.id,
      question_id: q.id,
      topic_id: q.topic_id,
      given: value,
      correct,
      time_ms: Date.now() - shownAt.current,
      answered_at: Date.now(),
    });
  };

  const next = () => {
    stopSpeaking();
    if (index + 1 >= questions.length) {
      void finish(false);
      return;
    }
    setIndex(index + 1);
    setGiven(null);
    setTyped('');
    shownAt.current = Date.now();
    topRef.current?.scrollIntoView({ block: 'start' });
  };

  const quit = async () => {
    if (await confirmDialog('Stop practising?', { message: 'Your answers so far are saved.', okLabel: 'Stop' })) {
      stopSpeaking();
      onQuit();
    }
  };

  const passage = q.passage_id ? passageById.get(q.passage_id) : undefined;
  const options = optionOrder.get(q.id) ?? [];
  const answered = given !== null;
  const wasCorrect = answered && isCorrect(q, given);
  const isListening = q.type === 'listening_mcq';
  const lowTime = remainingSec !== null && remainingSec <= 60;

  return (
    <div class="screen quiz" ref={topRef}>
      <header class="quiz-top">
        <button class="btn ghost" onClick={quit} aria-label="Stop practice">
          ✕
        </button>
        <div class="progress" aria-label={`Question ${index + 1} of ${questions.length}`}>
          <div class="progress-bar" style={{ width: `${((index + (answered ? 1 : 0)) / questions.length) * 100}%` }} />
          <span>
            {index + 1} / {questions.length}
          </span>
        </div>
        {remainingSec !== null && (
          <div class={`timer ${lowTime ? 'low' : ''}`} role="timer" aria-live={lowTime ? 'polite' : 'off'}>
            ⏱ {Math.floor(remainingSec / 60)}:{String(remainingSec % 60).padStart(2, '0')}
          </div>
        )}
      </header>

      {passage && (
        <section class="card passage">
          <div class="row between">
            <h3>📖 {passage.title}</h3>
            <div class="row">
              {showPassage && <SpeakerButton text={`${passage.title}. ${passage.text}`} label="Read the story aloud" />}
              <button class="btn small ghost" onClick={() => setShowPassage(!showPassage)} aria-expanded={showPassage}>
                {showPassage ? 'Hide story' : 'Show story'}
              </button>
            </div>
          </div>
          {showPassage && (
            <div class="passage-text">
              {passage.image && <img src={passage.image} alt="" />}
              {passage.text.split(/\n+/).map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          )}
        </section>
      )}

      <section class="card question" key={q.id}>
        {isListening && q.tts_text && (
          <div class="listen">
            <SpeakerButton text={q.tts_text} label="Listen" big />
            <p class="hint">Tap to listen. You can listen again!</p>
          </div>
        )}
        <div class="prompt-row">
          <p class="prompt">{q.prompt}</p>
          <SpeakerButton text={q.prompt} label="Read the question aloud" />
        </div>
        {q.image && <img class="q-image" src={q.image} alt="" />}

        {options.length > 0 ? (
          <div class={`options ${options.length > 3 ? 'grid' : ''}`}>
            {options.map((opt) => {
              let state = '';
              if (answered) {
                if (opt === q.answer) state = 'correct';
                else if (opt === given) state = 'wrong';
                else state = 'dim';
              }
              return (
                <button key={opt} class={`option ${state}`} disabled={answered} onClick={() => answer(opt)}>
                  {opt}
                </button>
              );
            })}
          </div>
        ) : (
          <form
            class="fill"
            onSubmit={(e) => {
              e.preventDefault();
              if (typed.trim()) answer(typed);
            }}
          >
            <input
              class={`fill-input ${answered ? (wasCorrect ? 'correct' : 'wrong') : ''}`}
              value={typed}
              onInput={(e) => setTyped((e.target as HTMLInputElement).value)}
              disabled={answered}
              autocapitalize="off"
              autocomplete="off"
              autocorrect="off"
              spellcheck={false}
              placeholder="Type your answer"
              aria-label="Your answer"
            />
            {!answered && (
              <button class="btn primary" type="submit" disabled={!typed.trim()}>
                Check
              </button>
            )}
          </form>
        )}

        {answered && (
          <div class={`feedback ${wasCorrect ? 'good' : 'bad'}`} role="status">
            <div class="feedback-title">
              <span class="feedback-icon" aria-hidden="true">
                {wasCorrect ? '🎉' : '💡'}
              </span>
              {message}
            </div>
            {!wasCorrect && (
              <p>
                The answer is <strong>{q.answer}</strong>.
              </p>
            )}
            <p>{q.explanation}</p>
            <button class="btn primary big next" onClick={next}>
              {index + 1 >= questions.length ? 'Finish ✓' : 'Next →'}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
