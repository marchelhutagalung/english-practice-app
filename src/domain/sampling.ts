import type { Question } from './schema';
import type { Difficulty } from './types';
import { defaultRng, shuffle, type Rng } from './random';

/**
 * Split `total` slots across topics proportionally to `weights`
 * (weights need not sum to 1), never exceeding each topic's `available` count.
 * Uses largest-remainder rounding; a topic's shortfall is redistributed to the
 * others in proportion to their weights. Result sums to min(total, Σ available).
 */
export function allocateByWeight(
  weights: Record<string, number>,
  available: Record<string, number>,
  total: number,
): Record<string, number> {
  const ids = Object.keys(weights).filter((id) => weights[id] > 0);
  const alloc: Record<string, number> = Object.fromEntries(ids.map((id) => [id, 0]));
  const cap = (id: string) => available[id] ?? 0;
  let remaining = Math.min(
    Math.max(0, Math.floor(total)),
    ids.reduce((s, id) => s + cap(id), 0),
  );
  let active = ids.filter((id) => cap(id) > 0);

  while (remaining > 0 && active.length > 0) {
    const wSum = active.reduce((s, id) => s + weights[id], 0);
    const shares = active.map((id) => {
      const exact = (remaining * weights[id]) / wSum;
      return { id, floor: Math.floor(exact), frac: exact - Math.floor(exact) };
    });
    let leftover = remaining - shares.reduce((s, x) => s + x.floor, 0);
    // Largest fractional part first; ties → higher weight, then id for stability.
    const byFrac = [...shares].sort((a, b) => b.frac - a.frac || weights[b.id] - weights[a.id] || a.id.localeCompare(b.id));
    const want = new Map(shares.map((s) => [s.id, s.floor]));
    for (const s of byFrac) {
      if (leftover <= 0) break;
      want.set(s.id, want.get(s.id)! + 1);
      leftover--;
    }
    let given = 0;
    for (const id of active) {
      const g = Math.min(want.get(id)!, cap(id) - alloc[id]);
      alloc[id] += g;
      given += g;
    }
    remaining -= given;
    active = active.filter((id) => alloc[id] < cap(id));
    if (given === 0) break; // safety net; cannot happen while capacity remains
  }
  return alloc;
}

export function matchesDifficulty(q: Pick<Question, 'difficulty'>, d: Difficulty): boolean {
  return d === 'mixed' || q.difficulty === d;
}

export interface SampleOptions {
  /** topic id → weight. Equal weights for hand-picked / weak-topic sets. */
  weights: Record<string, number>;
  count: number;
  difficulty?: Difficulty;
  /** Question ids to avoid (e.g. already used). */
  exclude?: ReadonlySet<string>;
  rng?: Rng;
}

/** Weighted sampling without repeats, then ordered with passage siblings kept together. */
export function sampleQuestions<Q extends Question>(pool: readonly Q[], opts: SampleOptions): Q[] {
  const rng = opts.rng ?? defaultRng;
  const difficulty = opts.difficulty ?? 'mixed';
  const byTopic = new Map<string, Q[]>();
  const seen = new Set<string>();
  for (const q of pool) {
    if (!(q.topic_id in opts.weights)) continue;
    if (!matchesDifficulty(q, difficulty)) continue;
    if (opts.exclude?.has(q.id) || seen.has(q.id)) continue;
    seen.add(q.id);
    const list = byTopic.get(q.topic_id) ?? [];
    list.push(q);
    byTopic.set(q.topic_id, list);
  }
  const available = Object.fromEntries([...byTopic].map(([k, v]) => [k, v.length]));
  const alloc = allocateByWeight(opts.weights, available, opts.count);
  const picked: Q[] = [];
  for (const [topicId, n] of Object.entries(alloc)) {
    if (n > 0) picked.push(...pickTopicQuestions(byTopic.get(topicId) ?? [], n, rng));
  }
  return orderForSession(picked, rng);
}

/**
 * Pick n questions from one topic. Reading questions are taken passage by passage
 * so a kid reads fewer passages and answers more questions per passage.
 */
function pickTopicQuestions<Q extends Question>(list: Q[], n: number, rng: Rng): Q[] {
  const groups = groupByPassage(list);
  const out: Q[] = [];
  for (const g of shuffle(groups, rng)) {
    if (out.length >= n) break;
    out.push(...shuffle(g, rng).slice(0, n - out.length));
  }
  return out;
}

function groupByPassage<Q extends Question>(list: readonly Q[]): Q[][] {
  const groups = new Map<string, Q[]>();
  const singles: Q[][] = [];
  for (const q of list) {
    if (q.passage_id) {
      const g = groups.get(q.passage_id) ?? [];
      g.push(q);
      groups.set(q.passage_id, g);
    } else singles.push([q]);
  }
  return [...groups.values(), ...singles];
}

/** Shuffle, keeping questions that share a passage adjacent (in id order). */
export function orderForSession<Q extends Question>(questions: readonly Q[], rng: Rng = defaultRng): Q[] {
  const groups = groupByPassage(questions).map((g) => [...g].sort((a, b) => a.id.localeCompare(b.id)));
  return shuffle(groups, rng).flat();
}

export function equalWeights(topicIds: readonly string[]): Record<string, number> {
  return Object.fromEntries(topicIds.map((id) => [id, 1]));
}
