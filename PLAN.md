# Plan — English Practice PWA

Offline-first Progressive Web App for grade 3–6 kids practising for English
competitions on an iPad. Static site, no backend; all data in IndexedDB.

## Stack
- Vite + TypeScript + Preact (tiny, hooks, JSX)
- `idb` for IndexedDB, `zod` for pack validation
- `vite-plugin-pwa` (Workbox `generateSW`, precache everything)
- Vitest (+ `fake-indexeddb` for DB tests), `tsx` for the CLI validator

## File structure
```
src/
  domain/          pure logic, no DOM, no DB  (unit-tested)
    schema.ts        zod schemas for packs + inferred types + integrity checks
    types.ts         local-table record types (profiles, sets, attempts…)
    random.ts        rng type, seeded rng (tests), shuffle, sample
    sampling.ts      weighted competition sampling, topic sampling, ordering
    leitner.ts       Leitner box scheduling (boxes 1–3)
    stats.ts         topic accuracy, weak-topic detection, streak, stars
    answer.ts        answer checking / normalisation
    grade.ts         grade ±1 topic filter
  import/
    validate.ts      parse + validate a pack, human-readable error list
    merge.ts         diff pack vs. DB → preview; apply upsert in one tx
    backup.ts        progress backup export / restore, bank export as pack
  db/
    db.ts            openDB, object stores + indexes (versioned)
    repo.ts          typed CRUD helpers used by UI
  data/
    sample-grade3.json   built-in pack, loaded on first run
  ui/              Preact components (thin; call domain/db)
    App.tsx, kid/*, parent/*, components (Speaker, Confetti, Timer)
  tts.ts           speechSynthesis wrapper (voice pick, rate, iOS tap rules)
  pin.ts           SHA-256 PIN hashing via SubtleCrypto
  main.tsx         bootstrap: persist(), seed sample pack, render
scripts/validate-pack.ts   CLI: npm run validate-pack -- path.json
tests/                     Vitest specs
docs/GENERATE_PACK_PROMPT.md
.github/workflows/deploy.yml   build + deploy to GitHub Pages (BASE_PATH)
```

## IndexedDB stores (db `english-practice`, v1)
| store | key | indexes |
|---|---|---|
| topics, competitions, passages | `id` | `pack_id` |
| questions | `id` | `pack_id`, `topic_id` |
| packs | `pack_id` | |
| profiles | `id` | |
| practice_sets | `id` | `profile_id` |
| attempts | `id` | `profile_id` |
| answers | `id` (auto) | `profile_id`, `attempt_id`, `question_id` |
| review_queue | `[profile_id, question_id]` | `profile_id` |
| settings | `key` | |

Content records carry `pack_id` (last pack that wrote them) so a pack can be
deleted. Answers denormalise `topic_id`, so stats survive pack deletion.

## Data flow
1. **First launch**: `navigator.storage.persist()`, seed `sample-grade3.json`
   through the same import path as user packs (upsert).
2. **Import**: file → `JSON.parse` → zod schema + referential checks (reject the
   whole file on any error) → `previewImport` (new / updated / unchanged per
   kind) → confirm → `applyImport` upserts in a single readwrite transaction.
   Progress stores are never touched.
3. **Practice set** (parent): competition preset (weights) | hand-picked topics
   (equal weights) | weak topics (accuracy < 70% over last 20 answers per topic).
4. **Quiz** (kid): `buildSession` samples question ids (no repeats), shuffles
   options per attempt; each answer → `answers` row + Leitner update; finish →
   `attempts` row updated with score.
5. **Review**: due `review_queue` entries (wrong → box 1; correct moves up;
   correct in box 3 graduates).
6. **Backup**: export progress stores as JSON; restore replaces them.

## UI screens
Kid: profile picker → kid home (Today's practice / Free practice / Review
mistakes) → quiz → results (stars, confetti, try mistakes again).
Parent (PIN gate): Kids · Practice sets · Progress · Data · Settings.
