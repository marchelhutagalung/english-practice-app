# Prompt: generate a question pack with an LLM

Copy everything in the **Prompt** block below into your LLM. Fill in the `INPUTS` section first.
Save the reply as a `.json` file and check it before importing:

```bash
npm run validate-pack -- my-new-pack.json
```

Then read the questions yourself. The validator catches format mistakes. It cannot tell whether a
question is ambiguous or whether the "correct" answer is actually wrong. A parent or teacher should
skim every item before kids use it.

Tips:
- Generate 20–40 questions per request. Long outputs get sloppy. Make several packs, or several
  versions of one pack, and import them one at a time.
- To add more questions to an existing topic, give the LLM the existing topic object, with the same
  `id`, so it is included unchanged in the new pack. Packs must be self-contained.
- Use a new, unique id prefix for every batch, for example `q-g4-modals-b2-01`, so new questions
  never overwrite existing ones by accident. Reuse an id only when you want to replace that question.
- To publish a corrected version of a pack, keep the same `pack_id` and increase `pack_version`.

---

## Prompt

````text
You are an experienced primary-school English teacher and test writer. You write questions for
children aged 8–12 who are practising for English competitions (English is often their second language).

Create ONE question pack as a single JSON object that follows the SCHEMA exactly. Output ONLY the
JSON: no Markdown fences, no comments and no text before or after it.

=== INPUTS ===
pack_id: <e.g. "grade4-modals-batch1">
pack_version: <e.g. 1>
title: <e.g. "Grade 4 — Modal verbs (batch 1)">
grade: <e.g. 4>
topics (create each; use these exact ids):
  - id: <e.g. "g4-modals">, category: <grammar|vocabulary|reading|listening>, name: <"Modal verbs">, grade_min: <3>, grade_max: <5>
  - ...
question_count: <total number of questions, e.g. 30>
difficulty_mix: <e.g. 40% difficulty 1, 40% difficulty 2, 20% difficulty 3>
question_types: <e.g. mostly mcq, some fill_blank and true_false; for reading topics write N passages
                 with 3–4 reading_mcq each; for listening topics use listening_mcq>
id_prefix: <e.g. "q-g4-modals-b1-"; number questions 01, 02, ...>
competition (optional): <name, grade, question_count, time_limit_min, and topic weights — or "none">
extra guidance (optional): <themes, vocabulary lists, things to avoid, local context>

=== SCHEMA ===
{
  "schema_version": 1,
  "pack_id": string,
  "pack_version": integer >= 1,
  "title": string,
  "topics": [ { "id", "category": "grammar"|"vocabulary"|"reading"|"listening", "name", "grade_min", "grade_max" } ],
  "competitions": [ { "id", "name", "grade", "format": { "question_count", "time_limit_min" },
                      "topic_weights": { "<topic id>": number > 0, ... } } ],
  "passages": [ { "id", "topic_id", "title", "text" } ],
  "questions": [ {
      "id", "topic_id", "grade": integer, "difficulty": 1|2|3,
      "type": "mcq"|"fill_blank"|"true_false"|"reading_mcq"|"listening_mcq",
      "prompt": string,
      "options": [string, ...],      // 3 options preferred (2–6 allowed), all different
      "answer": string,              // must equal exactly one option, character for character
      "passage_id": string,          // reading_mcq only
      "tts_text": string,            // listening_mcq only
      "explanation": string          // 1–2 short, kind sentences for a child
  } ]
}

Rules:
- ids use only letters, digits, ".", "_" and "-". All ids are unique.
- Every questions[].topic_id, passages[].topic_id and competition topic_weights key must be one of
  the topic ids in this pack. Every passage_id must be a passage in this pack.
- Do not add any field that is not in the schema. Leave optional fields out instead of using null.
- mcq / reading_mcq / listening_mcq: "options" is required. "answer" must match exactly one option.
- fill_blank: the prompt contains "___" (three underscores) where the word goes. Either give 3 options
  (a word bank) or leave options out so the child types the answer. Leave options out only when exactly
  one spelling is correct, and say what to type, e.g. "(Type the word.)" or "(buy)".
- true_false: leave options out. "answer" is "True" or "False". The prompt is a statement, not a question.
- reading_mcq: write the passage first (80–150 words for grades 3–4, 120–220 words for grades 5–6).
  Each question must be answerable from the passage alone.
- listening_mcq: "tts_text" is what a voice reads aloud (1–3 short sentences). The prompt starts with
  "Listen." and asks one question about it. The answer must not appear in the prompt.
- Language level: short sentences and common words for the target grade. Use American spelling consistently.
- Use a mix of names, places and everyday situations that kids recognise. Avoid scary, violent, sad,
  romantic, political, religious or brand-name content.
- Spread the correct answer's position: do not always put the answer first.
- Explanations teach the rule or point to the evidence ("The story says…"). Never blame the child.

=== SELF-CHECK (do this silently for EVERY question before you output) ===
1. Exactly one option is correct. Read every distractor inside the sentence. If a distractor is ALSO
   grammatical and makes sense (for example "the" and "a" both fit, or "in the bed" and "on the bed"),
   rewrite the question or change the distractor.
2. The prompt has enough context to rule out the other options (a time word like "yesterday" or "now",
   a hint like "I put it inside", "You can choose only one").
3. The answer is correct in standard English, and the explanation agrees with the answer.
4. The answer string matches one option character for character (case, spaces, punctuation).
5. Distractors are plausible mistakes a child might make, not silly or trick answers. No "all of the
   above" or "none of the above".
6. No two options mean the same thing, and no option is a substring trick.
7. The question does not give the answer away through grammar (for example "an ___" with only one
   option that starts with a vowel), unless that is the point being tested.
8. Reading: the answer is stated or clearly implied in the passage. Listening: the answer is in
   tts_text, and the prompt alone is not enough to answer.
9. The difficulty label fits: 1 = direct recall or a basic rule, 2 = needs a careful read or a less
   common rule, 3 = an irregular form, an inference or vocabulary in context.
10. The counts match the INPUTS (question_count, difficulty_mix, number of passages, 3–4 questions
    per passage).
11. The whole output is valid JSON: double quotes, no trailing commas, and inner quotes escaped as \".

If any check fails, fix the item before you output. Output only the final JSON.
````

---

## Example INPUTS

```text
pack_id: grade5-past-continuous-b1
pack_version: 1
title: Grade 5 — Past continuous (batch 1)
grade: 5
topics:
  - id: g5-past-continuous, category: grammar, name: Past continuous, grade_min: 4, grade_max: 6
  - id: r5-narrative, category: reading, name: Reading: stories (grade 5), grade_min: 5, grade_max: 6
question_count: 24
difficulty_mix: 30% difficulty 1, 50% difficulty 2, 20% difficulty 3
question_types: 16 grammar questions (12 mcq, 2 fill_blank with options, 2 true_false);
                2 narrative passages with 4 reading_mcq each
id_prefix: q-g5pc-b1-
competition: none
extra guidance: contrast past continuous with simple past ("when" / "while")
```

## After generating

1. `npm run validate-pack -- file.json`. Fix any reported item or field, or paste the errors back to the
   LLM and ask it to fix only those items.
2. Skim every question using the self-check list above.
3. Import the file on the iPad: Parent mode → Data → Import pack. Check the preview counts before you confirm.
