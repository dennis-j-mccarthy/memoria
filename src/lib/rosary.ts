/* ------------------------------------------------------------------ *
 * Where each prayer falls on the beads, for the visual diagram. Two
 * devotions use the same five-decade rosary beads with different prayers:
 * the Rosary itself, and the Chaplet of Divine Mercy. Fixed liturgical
 * reference (USCCB / EWTN / TheDivineMercy.org), so it lives in code.
 * ------------------------------------------------------------------ */
export interface RosaryHighlight {
  crucifix?: boolean;
  pendantOF?: boolean; // the single large bead on the pendant
  pendantHM?: boolean; // the three small beads on the pendant
  decadeOF?: boolean; // the five large "Our Father" beads on the loop
  decadeHM?: boolean; // the fifty small "Hail Mary" beads on the loop
  centerpiece?: boolean; // the centerpiece medal
  afterDecade?: boolean; // on the chain after each decade
}

/** The kinds of bead/position a reader can click in the diagram. */
export type BeadType =
  | "crucifix"
  | "pendantOF"
  | "pendantHM"
  | "decadeOF"
  | "decadeHM"
  | "centerpiece"
  | "afterDecade";

export type Devotion = "rosary" | "chaplet";

/** Both devotions share the same beads — the diagram offers them as tabs. */
export const DEVOTIONS: Devotion[] = ["rosary", "chaplet"];
export const DEVOTION_LABEL: Record<Devotion, string> = {
  rosary: "The Rosary",
  chaplet: "Divine Mercy",
};

type PrayerRef = { title: string; slug: string };

/** Which prayer(s) are said on each bead, per devotion (some beads carry several). */
export const BEAD_PRAYERS_BY_DEVOTION: Record<
  Devotion,
  Record<BeadType, PrayerRef[]>
> = {
  rosary: {
    crucifix: [
      { title: "Sign of the Cross", slug: "sign-of-the-cross" },
      { title: "Apostles' Creed", slug: "apostles-creed" },
    ],
    pendantOF: [{ title: "Our Father", slug: "our-father" }],
    pendantHM: [{ title: "Hail Mary", slug: "hail-mary" }],
    decadeOF: [
      { title: "The Joyful Mysteries", slug: "joyful-mysteries" },
      { title: "Our Father", slug: "our-father" },
    ],
    decadeHM: [{ title: "Hail Mary", slug: "hail-mary" }],
    // The Mary medallion. Opens with the Glory Be; at the very end of the
    // rosary you pray Hail, Holy Queen, the concluding prayer, then the Sign
    // of the Cross ("In the name of the Father…").
    centerpiece: [
      { title: "Glory Be", slug: "glory-be" },
      { title: "Hail, Holy Queen", slug: "hail-holy-queen" },
      { title: "O God, Whose Only Begotten Son", slug: "concluding-prayer" },
      { title: "Sign of the Cross", slug: "sign-of-the-cross" },
    ],
    afterDecade: [
      { title: "Glory Be", slug: "glory-be" },
      { title: "O My Jesus", slug: "o-my-jesus" },
    ],
  },
  chaplet: {
    crucifix: [{ title: "Sign of the Cross", slug: "sign-of-the-cross" }],
    pendantOF: [{ title: "Our Father", slug: "our-father" }],
    pendantHM: [
      { title: "Hail Mary", slug: "hail-mary" },
      { title: "Apostles' Creed", slug: "apostles-creed" },
    ],
    decadeOF: [{ title: "The Eternal Father", slug: "divine-mercy-chaplet" }],
    decadeHM: [
      {
        title: "For the sake of His sorrowful Passion",
        slug: "divine-mercy-chaplet",
      },
    ],
    centerpiece: [
      { title: "Holy God (×3 to close)", slug: "divine-mercy-chaplet" },
    ],
    afterDecade: [
      {
        title: "For the sake of His sorrowful Passion",
        slug: "divine-mercy-chaplet",
      },
    ],
  },
};

