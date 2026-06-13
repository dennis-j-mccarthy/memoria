import { db } from "@/lib/db";

/**
 * Seed: Catholic Prayers — Tier 1 (Foundational).
 *
 * Texts use the traditional/standard English wording in common liturgical use.
 * Per the product spec, sacred texts must not be paraphrased; these seven are
 * highly standardized. (Tier 2/3 — Creeds, Latin, dialogic prayers — will be
 * verified against USCCB / Roman Missal, 3rd ed. when added.)
 *
 * Each prayer is split into memorization-sized lines (Segments). "Connective
 * tissue" words (conjunctions/prepositions/relatives) are auto-detected and
 * stored as word indices so the UI can highlight them as memory anchors.
 */

// Words that act as the "scaffolding" of recited text (spec section 1.3).
const CONNECTIVES = new Set([
  "and", "or", "but", "nor", "so", "yet",
  "which", "who", "whom", "whose", "that", "as",
  "of", "to", "from", "through", "in", "on", "at", "by", "with",
  "for", "into", "unto", "upon", "amongst", "among", "because",
  "before", "after", "above", "below", "between", "without",
]);

/** Tokenize on whitespace; return indices of words that are connectives. */
function connectiveIndices(text: string): number[] {
  return text
    .split(/\s+/)
    .map((w, i) => [w.replace(/[^\p{L}]/gu, "").toLowerCase(), i] as const)
    .filter(([w]) => CONNECTIVES.has(w))
    .map(([, i]) => i);
}

type Role = "CALLER" | "RESPONDER" | "UNISON" | "SOLO";

interface SeedSegment {
  role?: Role; // defaults to SOLO
  text: string;
  lociHint?: string;
}

interface SeedPassage {
  slug: string;
  title: string;
  source?: string;
  language?: string; // defaults "en"
  tier?: number; // defaults 1
  tags?: string[];
  popularity?: number;
  dialogic?: boolean;
  lines: SeedSegment[];
}

const PRAYERS: SeedPassage[] = [
  {
    slug: "sign-of-the-cross",
    title: "Sign of the Cross",
    tags: ["foundational", "blessing"],
    popularity: 100,
    lines: [
      { text: "In the name of the Father, and of the Son, and of the Holy Spirit." },
      { text: "Amen." },
    ],
  },
  {
    slug: "our-father",
    title: "Our Father",
    source: "The Lord's Prayer (traditional English)",
    tags: ["foundational", "lords-prayer"],
    popularity: 99,
    lines: [
      { text: "Our Father, who art in heaven," },
      { text: "hallowed be thy name;" },
      { text: "thy kingdom come," },
      { text: "thy will be done" },
      { text: "on earth as it is in heaven." },
      { text: "Give us this day our daily bread," },
      { text: "and forgive us our trespasses," },
      { text: "as we forgive those who trespass against us;" },
      { text: "and lead us not into temptation," },
      { text: "but deliver us from evil." },
      { text: "Amen." },
    ],
  },
  {
    slug: "hail-mary",
    title: "Hail Mary",
    tags: ["foundational", "marian"],
    popularity: 98,
    lines: [
      { text: "Hail Mary, full of grace," },
      { text: "the Lord is with thee." },
      { text: "Blessed art thou amongst women," },
      { text: "and blessed is the fruit of thy womb, Jesus." },
      { text: "Holy Mary, Mother of God," },
      { text: "pray for us sinners," },
      { text: "now and at the hour of our death." },
      { text: "Amen." },
    ],
  },
  {
    slug: "glory-be",
    title: "Glory Be",
    source: "Doxology (Gloria Patri, English)",
    tags: ["foundational", "doxology"],
    popularity: 95,
    lines: [
      { text: "Glory be to the Father," },
      { text: "and to the Son," },
      { text: "and to the Holy Spirit." },
      { text: "As it was in the beginning," },
      { text: "is now, and ever shall be," },
      { text: "world without end." },
      { text: "Amen." },
    ],
  },
  {
    slug: "grace-before-meals",
    title: "Grace Before Meals",
    source: '"Bless us, O Lord" (traditional)',
    tags: ["foundational", "meal", "connective-showcase"],
    popularity: 90,
    lines: [
      { text: "Bless us, O Lord, and these thy gifts," },
      { text: "which we are about to receive from thy bounty," },
      { text: "through Christ our Lord." },
      { text: "Amen." },
    ],
  },
  {
    slug: "guardian-angel-prayer",
    title: "Guardian Angel Prayer",
    tags: ["foundational", "angelic"],
    popularity: 88,
    lines: [
      { text: "Angel of God, my guardian dear," },
      { text: "to whom God's love commits me here," },
      { text: "ever this day be at my side," },
      { text: "to light and guard, to rule and guide." },
      { text: "Amen." },
    ],
  },
  {
    slug: "act-of-contrition",
    title: "Act of Contrition",
    source: "Traditional form",
    tags: ["foundational", "penitential"],
    popularity: 85,
    lines: [
      { text: "O my God, I am heartily sorry for having offended thee," },
      { text: "and I detest all my sins because of thy just punishments," },
      { text: "but most of all because they offend thee, my God," },
      { text: "who art all good and deserving of all my love." },
      { text: "I firmly resolve, with the help of thy grace," },
      { text: "to sin no more and to avoid the near occasions of sin." },
      { text: "Amen." },
    ],
  },
];

async function main() {
  console.log("Seeding Catholic Prayers (Tier 1)…");

  const set = await db.contentSet.upsert({
    where: { slug: "catholic-prayers" },
    create: {
      slug: "catholic-prayers",
      title: "Catholic Prayers",
      description:
        "The flagship content set: foundational prayers of the Catholic tradition, marked up for recitation practice.",
      sortOrder: 0,
    },
    update: {
      title: "Catholic Prayers",
      description:
        "The flagship content set: foundational prayers of the Catholic tradition, marked up for recitation practice.",
    },
  });

  for (const p of PRAYERS) {
    const passage = await db.passage.upsert({
      where: { slug: p.slug },
      create: {
        contentSetId: set.id,
        slug: p.slug,
        title: p.title,
        source: p.source,
        language: p.language ?? "en",
        tier: p.tier ?? 1,
        tags: JSON.stringify(p.tags ?? []),
        popularity: p.popularity ?? 0,
        dialogic: p.dialogic ?? false,
      },
      update: {
        title: p.title,
        source: p.source,
        tags: JSON.stringify(p.tags ?? []),
        popularity: p.popularity ?? 0,
        dialogic: p.dialogic ?? false,
      },
    });

    // Replace segments so re-seeding is idempotent.
    await db.segment.deleteMany({ where: { passageId: passage.id } });
    await db.segment.createMany({
      data: p.lines.map((line, i) => ({
        passageId: passage.id,
        order: i,
        role: line.role ?? "SOLO",
        text: line.text,
        connectiveIndices: JSON.stringify(connectiveIndices(line.text)),
        lociHint: line.lociHint ?? null,
      })),
    });

    console.log(`  ✓ ${p.title} (${p.lines.length} lines)`);
  }

  const passageCount = await db.passage.count();
  const segmentCount = await db.segment.count();
  console.log(`Done. ${passageCount} passages, ${segmentCount} segments.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
