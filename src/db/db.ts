import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type {
  AnswerRecord,
  Attempt,
  PackRecord,
  PracticeSet,
  Profile,
  ReviewEntry,
  SettingRecord,
  StoredCompetition,
  StoredPassage,
  StoredQuestion,
  StoredTopic,
} from '../domain/types';

export interface AppDB extends DBSchema {
  topics: { key: string; value: StoredTopic; indexes: { pack_id: string } };
  competitions: { key: string; value: StoredCompetition; indexes: { pack_id: string } };
  passages: { key: string; value: StoredPassage; indexes: { pack_id: string } };
  questions: { key: string; value: StoredQuestion; indexes: { pack_id: string; topic_id: string } };
  packs: { key: string; value: PackRecord };
  profiles: { key: string; value: Profile };
  practice_sets: { key: string; value: PracticeSet; indexes: { profile_id: string } };
  attempts: { key: string; value: Attempt; indexes: { profile_id: string } };
  answers: { key: number; value: AnswerRecord; indexes: { profile_id: string; attempt_id: string; question_id: string } };
  review_queue: { key: [string, string]; value: ReviewEntry; indexes: { profile_id: string } };
  settings: { key: string; value: SettingRecord };
}

export type DB = IDBPDatabase<AppDB>;

export const CONTENT_STORES = ['topics', 'competitions', 'passages', 'questions'] as const;
export const PROGRESS_STORES = ['profiles', 'practice_sets', 'attempts', 'answers', 'review_queue'] as const;

export const DB_NAME = 'english-practice';
export const DB_VERSION = 1;

export function openAppDb(name: string = DB_NAME): Promise<DB> {
  return openDB<AppDB>(name, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore('topics', { keyPath: 'id' }).createIndex('pack_id', 'pack_id');
        db.createObjectStore('competitions', { keyPath: 'id' }).createIndex('pack_id', 'pack_id');
        db.createObjectStore('passages', { keyPath: 'id' }).createIndex('pack_id', 'pack_id');
        const q = db.createObjectStore('questions', { keyPath: 'id' });
        q.createIndex('pack_id', 'pack_id');
        q.createIndex('topic_id', 'topic_id');
        db.createObjectStore('packs', { keyPath: 'pack_id' });
        db.createObjectStore('profiles', { keyPath: 'id' });
        db.createObjectStore('practice_sets', { keyPath: 'id' }).createIndex('profile_id', 'profile_id');
        db.createObjectStore('attempts', { keyPath: 'id' }).createIndex('profile_id', 'profile_id');
        const a = db.createObjectStore('answers', { keyPath: 'id', autoIncrement: true });
        a.createIndex('profile_id', 'profile_id');
        a.createIndex('attempt_id', 'attempt_id');
        a.createIndex('question_id', 'question_id');
        db.createObjectStore('review_queue', { keyPath: ['profile_id', 'question_id'] }).createIndex('profile_id', 'profile_id');
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    },
  });
}

let shared: Promise<DB> | null = null;
/** App-wide connection (UI). Tests open their own named DBs via openAppDb. */
export function getDb(): Promise<DB> {
  shared ??= openAppDb();
  return shared;
}