/* ------------------------------------------------------------------ *
 * The praying SEQUENCE, for the numbered "Show the order" overlay on the
 * diagram. Only the positions where the prayer *changes* get a step — the
 * fifty repeating Hail Marys collapse into one decade unit. The tricky bits
 * are the opening run (crucifix → Our Father → 3 Hail Marys → centerpiece)
 * and the close, so those are spelled out. `type` ties each step back to a
 * BeadType in BEAD_PRAYERS_BY_DEVOTION above — keep the two in step. The
 * centerpiece does double duty (opening Glory Be + closing prayers), so it
 * deliberately appears twice in the Rosary sequence.
 * ------------------------------------------------------------------ */
export type SeqPhase = "open" | "decade" | "close";
export interface SeqStep {
  n: number;
  type: BeadType;
  short: string; // 1–3 words for the on-diagram badge legend
  full: string; // the full caption, shown in the ordered legend
  phase: SeqPhase;
}

export const ROSARY_SEQUENCE: Record<Devotion, SeqStep[]> = {
  rosary: [
    { n: 1, type: "crucifix", short: "Cross & Creed", full: "Sign of the Cross, then the Apostles' Creed.", phase: "open" },
    { n: 2, type: "pendantOF", short: "Our Father", full: "One Our Father on the first single bead.", phase: "open" },
    { n: 3, type: "pendantHM", short: "3 Hail Marys", full: "A Hail Mary on each of the three beads.", phase: "open" },
    { n: 4, type: "centerpiece", short: "Glory Be", full: "Glory Be — then announce the first mystery.", phase: "open" },
    { n: 5, type: "decadeOF", short: "Our Father", full: "Announce the mystery, then an Our Father on the large bead.", phase: "decade" },
    { n: 6, type: "decadeHM", short: "10 Hail Marys", full: "A Hail Mary on each of the ten small beads.", phase: "decade" },
    { n: 7, type: "afterDecade", short: "Glory Be · O My Jesus", full: "Glory Be, then the Fatima prayer (O My Jesus).", phase: "decade" },
    { n: 8, type: "centerpiece", short: "Hail, Holy Queen", full: "After five decades: Hail, Holy Queen and the closing prayer, then the Sign of the Cross.", phase: "close" },
  ],
  chaplet: [
    { n: 1, type: "crucifix", short: "Sign of the Cross", full: "Begin with the Sign of the Cross.", phase: "open" },
    { n: 2, type: "pendantOF", short: "Our Father", full: "One Our Father on the first single bead.", phase: "open" },
    { n: 3, type: "pendantHM", short: "Hail Mary & Creed", full: "A Hail Mary, then the Apostles' Creed.", phase: "open" },
    { n: 4, type: "decadeOF", short: "Eternal Father", full: "On each large bead: “Eternal Father, I offer You…”", phase: "decade" },
    { n: 5, type: "decadeHM", short: "×10 Passion", full: "On each of the ten small beads: “For the sake of His sorrowful Passion…”", phase: "decade" },
    { n: 6, type: "centerpiece", short: "Holy God ×3", full: "To close: “Holy God, Holy Mighty One…” three times.", phase: "close" },
  ],
};

/* ------------------------------------------------------------------ *
 * The four sets of mysteries. Which set you meditate on depends on the day
 * of the week (USCCB): Joyful (Mon/Sat), Sorrowful (Tue/Fri), Glorious
 * (Wed/Sun), Luminous (Thu). Names only — the meditation, not the citation.
 * ------------------------------------------------------------------ */
export type MysteryKey = "joyful" | "sorrowful" | "glorious" | "luminous";
export interface MysterySet {
  key: MysteryKey;
  title: string;
  days: string;
  mysteries: string[];
}

