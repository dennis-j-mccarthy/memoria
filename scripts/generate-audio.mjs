/* Generate narration audio for every segment, in each voice, via OpenAI TTS.
 * Idempotent: skips files that already exist. Run: `node scripts/generate-audio.mjs`
 * (with OPENAI_API_KEY and DATABASE_URL in the environment).
 */
import pg from "pg";
import { writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const KEY = process.env.OPENAI_API_KEY;
if (!KEY) throw new Error("OPENAI_API_KEY is not set");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");

const VOICES = ["onyx", "shimmer"];
const MODEL = "gpt-4o-mini-tts";
const INSTRUCTIONS =
  "Read in a calm, reverent, prayerful tone — unhurried, gentle, and clear.";
const CONCURRENCY = 6;

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const { rows } = await client.query(
  `select p.slug, s."order" as ord, s.text
   from "Segment" s join "Passage" p on p.id = s."passageId"
   order by p.slug, s."order"`,
);
await client.end();

// Build the work list (voice × segment), skipping anything already generated.
const jobs = [];
for (const v of VOICES) {
  await mkdir(path.join("public", "audio", v), { recursive: true });
  for (const r of rows) {
    const file = path.join("public", "audio", v, `${r.slug}-${r.ord}.mp3`);
    if (!existsSync(file)) jobs.push({ voice: v, text: r.text, file });
  }
}

console.log(
  `${rows.length} segments × ${VOICES.length} voices · ${jobs.length} to generate, ${rows.length * VOICES.length - jobs.length} already done`,
);

let done = 0;
let failed = 0;
async function run(job) {
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      voice: job.voice,
      input: job.text,
      instructions: INSTRUCTIONS,
      response_format: "mp3",
    }),
  });
  if (!res.ok) {
    failed += 1;
    console.error(`✗ ${job.file}: ${res.status} ${await res.text()}`);
    return;
  }
  await writeFile(job.file, Buffer.from(await res.arrayBuffer()));
  done += 1;
  if (done % 10 === 0 || done === jobs.length) {
    console.log(`  ${done}/${jobs.length}`);
  }
}

// Simple concurrency pool.
let i = 0;
async function worker() {
  while (i < jobs.length) {
    const job = jobs[i++];
    await run(job);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

console.log(`Done. ${done} generated, ${failed} failed.`);
if (failed > 0) process.exit(1);
