import type { Question } from './schema';

export function normalizeAnswer(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, ' ')
    .replace(/[.!?]+$/, '');
}

export function isCorrect(q: Pick<Question, 'answer' | 'type'>, given: string): boolean {
  if (q.type === 'fill_blank') return normalizeAnswer(given) === normalizeAnswer(q.answer);
  return given === q.answer;
}

/** Options to show for a question, before shuffling. Empty = free-text fill_blank. */
export function baseOptions(q: Pick<Question, 'options' | 'type'>): string[] {
  if (q.type === 'true_false') return q.options ?? ['True', 'False'];
  return q.options ?? [];
}
