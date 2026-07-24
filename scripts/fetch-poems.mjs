/**
 * Fetch public-domain poem texts and emit prisma/poems.generated.json in the
 * SeedPassage shape. Poem TEXT is fetched from the sources, never hand-typed,
 * so it stays letter-exact.
 *
 * Sources:
 *  - PoetryDB (poetrydb.org, from Project Gutenberg) — matched locally against
 *    each author's full title list.
 *  - Wikisource — explicit page names first, then search-API discovery;
 *    extraction via <poem> blocks → raw wikitext lines → parsed HTML.
 *
 * Precision: every poem is WINDOWED — we find the line containing `verify`
 * (a first-line fragment) and take exactly `expect` lines from there (the
 * poem's canonical line count). Junk lines (headers, footnotes, interwiki,
 * stanza numerals, line numbers) are stripped first. A poem that can't be
 * windowed to its canonical shape is rejected, never approximated.
 *
 * Run: node scripts/fetch-poems.mjs   (resumable; delete the JSON to refetch)
 */

const WANT = 25;
const UA = { "user-agent": "memoria-seed/1.0 (public-domain poem fetch)" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// In display order (most beloved first). All public domain.
// expect: canonical line count(s) — first that fits is used.
const CANDIDATES = [
  { slug: "the-song-of-wandering-aengus", kind: "ws", title: "The Song of Wandering Aengus", source: "W. B. Yeats", verify: "hazel wood", expect: [24], pages: ["The Wind Among the Reeds/The Song of Wandering Aengus", "The Song of Wandering Aengus"], search: "The Song of Wandering Aengus Yeats" },
  { slug: "i-wandered-lonely-as-a-cloud", kind: "pdb", author: "William Wordsworth", match: ["i wandered lonely"], verify: "i wandered lonely", expect: [24] },
  { slug: "the-lake-isle-of-innisfree", kind: "ws", title: "The Lake Isle of Innisfree", source: "W. B. Yeats", verify: "arise and go now", expect: [12], pages: ["The Lake Isle of Innisfree", "The Countess Kathleen and Various Legends and Lyrics/The Lake Isle of Innisfree"], search: "The Lake Isle of Innisfree Yeats" },
  { slug: "trees", kind: "pdb", author: "Joyce Kilmer", match: ["trees"], verify: "shall never see", expect: [12] },
  { slug: "the-road-not-taken", kind: "ws", title: "The Road Not Taken", source: "Robert Frost", verify: "two roads diverged", expect: [20], pages: ["Mountain Interval/The Road Not Taken"], search: "The Road Not Taken Frost Mountain Interval" },
  { slug: "stopping-by-woods-on-a-snowy-evening", kind: "ws", title: "Stopping by Woods on a Snowy Evening", source: "Robert Frost", verify: "whose woods these are", expect: [16], pages: ["Stopping by Woods on a Snowy Evening"], search: "Stopping by Woods on a Snowy Evening Frost whose woods" },
  { slug: "pied-beauty", kind: "pdb", author: "Gerard Manley Hopkins", match: ["pied beauty"], verify: "dappled things", expect: [11] },
  { slug: "gods-grandeur", kind: "ws", title: "God's Grandeur", source: "Gerard Manley Hopkins", verify: "charged with the grandeur", expect: [14], pages: ["Poems of Gerard Manley Hopkins/God's Grandeur"], search: "God's Grandeur Hopkins" },
  { slug: "hope-is-the-thing-with-feathers", kind: "pdb", author: "Emily Dickinson", match: ["thing with feathers"], verify: "thing with feathers", expect: [12] },
  { slug: "love-iii", kind: "ws", title: "Love (III)", source: "George Herbert", verify: "love bade me welcome", expect: [18], pages: ["The Temple: Sacred Poems and Private Ejaculations/Love (III)"], search: "Love bade me welcome Herbert Temple" },
  { slug: "the-pulley", kind: "ws", title: "The Pulley", source: "George Herbert", verify: "when god at first made man", expect: [20], pages: ["The Temple: Sacred Poems and Private Ejaculations/The Pulley"], search: "The Pulley Herbert Temple" },
  { slug: "death-be-not-proud", kind: "pdb", author: "John Donne", match: ["death be not proud", "death, be not proud"], verify: "be not proud", expect: [14] },
  { slug: "up-hill", kind: "ws", title: "Up-Hill", source: "Christina Rossetti", verify: "does the road wind up-hill", expect: [16], pages: ["Goblin Market and Other Poems (1862)/Up-Hill", "Poems (Rossetti, 1901)/Up-Hill"], search: "Up-Hill Rossetti Goblin Market" },
  { slug: "in-the-bleak-midwinter", kind: "ws", title: "In the Bleak Midwinter", source: "Christina Rossetti", verify: "in the bleak mid-winter", expect: [40, 32], pages: ["Poems (Rossetti, 1901)/A Christmas Carol", "Our American Holidays - Christmas/A Christmas Carol (Rossetti)"], search: "A Christmas Carol Rossetti bleak mid-winter" },
  { slug: "crossing-the-bar", kind: "ws", title: "Crossing the Bar", source: "Alfred, Lord Tennyson", verify: "sunset and evening star", expect: [16], pages: ["Demeter and other poems/Crossing the Bar"], search: "Crossing the Bar Tennyson Demeter" },
  { slug: "on-his-blindness", kind: "ws", title: "On His Blindness", source: "John Milton", verify: "when i consider how my light is spent", expect: [14], pages: ["When I consider how my light is spent"], search: "When I consider how my light is spent Milton sonnet" },
  { slug: "the-lamb", kind: "pdb", author: "William Blake", match: ["the lamb"], verify: "who made thee", expect: [20] },
  { slug: "how-do-i-love-thee", kind: "ws", title: "How Do I Love Thee? (Sonnet 43)", source: "Elizabeth Barrett Browning", verify: "how do i love thee", expect: [14], pages: ["Sonnets from the Portuguese/XLIII", "Sonnets from the Portuguese (Barrett Browning)/XLIII"], search: "Sonnets from the Portuguese how do I love thee count the ways" },
  { slug: "requiem", kind: "ws", title: "Requiem", source: "Robert Louis Stevenson", verify: "under the wide and starry sky", expect: [8], pages: ["Underwoods/Requiem", "Requiem (Stevenson)", "Underwoods (Stevenson)/Book I/Requiem"], search: "Requiem Stevenson wide and starry sky" },
  { slug: "if", kind: "ws", title: "If—", source: "Rudyard Kipling", verify: "keep your head", expect: [32], pages: ["Rewards and Fairies/If—", "If— (Kipling)", "If (Kipling)"], search: "If Kipling keep your head Rewards" },
  { slug: "peace-vaughan", kind: "pdb", author: "Henry Vaughan", match: ["peace"], verify: "there is a countr", expect: [20] },
  { slug: "a-psalm-of-life", kind: "pdb", author: "Henry Wadsworth Longfellow", match: ["a psalm of life", "psalm of life"], verify: "in mournful numbers", expect: [36] },
  { slug: "abou-ben-adhem", kind: "ws", title: "Abou Ben Adhem", source: "Leigh Hunt", verify: "may his tribe increase", expect: [18], pages: ["Abou Ben Adhem", "Abou Ben Adhem (Hunt)"], search: "Abou Ben Adhem Leigh Hunt tribe increase" },
  { slug: "lead-kindly-light", kind: "ws", title: "Lead, Kindly Light", source: "St. John Henry Newman", verify: "lead, kindly light", expect: [18], pages: ["Lead, Kindly Light"], search: "Pillar of the Cloud Newman kindly light encircling gloom" },
  { slug: "composed-upon-westminster-bridge", kind: "ws", title: "Composed upon Westminster Bridge", source: "William Wordsworth", verify: "show more fair", expect: [14], pages: [], search: "Composed upon Westminster Bridge Wordsworth earth has not" },
  // Backups, used only if something above fails:
  { slug: "the-world-is-too-much-with-us", kind: "ws", title: "The World Is Too Much With Us", source: "William Wordsworth", verify: "too much with us", expect: [14], pages: ["The world is too much with us"], search: "The world is too much with us Wordsworth", backup: true },
  { slug: "to-autumn", kind: "pdb", author: "John Keats", match: ["to autumn"], verify: "mists and mellow fruitfulness", expect: [33], backup: true },
  { slug: "bright-star", kind: "pdb", author: "John Keats", match: ["bright star"], verify: "would i were steadfast", expect: [14], backup: true },
  { slug: "the-tyger", kind: "pdb", author: "William Blake", match: ["tyger"], verify: "burning bright", expect: [24], backup: true },
];

// ---- cleaning + windowing ---------------------------------------------------
const JUNK = [
  /^<!--/, /-->\s*$/, /^↑/, /^For other versions/i, /^Printed by/i,
  /^[a-z]{2,3}(-[a-z]+)?:\S/i, // interwiki links (ca:…, de:…)
  /^\(.*\)$/, // parenthetical-only (dedications)
  /^[IVXLC]+\.?$/, // stanza numerals
  /^The End\.?$/i, /^Notes$/i, /^License$/i, /^\d{4}$/,
  /^(listen to this text|sister projects|see also|related|information about|public domain|this work|versions of)/i,
  /^(←|→|\.{3,}|\d+)$/,
];
const isAllCapsSubtitle = (l) => l.length > 6 && /[A-Z]/.test(l) && l === l.toUpperCase() && !/[a-z]/.test(l);

function scrub(lines) {
  return lines
    .map((l) => l.replace(/^\d+\s+/, "").trim()) // printed line numbers ("1 My Soul…")
    .filter((l) => l && !JUNK.some((re) => re.test(l)) && !isAllCapsSubtitle(l));
}

const fold = (s) => s.toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, " ");

