import type { Topic } from './schema';

/** Topics whose grade range overlaps [grade - spread, grade + spread]. */
export function topicsNearGrade<T extends Pick<Topic, 'grade_min' | 'grade_max'>>(topics: readonly T[], grade: number, spread = 1): T[] {
  return topics.filter((t) => t.grade_max >= grade - spread && t.grade_min <= grade + spread);
}
