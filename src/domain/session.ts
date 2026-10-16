import type { Competition, Question } from './schema';
import type { PracticeSet } from './types';
import { equalWeights, sampleQuestions } from './sampling';
import { defaultRng, type Rng } from './random';

/** Weights a practice set samples with. */
export function weightsForSet(set: PracticeSet, competitions: readonly Competition[]): Record<string, number> {
  if (set.source === 'competition') {
    const c = competitions.find((x) => x.id === set.competition_id);
    if (c) return c.topic_weights;
  }
  return equalWeights(set.topic_ids);
}

export function buildSetQuestions<Q extends Question>(
  set: PracticeSet,
  pool: readonly Q[],
  competitions: readonly Competition[],
  rng: Rng = defaultRng,
): Q[] {
  return sampleQuestions(pool, { weights: weightsForSet(set, competitions), count: set.question_count, difficulty: set.difficulty, rng });
}

/** Minutes for a timed set: the competition pace scaled to the question count, else the set's own limit, else 1 min/question. */
export function timeLimitMinutes(set: PracticeSet, competitions: readonly Competition[]): number {
  if (set.time_limit_min) return set.time_limit_min;
  const c = set.source === 'competition' ? competitions.find((x) => x.id === set.competition_id) : undefined;
  if (c) return Math.max(1, Math.ceil((c.format.time_limit_min * set.question_count) / c.format.question_count));
  return Math.max(1, set.question_count);
}