export const MYSTERY_SETS: Record<MysteryKey, MysterySet> = {
  joyful: {
    key: "joyful",
    title: "The Joyful Mysteries",
    days: "Monday & Saturday",
    mysteries: [
      "The Annunciation",
      "The Visitation",
      "The Birth of Our Lord",
      "The Presentation",
      "The Finding of Our Lord in the Temple",
    ],
  },
  luminous: {
    key: "luminous",
    title: "The Luminous Mysteries",
    days: "Thursday",
    mysteries: [
      "The Baptism of Our Lord",
      "The Wedding at Cana",
      "The Proclamation of the Kingdom of God",
      "The Transfiguration",
      "The Last Supper",
    ],
  },
  sorrowful: {
    key: "sorrowful",
    title: "The Sorrowful Mysteries",
    days: "Tuesday & Friday",
    mysteries: [
      "The Agony in the Garden",
      "The Scourging at the Pillar",
      "The Crowning with Thorns",
      "The Carrying of the Cross",
      "The Crucifixion",
    ],
  },
  glorious: {
    key: "glorious",
    title: "The Glorious Mysteries",
    days: "Wednesday & Sunday",
    mysteries: [
      "The Resurrection",
      "The Ascension",
      "The Descent of the Holy Spirit",
      "The Assumption of Mary",
      "The Coronation of Mary",
    ],
  },
};

// Indexed by JS getDay(): 0=Sunday … 6=Saturday.
const MYSTERY_BY_DAY: MysteryKey[] = [
  "glorious", // Sun
  "joyful", // Mon
  "sorrowful", // Tue
  "glorious", // Wed
  "luminous", // Thu
  "sorrowful", // Fri
  "joyful", // Sat
];

/** The set of mysteries meditated on for a given weekday (0=Sun…6=Sat). */
export function mysteriesForDay(day: number): MysterySet {
  return MYSTERY_SETS[MYSTERY_BY_DAY[day] ?? "joyful"];
}

/** Step numbers landing on each bead type (centerpiece can carry two). */
export function sequenceByType(devotion: Devotion): Map<BeadType, SeqStep[]> {
  const m = new Map<BeadType, SeqStep[]>();
  for (const step of ROSARY_SEQUENCE[devotion]) {
    const list = m.get(step.type) ?? [];
    list.push(step);
    m.set(step.type, list);
  }
  return m;
}

/** Which beads a given prayer occupies (gold in the diagram), keyed by slug. */
export const ROSARY_HIGHLIGHT: Record<string, RosaryHighlight> = {
  "sign-of-the-cross": { crucifix: true },
  "apostles-creed": { crucifix: true },
  "our-father": { pendantOF: true, decadeOF: true },
  "hail-mary": { pendantHM: true, decadeHM: true },
  "glory-be": { centerpiece: true, afterDecade: true },
  "o-my-jesus": { afterDecade: true },
  "joyful-mysteries": { decadeOF: true },
  "hail-holy-queen": { centerpiece: true },
  "concluding-prayer": { centerpiece: true },
  "divine-mercy-chaplet": {
    decadeOF: true,
    decadeHM: true,
    centerpiece: true,
  },
};

/** Plain-language note about where the prayer is said. */
export const ROSARY_BEADS: Record<string, string> = {
  "sign-of-the-cross":
    "On the crucifix to begin — and again at the very end.",
  "apostles-creed": "On the crucifix, after the Sign of the Cross.",
  "our-father":
    "The first single bead, then the large bead that opens each of the five decades (6 times in all).",
  "hail-mary":
    "The three opening beads, then every one of the ten small beads in each of the five decades (53 times in all).",
  "glory-be":
    "On the centerpiece medal, then after each of the five decades (6 times in all).",
  "o-my-jesus":
    "After the Glory Be at the end of each decade (5 times in all).",
  "joyful-mysteries":
    "Announced at the start of each of the five decades (Mondays and Saturdays).",
  "hail-holy-queen": "After the five decades are complete.",
  "concluding-prayer": "At the close, after the Hail, Holy Queen.",
  "divine-mercy-chaplet":
    "Prayed on ordinary rosary beads: the Eternal Father on each large bead, “For the sake of His sorrowful Passion” on the ten small beads of every decade, and Holy God three times to close.",
};

/** Which devotion's diagram a prayer belongs to (chaplet takes precedence). */
export function devotionForSlug(slug: string): Devotion | null {
  if (slug === "divine-mercy-chaplet") return "chaplet";
  if (slug in ROSARY_HIGHLIGHT) return "rosary";
  return null;
}

