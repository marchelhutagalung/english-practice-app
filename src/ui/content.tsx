import { createContext, type ComponentChildren } from 'preact';
import { useCallback, useContext, useEffect, useMemo, useState } from 'preact/hooks';
import { listCompetitions, listPassages, listQuestions, listTopics } from '../db/repo';
import type { StoredCompetition, StoredPassage, StoredQuestion, StoredTopic } from '../domain/types';

export interface Content {
  loaded: boolean;
  topics: StoredTopic[];
  competitions: StoredCompetition[];
  passages: StoredPassage[];
  questions: StoredQuestion[];
  topicById: Map<string, StoredTopic>;
  passageById: Map<string, StoredPassage>;
  questionById: Map<string, StoredQuestion>;
  reload: () => Promise<void>;
}

const empty: Content = {
  loaded: false,
  topics: [],
  competitions: [],
  passages: [],
  questions: [],
  topicById: new Map(),
  passageById: new Map(),
  questionById: new Map(),
  reload: async () => {},
};

const Ctx = createContext<Content>(empty);

/** Keeps the whole question bank in memory; reloaded after imports/deletes. */
export function ContentProvider({ children }: { children: ComponentChildren }) {
  const [data, setData] = useState<Omit<Content, 'reload' | 'topicById' | 'passageById' | 'questionById'>>(empty);
  const reload = useCallback(async () => {
    const [topics, competitions, passages, questions] = await Promise.all([listTopics(), listCompetitions(), listPassages(), listQuestions()]);
    topics.sort((a, b) => a.name.localeCompare(b.name));
    competitions.sort((a, b) => a.grade - b.grade || a.name.localeCompare(b.name));
    setData({ loaded: true, topics, competitions, passages, questions });
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);
  const value = useMemo<Content>(
    () => ({
      ...data,
      reload,
      topicById: new Map(data.topics.map((t) => [t.id, t])),
      passageById: new Map(data.passages.map((p) => [p.id, p])),
      questionById: new Map(data.questions.map((q) => [q.id, q])),
    }),
    [data, reload],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useContent = () => useContext(Ctx);