/** Window: start at the verify line, take exactly `expect` lines. */
function windowPoem(cand, rawLines) {
  const lines = scrub(rawLines);
  // The verify fragment can appear more than once: as a quoted title line
  // before the poem, or repeated inside it (refrains). Try unquoted matches
  // first, earliest first, and take the first window that fits.
  const matches = [];
  lines.forEach((l, i) => {
    if (fold(l).includes(fold(cand.verify))) matches.push(i);
  });
  const quoted = (i) => /^["\u201C'\u2018]/.test(lines[i]);
  const starts = [...matches.filter((i) => !quoted(i)), ...matches.filter(quoted)];
  for (const start of starts) {
    for (const n of cand.expect) {
      if (start + n <= lines.length) return lines.slice(start, start + n);
    }
  }
  return null;
}

// ---- PoetryDB ---------------------------------------------------------------
const titleCache = new Map();
async function pdbTitles(author) {
  if (titleCache.has(author)) return titleCache.get(author);
  const res = await fetch(`https://poetrydb.org/author/${encodeURIComponent(author)}/title`, { headers: UA });
  const data = res.ok ? await res.json() : null;
  const titles = Array.isArray(data) ? data.map((d) => d.title) : [];
  titleCache.set(author, titles);
  return titles;
}

async function fetchPdb(cand) {
  const titles = await pdbTitles(cand.author);
  let hit = null;
  for (const kw of cand.match) {
    hit = titles.find((t) => t.toLowerCase().includes(kw));
    if (hit) break;
  }
  if (!hit) return null;
  const res = await fetch(`https://poetrydb.org/author,title/${encodeURIComponent(cand.author)};${encodeURIComponent(hit)}`, { headers: UA });
  if (!res.ok) return null;
  const data = await res.json();
  const poem = Array.isArray(data) ? data.find((p) => p.title === hit) ?? data[0] : null;
  if (!poem) return null;
  const lines = windowPoem(cand, poem.lines.map((l) => l.trim()).filter(Boolean));
  return lines ? { source: poem.author, lines } : null;
}

// ---- Wikisource ---------------------------------------------------------------
const BAD_PAGES = /encyclop|dictionary of national biography|poets' chantry|category:|talk:|index:|portal:|author:/i;

function cleanWikitext(line) {
  return line
    .replace(/<br\s*\/?\s*>/gi, "")
    .replace(/\{\{[^{}]*\}\}/g, "")
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, "$1")
    .replace(/'''?/g, "")
    .replace(/<\/?[a-z][^>]*>/gi, "")
    .replace(/^[:;*#]+\s*/, "")
    .trim();
}

function linesFromRaw(raw) {
  const blocks = [...raw.matchAll(/<poem[^>]*>([\s\S]*?)<\/poem>/gi)].map((m) => m[1]);
  const body = blocks.length
    ? blocks.join("\n")
    : raw
        .replace(/\{\{header[\s\S]*?\n\}\}/i, "")
        .replace(/<!--[\s\S]*?-->/g, "");
  return body.split(/\r?\n/).map(cleanWikitext).filter(Boolean);
}

function linesFromHtml(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<sup[^>]*>[\s\S]*?<\/sup>/gi, "")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(p|div|h\d|li|tr|td)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#8217;|&rsquo;/g, "’")
    .replace(/&#8216;|&lsquo;/g, "‘").replace(/&#8212;|&mdash;/g, "—").replace(/&nbsp;/g, " ")
    .split(/\n/)
    .map((l) => l.trim())
    .filter((l) => l && l.length < 90);
}

async function wsSearch(query) {
  const res = await getWithRetry(
    `https://en.wikisource.org/w/api.php?action=query&list=search&srlimit=6&format=json&srsearch=${encodeURIComponent(query)}`,
  );
  if (!res) return [];
  const data = await res.json().catch(() => null);
  return (data?.query?.search ?? []).map((r) => r.title).filter((t) => !BAD_PAGES.test(t));
}

/** GET with retry/backoff — Wikisource rate-limits burst traffic (429/5xx). */
async function getWithRetry(url) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, { headers: UA });
    if (res.ok) return res;
    if (res.status === 404) return null;
    await sleep(4000 * (attempt + 1)); // back off and try again
  }
  return null;
}

async function wsRaw(page, depth = 0) {
  if (depth > 3) return null;
  const res = await getWithRetry(`https://en.wikisource.org/w/index.php?title=${encodeURIComponent(page)}&action=raw`);
  if (!res) return null;
  const text = await res.text();
  const redir = text.match(/^#REDIRECT\s*\[\[([^\]#|]+)/i);
  if (redir) return wsRaw(redir[1].trim(), depth + 1);
  return text;
}

async function wsHtml(page) {
  const res = await getWithRetry(
    `https://en.wikisource.org/w/api.php?action=parse&page=${encodeURIComponent(page)}&format=json&prop=text&disablelimitreport=1`,
  );
  if (!res) return null;
  const data = await res.json().catch(() => null);
  return data?.parse?.text?.["*"] ?? null;
}

async function fetchWs(cand) {
  const tried = new Set();
  const pages = [...(cand.pages ?? [])];
  for (let phase = 0; phase < 2; phase++) {
    if (phase === 1) {
      // Fall back to search only if the explicit pages didn't pan out.
      for (const t of await wsSearch(cand.search)) pages.push(t);
      await sleep(1200);
    }
    while (pages.length) {
      const page = pages.shift();
      if (tried.has(page)) continue;
      tried.add(page);
      const raw = await wsRaw(page);
      await sleep(1200);
      if (!raw) continue;
      if (/\{\{(versions|disambiguation|similar)/i.test(raw)) {
        // A versions page links the real editions — queue them.
        for (const m of raw.matchAll(/^\*\s*\[\[([^\]|#]+)/gm)) pages.unshift(m[1].trim());
        continue;
      }
      let lines = windowPoem(cand, linesFromRaw(raw));
      if (!lines && /<pages\s+index=/i.test(raw)) {
        const html = await wsHtml(page);
        await sleep(1200);
        if (html) lines = windowPoem(cand, linesFromHtml(html));
      }
      if (lines) return { source: cand.source, lines, page };
    }
  }
  return null;
}

// ---- main ---------------------------------------------------------------
const results = new Map();
// Resume: keep poems already fetched so a rerun only retries the missing ones.
try {
  const { readFileSync } = await import("node:fs");
  const prev = JSON.parse(readFileSync("prisma/poems.generated.json", "utf8"));
  for (const p of prev) {
    results.set(p.slug, { source: p.source, lines: p.lines.map((l) => l.text) });
  }
  console.log(`Resuming with ${results.size} already fetched.`);
} catch {}

// Re-window resumed entries under the stricter rules; refetch what fails.
for (const cand of CANDIDATES) {
  const r = results.get(cand.slug);
  if (!r) continue;
  const w = windowPoem(cand, r.lines);
  if (!w) {
    results.delete(cand.slug);
    console.log(`  ↻ ${cand.slug} — cached copy failed strict check, refetching`);
  } else {
    r.lines = w;
  }
}

for (const cand of CANDIDATES) {
  const mainCount = CANDIDATES.filter((c) => !c.backup && results.has(c.slug)).length;
  if (cand.backup && mainCount >= WANT) continue;
  if (results.has(cand.slug)) continue;
  const poem = cand.kind === "pdb" ? await fetchPdb(cand) : await fetchWs(cand);
  if (!poem) {
    console.log(`  ✗ ${cand.slug} (${cand.kind}) — not found/verified`);
    continue;
  }
  results.set(cand.slug, poem);
  console.log(`  ✓ ${cand.slug} — ${poem.source} (${poem.lines.length} lines)${poem.page ? ` [ws: ${poem.page}]` : ""}`);
}

// PDB candidates carry no display title; map them here.
const PDB_TITLES = {
  "i-wandered-lonely-as-a-cloud": "I Wandered Lonely as a Cloud",
  trees: "Trees",
  "pied-beauty": "Pied Beauty",
  "hope-is-the-thing-with-feathers": "“Hope” is the thing with feathers",
  "death-be-not-proud": "Death, Be Not Proud",
  "the-lamb": "The Lamb",
  "peace-vaughan": "Peace",
  "a-psalm-of-life": "A Psalm of Life",
  "to-autumn": "To Autumn",
  "bright-star": "Bright Star",
  "the-tyger": "The Tyger",
};

const ordered = CANDIDATES.filter((c) => results.has(c.slug));
const found = ordered.slice(0, WANT).map((c, i) => ({
  slug: c.slug,
  title: c.title ?? PDB_TITLES[c.slug] ?? c.slug,
  set: "poems",
  source: c.source ?? results.get(c.slug).source,
  tags: ["poem"],
  popularity: 50 - i,
  lines: results.get(c.slug).lines.map((text) => ({ text })),
}));

console.log(`\nFound ${found.length}/${WANT}.`);

const { writeFileSync } = await import("node:fs");
writeFileSync("prisma/poems.generated.json", JSON.stringify(found, null, 2) + "\n");
console.log(`Wrote prisma/poems.generated.json (${found.length} poems)`);