export function beadPrayers(devotion: Devotion, type: BeadType): PrayerRef[] {
  return BEAD_PRAYERS_BY_DEVOTION[devotion][type];
}

/**
 * Which beads light up gold for a prayer *within a given devotion*. Derived
 * from BEAD_PRAYERS_BY_DEVOTION so the two diagrams stay correct independently:
 * the same Our Father lights the decade beads in the Rosary but not in the
 * chaplet (where those beads carry the Eternal Father). Reproduces
 * ROSARY_HIGHLIGHT for a prayer's native devotion; returns an empty highlight
 * for a prayer the devotion never prays (its tab shows the bare beads).
 */
export function highlightForDevotion(devotion: Devotion, slug: string): RosaryHighlight {
  const map = BEAD_PRAYERS_BY_DEVOTION[devotion];
  const hl: RosaryHighlight = {};
  (Object.keys(map) as BeadType[]).forEach((type) => {
    if (map[type].some((p) => p.slug === slug)) {
      (hl as Record<BeadType, boolean>)[type] = true;
    }
  });
  return hl;
}

// Beads in praying order, so a devotion's prayers list reads top-to-bottom.
const BEAD_ORDER: BeadType[] = [
  "crucifix",
  "pendantOF",
  "pendantHM",
  "decadeOF",
  "decadeHM",
  "afterDecade",
  "centerpiece",
];

/**
 * Every distinct prayer prayed in a devotion, in praying order (deduped by
 * slug — a prayer said on several beads appears once). Lets the Player list a
 * prayer's companions instead of hiding them behind tapping dim beads.
 */
export function devotionPrayers(devotion: Devotion): PrayerRef[] {
  const seen = new Set<string>();
  const out: PrayerRef[] = [];
  for (const type of BEAD_ORDER) {
    for (const pr of BEAD_PRAYERS_BY_DEVOTION[devotion][type]) {
      if (seen.has(pr.slug)) continue;
      seen.add(pr.slug);
      out.push(pr);
    }
  }
  return out;
}

/**
 * The previous/next prayer in a devotion's praying order, for stepping through
 * the prayers from the diagram. Anchored on the given devotion's sequence; a
 * prayer not prayed in that devotion has no neighbours (both null).
 */
export function adjacentPrayers(
  devotion: Devotion,
  slug: string,
): { prev: PrayerRef | null; next: PrayerRef | null } {
  const list = devotionPrayers(devotion);
  const i = list.findIndex((p) => p.slug === slug);
  if (i === -1) return { prev: null, next: null };
  return {
    prev: i > 0 ? list[i - 1] : null,
    next: i < list.length - 1 ? list[i + 1] : null,
  };
}

/* ------------------------------------------------------------------ *
 * Library collections. A prayer can belong to more than one devotion
 * (the Our Father, Hail Mary, Glory Be and Apostles' Creed are prayed
 * in both the Rosary and the Chaplet of Divine Mercy), so collections
 * reference prayers by slug rather than owning them. The shared prayers
 * appear under every collection that uses them — intentional overlap.
 * Any prayer not named in a collection falls through to a catch-all
 * group in the Library, so newly seeded prayers never disappear.
 * ------------------------------------------------------------------ */
export interface Collection {
  title: string;
  slugs: string[]; // in praying order; may repeat slugs across collections
}

export const COLLECTIONS: Collection[] = [
  {
    title: "The Rosary",
    slugs: [
      "sign-of-the-cross",
      "apostles-creed",
      "our-father",
      "hail-mary",
      "joyful-mysteries",
      "glory-be",
      "o-my-jesus",
      "hail-holy-queen",
      "concluding-prayer",
    ],
  },
  {
    title: "Divine Mercy",
    slugs: [
      "sign-of-the-cross",
      "apostles-creed",
      "our-father",
      "hail-mary",
      "glory-be",
      "divine-mercy-chaplet",
    ],
  },
];
