import { z } from 'zod';

/**
 * Pack schema — the single source of truth for the import format.
 * Used by the app importer and by `scripts/validate-pack.ts`.
 */

export const CATEGORIES = ['grammar', 'vocabulary', 'reading', 'listening'] as const;
export const QUESTION_TYPES = ['mcq', 'fill_blank', 'true_false', 'reading_mcq', 'listening_mcq'] as const;

const id = z
  .string()
  .min(1, 'must not be empty')
  .max(120, 'must be at most 120 characters')
  .regex(/^[A-Za-z0-9._-]+$/, 'may only contain letters, digits, ".", "_" and "-"');

const text = z.string().trim().min(1, 'must not be empty');
const grade = z.number().int('must be a whole number').min(1).max(12);
const imageDataUri = z
  .string()
  .regex(/^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,[A-Za-z0-9+/=\s]+$/, 'must be a base64 image data URI (data:image/...;base64,...)');

export const TopicSchema = z
  .object({
    id,
    category: z.enum(CATEGORIES),
    name: text,
    grade_min: grade,
    grade_max: grade,
  })
  .strict()
  .refine((t) => t.grade_min <= t.grade_max, { message: 'grade_min must be ≤ grade_max', path: ['grade_min'] });

export const CompetitionSchema = z
  .object({
    id,
    name: text,
    grade,
    format: z
      .object({
        question_count: z.number().int().min(1).max(200),
        time_limit_min: z.number().positive().max(300),
      })
      .strict(),
    topic_weights: z
      .record(id, z.number().positive('weight must be > 0'))
      .refine((w) => Object.keys(w).length > 0, 'must list at least one topic'),
  })
  .strict();

export const PassageSchema = z
  .object({
    id,
    topic_id: id,
    title: text,
    text,
    image: imageDataUri.optional(),
  })
  .strict();

export const QuestionSchema = z
  .object({
    id,
    topic_id: id,
    grade,
    difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)], {
      errorMap: () => ({ message: 'must be 1, 2 or 3' }),
    }),
    type: z.enum(QUESTION_TYPES),
    prompt: text,
    options: z.array(text).optional(),
    answer: text,
    passage_id: id.optional(),
    tts_text: text.optional(),
    explanation: text,
    image: imageDataUri.optional(),
  })
  .strict()
  .superRefine((q, ctx) => {
    const needsOptions = q.type === 'mcq' || q.type === 'reading_mcq' || q.type === 'listening_mcq';
    if (needsOptions && (!q.options || q.options.length < 2)) {
      ctx.addIssue({ code: 'custom', path: ['options'], message: `type "${q.type}" needs at least 2 options` });
    }
    if (q.options) {
      if (q.options.length > 6) {
        ctx.addIssue({ code: 'custom', path: ['options'], message: 'at most 6 options are allowed' });
      }
      const norm = q.options.map((o) => o.trim().toLowerCase());
      if (new Set(norm).size !== norm.length) {
        ctx.addIssue({ code: 'custom', path: ['options'], message: 'options must be unique' });
      }
      const matches = q.options.filter((o) => o === q.answer).length;
      if (matches !== 1) {
        ctx.addIssue({
          code: 'custom',
          path: ['answer'],
          message: `answer "${q.answer}" must match exactly one option (found ${matches})`,
        });
      }
    }
    if (q.type === 'true_false') {
      const opts = q.options ?? ['True', 'False'];
      if (opts.length !== 2 || !opts.includes('True') || !opts.includes('False')) {
        ctx.addIssue({ code: 'custom', path: ['options'], message: 'true_false options must be ["True", "False"] (or omitted)' });
      }
      if (q.answer !== 'True' && q.answer !== 'False') {
        ctx.addIssue({ code: 'custom', path: ['answer'], message: 'true_false answer must be "True" or "False"' });
      }
    }
    if (q.type === 'fill_blank' && !q.prompt.includes('___')) {
      ctx.addIssue({ code: 'custom', path: ['prompt'], message: 'fill_blank prompt must contain a blank "___"' });
    }
    if (q.type === 'reading_mcq' && !q.passage_id) {
      ctx.addIssue({ code: 'custom', path: ['passage_id'], message: 'reading_mcq needs a passage_id' });
    }
    if (q.type === 'listening_mcq' && !q.tts_text) {
      ctx.addIssue({ code: 'custom', path: ['tts_text'], message: 'listening_mcq needs tts_text' });
    }
  });

export const PackSchema = z
  .object({
    schema_version: z.literal(1, { errorMap: () => ({ message: 'must be 1' }) }),
    pack_id: id,
    pack_version: z.number().int().min(1),
    title: text,
    topics: z.array(TopicSchema).default([]),
    competitions: z.array(CompetitionSchema).default([]),
    passages: z.array(PassageSchema).default([]),
    questions: z.array(QuestionSchema).default([]),
  })
  .strict();

export type Category = (typeof CATEGORIES)[number];
export type QuestionType = (typeof QUESTION_TYPES)[number];
export type Topic = z.infer<typeof TopicSchema>;
export type Competition = z.infer<typeof CompetitionSchema>;
export type Passage = z.infer<typeof PassageSchema>;
export type Question = z.infer<typeof QuestionSchema>;
export type Pack = z.infer<typeof PackSchema>;

export interface PackIssue {
  /** e.g. `questions[3] (id "q-004")` */
  item: string;
  /** e.g. `options` */
  field: string;
  message: string;
}

/**
 * Cross-item checks that zod cannot express per item:
 * duplicate ids and references that must resolve inside the pack.
 * Packs are self-contained: every referenced topic/passage must be in the same file.
 */
export function checkPackIntegrity(pack: Pack): PackIssue[] {
  const issues: PackIssue[] = [];
  const label = (kind: string, i: number, itemId: string) => `${kind}[${i}] (id "${itemId}")`;

  const dupCheck = (kind: string, items: { id: string }[]) => {
    const seen = new Map<string, number>();
    items.forEach((it, i) => {
      if (seen.has(it.id)) {
        issues.push({ item: label(kind, i, it.id), field: 'id', message: `duplicate id (also at ${kind}[${seen.get(it.id)}])` });
      } else seen.set(it.id, i);
    });
  };
  dupCheck('topics', pack.topics);
  dupCheck('competitions', pack.competitions);
  dupCheck('passages', pack.passages);
  dupCheck('questions', pack.questions);

  const topicIds = new Set(pack.topics.map((t) => t.id));
  const passageIds = new Set(pack.passages.map((p) => p.id));

  pack.competitions.forEach((c, i) => {
    for (const tid of Object.keys(c.topic_weights)) {
      if (!topicIds.has(tid)) {
        issues.push({ item: label('competitions', i, c.id), field: `topic_weights.${tid}`, message: `unknown topic "${tid}"` });
      }
    }
  });
  pack.passages.forEach((p, i) => {
    if (!topicIds.has(p.topic_id)) {
      issues.push({ item: label('passages', i, p.id), field: 'topic_id', message: `unknown topic "${p.topic_id}"` });
    }
  });
  pack.questions.forEach((q, i) => {
    if (!topicIds.has(q.topic_id)) {
      issues.push({ item: label('questions', i, q.id), field: 'topic_id', message: `unknown topic "${q.topic_id}"` });
    }
    if (q.passage_id && !passageIds.has(q.passage_id)) {
      issues.push({ item: label('questions', i, q.id), field: 'passage_id', message: `unknown passage "${q.passage_id}"` });
    }
  });
  return issues;
}
