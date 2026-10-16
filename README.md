# English Practice — offline PWA for kids

An iPad-friendly Progressive Web App that helps kids in grades 3–6 practise for
English competitions. A parent picks which topics or competition to practise.
It runs **fully offline** after the first visit. It has **no backend** and no running cost.
All data stays in IndexedDB on the device. The question bank grows by
importing JSON "packs".

- Kid mode: pick a profile → **Today's practice** (sets the parent assigned), **Free practice**
  (Mix / Grammar / Words / Reading / Listening), **Review mistakes** (Leitner boxes).
- Quiz: one question per screen with big buttons, instant feedback with a kid-friendly explanation,
  read-aloud on every prompt, listening questions spoken by `speechSynthesis`, reading passages
  you can hide or show, an optional countdown that auto-submits at zero, and an end screen with stars,
  CSS confetti and "Try mistakes again".
- Parent mode (4-digit PIN, SHA-256 hashed with a salt): kid profiles, practice sets (competition preset,
  hand-picked topics, or auto "weak topics"), a progress dashboard, pack import/export, progress
  backup/restore, voice settings and PIN change.

See [`PLAN.md`](PLAN.md) for the architecture.

## Run locally

Requires Node 20+ (CI uses Node 22).

```bash
npm install
npm run dev            # http://localhost:5173
npm test               # Vitest
npm run build          # type-check + production build into dist/
npm run preview        # serve dist/ (service worker active) on http://localhost:4173
npm run validate-pack -- path/to/pack.json   # validate one or more pack files
```

To try it on an iPad on your local network, run `npm run build && npx vite preview --host`.
Service workers and `crypto.subtle` (used for the PIN) need HTTPS or `localhost`. For real
iPad testing, use the GitHub Pages deployment.

## Deploy to GitHub Pages

1. Push this repository to GitHub, with `main` as the default branch.
2. In the repository, open **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.
3. Push to `main`, or run the **Deploy to GitHub Pages** workflow manually. The workflow
   (`.github/workflows/deploy.yml`) runs the tests, validates the sample pack, builds with
   `BASE_PATH=/<repo-name>/` and publishes `dist/`.
4. The app is served at `https://<user>.github.io/<repo-name>/`.

If you use a custom domain or a `<user>.github.io` repository, change `BASE_PATH` in the
workflow to `/`.

## Install on the iPad

1. Open the GitHub Pages URL in **Safari**. Other browsers on iOS cannot install PWAs.
2. Wait for the first screen to load. The app and the built-in pack are then cached for offline use.
3. Tap **Share** (the square with an arrow) → **Add to Home Screen** → **Add**.
4. Open the app from the Home Screen icon. It runs full-screen and offline.
5. Tap **🔒 Parent mode**, create a PIN, add each kid (name, grade, avatar) and create practice sets.

Tips:
- **Voices:** for better speech, download an enhanced English voice in iPad **Settings →
  Accessibility → Spoken Content → Voices → English**. Then pick it in Parent mode → Settings.
- **Importing packs:** Parent mode → Data → **Import pack** opens the Files app. Save `.json` packs to
  Files or iCloud Drive first, for example from Mail or AirDrop.
- **Backups:** Parent mode → Data → **Export backup** opens the share sheet. Choose **Save to Files**.
  Safari can remove website data for sites you have not used for a long time. The app requests
  persistent storage, and an installed Home Screen app is much less likely to be cleared,
  but you should still export a backup now and then.
- **Updates:** a new deployment is picked up the next time the app is opened while online.

## Pack JSON format (also the import format)

A pack is a single UTF-8 JSON file. The same zod schema (`src/domain/schema.ts`) is used by the app
and by `npm run validate-pack`.

### Top level

| field | type | notes |
|---|---|---|
| `schema_version` | `1` | required, must be `1` |
| `pack_id` | id | identifies the pack; re-importing the same `pack_id` updates it |
| `pack_version` | integer ≥ 1 | increase when you publish a new version |
| `title` | string | shown in Parent mode |
| `topics` | Topic[] | optional, default `[]` |
| `competitions` | Competition[] | optional |
| `passages` | Passage[] | optional |
| `questions` | Question[] | optional |

An **id** is 1–120 characters from `A–Z a–z 0–9 . _ -`. Ids are global across packs. Two packs that
use the same id refer to the same item, and the one imported last wins. Unknown fields are rejected
so typos are caught.

### Topic

| field | type | notes |
|---|---|---|
| `id` | id | |
| `category` | `"grammar" \| "vocabulary" \| "reading" \| "listening"` | groups topics in the picker |
| `name` | string | |
| `grade_min`, `grade_max` | integer 1–12 | `grade_min ≤ grade_max`. The picker shows the kid's grade ± 1 by default. This is a filter, not a hard wall. |

