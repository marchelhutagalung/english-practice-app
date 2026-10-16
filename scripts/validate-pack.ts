/**
 * Validate a pack file against the same zod schema the app uses.
 *   npm run validate-pack -- path/to/pack.json [more.json …]
 * Exit code 0 = all valid, 1 = at least one invalid file.
 */
import { readFileSync } from 'node:fs';
import { validatePackText, formatIssues } from '../src/import/validate';

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('Usage: npm run validate-pack -- <pack.json> [more.json …]');
  process.exit(2);
}

let failed = 0;
for (const file of files) {
  let text: string;
  try {
    text = readFileSync(file, 'utf8');
  } catch (e) {
    console.error(`✖ ${file}: cannot read file (${(e as Error).message})`);
    failed++;
    continue;
  }
  const result = validatePackText(text);
  if (result.ok) {
    const p = result.pack;
    const byType = p.questions.reduce<Record<string, number>>((acc, q) => ((acc[q.type] = (acc[q.type] ?? 0) + 1), acc), {});
    console.log(
      `✔ ${file}: "${p.title}" (${p.pack_id} v${p.pack_version}) — ${p.topics.length} topics, ${p.competitions.length} competitions, ` +
        `${p.passages.length} passages, ${p.questions.length} questions ${JSON.stringify(byType)}`,
    );
  } else {
    failed++;
    console.error(`✖ ${file}: ${result.issues.length} problem(s)\n${formatIssues(result.issues)}`);
  }
}
process.exit(failed ? 1 : 0);
