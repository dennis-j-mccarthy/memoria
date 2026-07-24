# Memoria — session handoff

Catholic prayer–memorization app. Next.js 16 (App Router, Turbopack), React 19,
Prisma 7 on Neon Postgres, pre-generated OpenAI TTS narration. This file is the
orientation doc for a fresh session/login; the git log tells the rest.

## Run it

```
# dev server — ALWAYS via the Claude preview pane, never bare `npm run dev`:
#   preview_start name="memoria"   → pinned to http://localhost:5122
```

- Port **5122** is pinned in `.claude/launch.json` (`next dev -- --port 5122`).
  Port 3000 is occupied by another local project; before pinning, every restart
  landed on a random port and broke saved links.
- Env lives in `.env`: `DATABASE_URL` (Neon), `OPENAI_API_KEY` (TTS), `AUTH_SECRET`.

Deep links (client-side routing via query params):

| View | URL |
| --- | --- |
| Home library | `/` |
| Reader | `/?view=player&prayer=<slug>` |
| Practice | `/?view=practice&prayer=<slug>&ex=recite\|type&mode=line\|buildup` |
| Rosary / chaplet diagram | `/?view=devotion&prayer=<slug>` |

## Content pipeline

- `prisma/seed.ts` — idempotent (`upsert` by slug + replace segments). Run with
  `npm run db:seed`. Sets: The Rosary (9), Prayers & Devotions (6),
  **Sacred Scripture (25, Douay-Rheims)**, **Poems (25, public domain)**.
  Currently **65 passages / 696 segments**.
- `prisma/poems.generated.json` — the 25 poems, produced by
  `scripts/fetch-poems.mjs` (PoetryDB + Wikisource). **Never type poem text
  through the model** — long verbatim verse in model output trips the API
  content filter (400). Fetch → disk → DB only. The script is resumable
  (delete the JSON to refetch) and windows each poem from a verified first-line
  fragment to its canonical line count.
- `scripts/generate-audio.mjs` — OpenAI TTS (`gpt-4o-mini-tts`), voices
  `onyx` (Male) / `shimmer` (Female), one mp3 per segment per voice into
  `public/audio/<voice>/<slug>-<order>.mp3`. Idempotent (skips existing).
  Run `node --env-file=.env scripts/generate-audio.mjs` **after adding any
  passage**, or its audio silently falls back to browser TTS.
  All 696×2 clips are generated and committed.

## App structure (the parts that matter)

- `src/components/immersive/Immersive.tsx` — the whole SPA. Routes:
  `library` (default/home) · `player` (reader) · `practice` · `devotion` ·
  `profile` (unreachable, stub) · `home` (old dashboard, orphaned by request).
  - Home library: grouped **accordion** sections per content set; poem cards
    show the poet; card play button reads the prayer aloud (Male/Female toggle).
  - Player: `⌂ Home` + `✎ Edit` chips in the header. Edit mode = tap words to
    toggle anchors, ▶/◀ arrows move lines between call and response; saved to
    localStorage key `memoria-overrides` (NOT the DB yet).
  - Practice: recite (line-by-line / build-up, SpeechRecognition) and inline
    type exercise (off-screen input, word-by-word feedback). Recite footer
    mirrors the reader dock; per-line Recite/Hear/Reveal icons ride the active
    line.
- `src/components/RosaryDiagram.tsx` — SVG bead diagram (devotion view).
  Hover highlights **all related beads** (shared prayer, orange ring) and shows
  the full prayer centred in the loop with prev/next paging on multi-prayer
  beads + a Practice chip. Mystery-of-the-day callouts label the 5 decade beads.
- `src/lib/immersive.ts` — DB → app mapping. `cr` (call-and-response) is false
  for the reading sets (`sacred-scripture`, `poems`); icons per set.
- `src/lib/rosary.ts` — bead/prayer data, `MYSTERY_BY_DAY`, sequences.
- Old server-rendered pages under `src/app/prayers/[slug]` still exist but the
  immersive SPA at `/` is the product.

## Known gaps / next steps

- 3 poems couldn't be sourced cleanly and were replaced by backups: Herbert's
  *Love (III)*, Frost's *Stopping by Woods*, Newman's *Lead, Kindly Light*.
  To add one: paste the text into `poems.generated.json` (user-provided text is
  fine), re-seed, re-run audio.
- Anchor/role edits persist per-device only (localStorage); DB write-back is
  stubbed (`editStatus` machinery exists).
- Profile screen exists but nothing navigates to it; stats on it are placeholders.
- The old `home` dashboard route is orphaned (user chose the library as home).
- `npx tsc --noEmit` is clean; there's no test suite.

## Working-style notes (hard-won)

- Verify UI changes in the preview pane; HMR sometimes hard-reloads and drops
  route state ("drifts to library") — re-navigate by URL and continue.
- The design tokens live in `globals.css`: `--gold` is **blue** (#2563eb),
  `--accent` is orange — don't trust the names.
- DB content is sacred-text: never paraphrase; seed comments cite sources.