### Competition

| field | type | notes |
|---|---|---|
| `id`, `name` | | |
| `grade` | integer 1–12 | |
| `format.question_count` | integer 1–200 | default size of a practice set from this preset |
| `format.time_limit_min` | number | the time limit for a set of `question_count` questions. A smaller set gets a proportional limit. |
| `topic_weights` | `{ topic_id: weight > 0 }` | weights do not need to add up to 1. Questions are split by largest remainder. If a topic runs out of questions, its share goes to the other topics. |

### Passage

| field | type | notes |
|---|---|---|
| `id`, `topic_id`, `title`, `text` | | blank lines in `text` separate paragraphs |
| `image` | optional base64 `data:image/...;base64,...` URI | |

### Question

| field | type | notes |
|---|---|---|
| `id`, `topic_id` | id | |
| `grade` | integer 1–12 | |
| `difficulty` | `1 \| 2 \| 3` | 1 = easy, 3 = hard |
| `type` | `"mcq" \| "fill_blank" \| "true_false" \| "reading_mcq" \| "listening_mcq"` | |
| `prompt` | string | `fill_blank` prompts must contain `___` |
| `options` | string[] (2–6, unique) | required for `mcq`, `reading_mcq` and `listening_mcq`. Optional for `fill_blank`: with options it shows a word bank, without options the kid types the answer. Optional for `true_false`, where it must be `["True","False"]` if given. |
| `answer` | string | must match **exactly one** option when options exist. Typed `fill_blank` answers are compared case-insensitively, ignoring extra spaces and a final period. `true_false` uses `"True"` or `"False"`. |
| `passage_id` | id | required for `reading_mcq` |
| `tts_text` | string | required for `listening_mcq`. It is spoken aloud and never shown. |
| `explanation` | string | 1–2 kid-friendly sentences, shown after answering |
| `image` | optional base64 image data URI | |

### Rules checked on import

- Schema errors (missing or unknown fields, wrong types, answer not among the options, and so on).
- Duplicate ids within the pack.
- References must resolve **inside the same pack**: `questions[].topic_id`, `questions[].passage_id`,
  `passages[].topic_id` and the keys of `competitions[].topic_weights`. Packs are self-contained.
  If you add questions to a topic from another pack, include that topic again with the same id.
- Any error rejects the **whole file**. Nothing is partially imported. The app lists every problem
  by item and field, for example `questions[3] (id "q-004") → answer: answer "kitty" must match exactly one option`.

### How importing works

- Import is an **upsert by `id`** for topics, competitions, passages and questions, done in one transaction.
- Before you confirm, you see a preview such as "+12 new questions, 3 questions updated, +2 new topics".
- Progress (profiles, answers, review queue, practice sets) is never touched by an import.
- Deleting a pack removes the items it last wrote. Topics and passages that other packs still use are kept.
  Progress is kept.
- Parent mode → Data → **Export question bank** writes everything on the device as one importable pack.

### Full example

