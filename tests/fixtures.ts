import type { Pack } from '../src/domain/schema';

export function makePack(overrides: Partial<Pack> = {}): Pack {
  return {
    schema_version: 1,
    pack_id: 'test-pack',
    pack_version: 1,
    title: 'Test pack',
    topics: [
      { id: 't-a', category: 'grammar', name: 'Topic A', grade_min: 3, grade_max: 4 },
      { id: 't-b', category: 'vocabulary', name: 'Topic B', grade_min: 3, grade_max: 4 },
    ],
    competitions: [],
    passages: [],
    questions: [
      { id: 'q1', topic_id: 't-a', grade: 3, difficulty: 1, type: 'mcq', prompt: 'The cat is ___ the box.', options: ['in', 'on', 'at'], answer: 'in', explanation: 'Inside = in.' },
      { id: 'q2', topic_id: 't-b', grade: 3, difficulty: 2, type: 'mcq', prompt: 'A baby dog is a ___.', options: ['puppy', 'kitten'], answer: 'puppy', explanation: 'Puppy.' },
    ],
    ...overrides,
  };
}

export function question(id: string, topic_id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    topic_id,
    grade: 3,
    difficulty: 1 as const,
    type: 'mcq' as const,
    prompt: `Prompt ${id}`,
    options: ['a', 'b'],
    answer: 'a',
    explanation: 'x',
    ...extra,
  };
}
