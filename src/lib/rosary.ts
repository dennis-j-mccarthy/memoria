/* ------------------------------------------------------------------ *
 * Where each prayer falls on the rosary beads. Fixed liturgical
 * reference (per USCCB / EWTN "How to pray the Rosary"), so it lives in
 * code rather than the DB. Keyed by passage slug; prayers said more than
 * once list every bead they belong to.
 * ------------------------------------------------------------------ */
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
};
