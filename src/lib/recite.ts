/* ------------------------------------------------------------------ *
 * Recitation matching: compare what the reader *said* against the
 * expected line, tolerantly, so anchors-only practice can light up the
 * words as they're spoken. Word indices here align with the same
 * whitespace split used by ConnectiveText / connectiveIndices.
 * ------------------------------------------------------------------ */

/** Lowercase, strip diacritics and punctuation. "Amen," -> "amen". */
export function normalizeWord(w: string): string {
  return w
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritics
    .replace(/[^a-z0-9]/g, "");
}

/** Split a line into word tokens, index-aligned with connectiveIndices. */
export function toWords(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

/** Classic Levenshtein, bounded use only (short words). */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array<number>(n + 1);
  for (let i = 1; i <= m; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= n; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/** Two normalized words count as a match if equal, or near-equal when long. */
export function wordsClose(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  // Tolerate a single transcription slip on longer words (homophones,
  // pluralization, ASR noise) without matching unrelated short words.
  if (a.length >= 4 && b.length >= 4 && levenshtein(a, b) <= 1) return true;
  return false;
}

/**
 * Greedily match the spoken transcript against the expected words, in order,
 * allowing skips. Returns the set of expected word indices that were heard.
 * Punctuation-only tokens (no letters) are treated as automatically present.
 */
export function matchSpoken(expected: string[], spokenText: string): Set<number> {
  const spoken = toWords(spokenText).map(normalizeWord).filter(Boolean);
  const matched = new Set<number>();
  let cursor = 0;
  for (let ei = 0; ei < expected.length; ei += 1) {
    const target = normalizeWord(expected[ei]);
    if (!target) {
      // e.g. a stray "—" token: nothing to say, count it as covered.
      matched.add(ei);
      continue;
    }
    for (let k = cursor; k < spoken.length; k += 1) {
      if (wordsClose(target, spoken[k])) {
        matched.add(ei);
        cursor = k + 1;
        break;
      }
    }
  }
  return matched;
}

/** Indices of words that carry real (spoken) content, for coverage scoring. */
export function realWordIndices(words: string[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < words.length; i += 1) {
    if (normalizeWord(words[i])) out.push(i);
  }
  return out;
}
