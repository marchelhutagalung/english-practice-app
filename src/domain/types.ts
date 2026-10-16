import type { Competition, Passage, Question, Topic } from './schema';

/** Content records as stored: the pack item plus the pack that last wrote it. */
export type StoredTopic = Topic & { pack_id: string };
export type StoredCompetition = Competition & { pack_id: string };
export type StoredPassage = Passage & { pack_id: string };
export type StoredQuestion = Question & { pack_id: string };

export interface PackRecord {
  pack_id: string;
  version: number;
  title: string;
  imported_at: number;
  builtin?: boolean;
}

export interface Profile {
  id: string;
  name: string;
  grade: number;
  avatar: string;
  created_at: number;
}

export type Difficulty = 1 | 2 | 3 | 'mixed';
export type SetSource = 'competition' | 'topics' | 'weak';

export interface PracticeSet {
  id: string;
  profile_id: string;
  name: string;
  source: SetSource;
  topic_ids: string[];
  competition_id?: string;
  question_count: number;
  difficulty: Difficulty;
  timed: boolean;
  time_limit_min?: number;
  created_at: number;
}

export type AttemptMode = 'set' | 'free' | 'review' | 'retry';

export interface Attempt {
  id: string;
  profile_id: string;
  mode: AttemptMode;
  set_id?: string;
  title: string;
  question_ids: string[];
  started_at: number;
  finished_at?: number;
  correct: number;
  total: number;
  timed_out?: boolean;
}

export interface AnswerRecord {
  id?: number;
  attempt_id: string;
  profile_id: string;
  question_id: string;
  topic_id: string;
  given: string;
  correct: boolean;
  time_ms: number;
  answered_at: number;
}

export interface ReviewEntry {
  profile_id: string;
  question_id: string;
  box: 1 | 2 | 3;
  due_at: number;
  last_reviewed_at: number;
}

export interface SettingRecord {
  key: string;
  value: unknown;
}
