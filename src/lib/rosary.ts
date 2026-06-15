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
    centerpiece: [
      { title: "Glory Be", slug: "glory-be" },
      { title: "Hail, Holy Queen", slug: "hail-holy-queen" },
      { title: "O God, Whose Only Begotten Son", slug: "concluding-prayer" },
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