```json
{
  "schema_version": 1,
  "pack_id": "olimpiade-x-g3-2026",
  "pack_version": 1,
  "title": "Olimpiade X — Grade 3 practice",
  "topics": [
    { "id": "prep-place", "category": "grammar", "name": "Prepositions of place", "grade_min": 2, "grade_max": 4 },
    { "id": "v-animals", "category": "vocabulary", "name": "Animals", "grade_min": 2, "grade_max": 4 },
    { "id": "reading-narrative", "category": "reading", "name": "Reading: stories", "grade_min": 3, "grade_max": 4 },
    { "id": "listening-daily", "category": "listening", "name": "Listening: daily life", "grade_min": 2, "grade_max": 4 }
  ],
  "competitions": [
    {
      "id": "olimpiade-x-g3",
      "name": "Olimpiade X",
      "grade": 3,
      "format": { "question_count": 30, "time_limit_min": 45 },
      "topic_weights": { "prep-place": 0.3, "v-animals": 0.3, "reading-narrative": 0.25, "listening-daily": 0.15 }
    }
  ],
  "passages": [
    {
      "id": "p-001",
      "topic_id": "reading-narrative",
      "title": "The Red Ball",
      "text": "Sam had a red ball. He played with it in the garden every day.\n\nOne day, the ball rolled under the fence. Sam's dog, Max, crawled under the fence and brought it back."
    }
  ],
  "questions": [
    {
      "id": "q-001", "topic_id": "prep-place", "grade": 3, "difficulty": 1, "type": "mcq",
      "prompt": "I put my book inside my bag. The book is ___ the bag.",
      "options": ["in", "on", "under"], "answer": "in",
      "explanation": "When something is inside, we use \"in\"."
    },
    {
      "id": "q-002", "topic_id": "prep-place", "grade": 3, "difficulty": 2, "type": "fill_blank",
      "prompt": "The picture hangs ___ the wall.",
      "options": ["on", "in", "under"], "answer": "on",
      "explanation": "A picture touches the wall's surface, so it is \"on\" the wall."
    },
    {
      "id": "q-003", "topic_id": "v-animals", "grade": 3, "difficulty": 2, "type": "fill_blank",
      "prompt": "A baby dog is called a ___. (Type the word.)",
      "answer": "puppy",
      "explanation": "A baby dog is a puppy. A baby cat is a kitten."
    },
    {
      "id": "q-004", "topic_id": "v-animals", "grade": 3, "difficulty": 1, "type": "true_false",
      "prompt": "A dolphin lives in the sea.",
      "answer": "True",
      "explanation": "Dolphins live and swim in the sea."
    },
    {
      "id": "q-005", "topic_id": "reading-narrative", "grade": 3, "difficulty": 1, "type": "reading_mcq",
      "passage_id": "p-001",
      "prompt": "Who brought the ball back?",
      "options": ["Max the dog", "Sam", "Sam's mom"], "answer": "Max the dog",
      "explanation": "The story says Max crawled under the fence and brought it back."
    },
    {
      "id": "q-006", "topic_id": "listening-daily", "grade": 3, "difficulty": 1, "type": "listening_mcq",
      "prompt": "Listen. What pet does Anna have?",
      "tts_text": "Hello! My name is Anna. I have a pet rabbit. Its name is Snowy.",
      "options": ["a rabbit", "a dog", "a cat"], "answer": "a rabbit",
      "explanation": "Anna said, \"I have a pet rabbit.\""
    }
  ]
}
```

To make new packs with an LLM, use [`docs/GENERATE_PACK_PROMPT.md`](docs/GENERATE_PACK_PROMPT.md), then run
`npm run validate-pack -- your-pack.json` before importing.

## Built-in content

`src/data/sample-grade3.json` is installed on first run (and upgraded when its `pack_version` increases).
It has 103 questions: 88 for grade 3 and 15 for grade 5.

- Grammar: articles, prepositions of place and time, singular and plural nouns, pronouns, conjunctions,
  simple present, simple past, present continuous
- Vocabulary: family, school, food, animals, house, body, jobs
- Reading: 6 passages (2 narrative, 2 informational, 2 descriptive) with 3–4 questions each
- Listening: 5 `listening_mcq` items
- Grade 5 preview: comparatives and superlatives, past continuous, modal verbs
- Competitions: "Grade 3 English Olympiad (sample)" (30 questions / 45 min) and
  "Grade 5 English Olympiad (sample)" (20 questions / 30 min)

## How the learning logic works

- **Sampling:** a competition preset uses its `topic_weights`. Hand-picked and weak-topic sets give each
  topic the same weight. Questions never repeat within a session. Questions that share a reading passage
  are kept together. Option order is shuffled for each attempt. True/false always shows True, then False.
- **Weak topics:** topics with accuracy below 70% over that topic's last 20 answers. A topic needs at
  least 3 answers before it is judged.
- **Review (Leitner):** a wrong answer puts the question in box 1, which is due right away. A correct
  review moves it to box 2 (due in 1 day), then box 3 (due in 3 days). One more correct answer removes it
  from the queue. A wrong answer at any point sends it back to box 1.
- **Stars:** 3 stars for 90% or more, 2 stars for 70% or more, otherwise 1 star.
- **Timed mode:** questions left unanswered when time runs out count as not correct on the score
  screen. They are not saved as answers.

## Project layout

```
src/domain/    pure logic: schema, sampling, Leitner, stats, answer checking   (unit-tested)
src/import/    validation, import preview/upsert, backup, bank export          (unit-tested)
src/db/        IndexedDB (idb) schema and repository helpers
src/ui/        Preact components (kid/, parent/)
src/data/      built-in sample pack
scripts/       validate-pack CLI
tests/         Vitest specs
```

## Known limitations

- Speech depends on the voices installed on the device. iOS only speaks after a tap, so
  listening questions never play automatically.
- Data lives on one device. Use backup and restore to move it to another iPad. There is no sync.
- Safari can still clear storage in rare cases. Export backups regularly.
- Typed `fill_blank` answers must match the single `answer` string (after normalising case and spacing).
  There are no alternative accepted answers yet.
- Packs must be self-contained. Cross-pack references are not resolved during validation.
