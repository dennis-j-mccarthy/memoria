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
  {
    slug: "apostles-creed",
    title: "Apostles' Creed",
    source: "Roman Missal, 3rd ed. (current ICEL/USCCB translation)",
    tier: 2,
    tags: ["creed", "profession-of-faith"],
    popularity: 80,
    lines: [
      { text: "I believe in God, the Father almighty," },
      { text: "Creator of heaven and earth," },
      { text: "and in Jesus Christ, his only Son, our Lord," },
      { text: "who was conceived by the Holy Spirit," },
      { text: "born of the Virgin Mary," },
      { text: "suffered under Pontius Pilate," },
      { text: "was crucified, died and was buried;" },
      { text: "he descended into hell;" },
      { text: "on the third day he rose again from the dead;" },
      { text: "he ascended into heaven," },
      { text: "and is seated at the right hand of God the Father almighty;" },
      { text: "from there he will come to judge the living and the dead." },
      { text: "I believe in the Holy Spirit," },
      { text: "the holy catholic Church," },
      { text: "the communion of saints," },
      { text: "the forgiveness of sins," },
      { text: "the resurrection of the body," },
      { text: "and life everlasting." },
      { text: "Amen." },
    ],
  },
  {
    slug: "the-angelus",
    title: "The Angelus",
    source: "Traditional (V./R. throughout)",
    tier: 2,
    tags: ["marian", "dialogic", "call-and-response"],
    popularity: 70,
    dialogic: true,
    lines: [
      { role: "CALLER", text: "The Angel of the Lord declared unto Mary," },
      { role: "RESPONDER", text: "and she conceived of the Holy Spirit." },
      {
        role: "UNISON",
        text: "Hail Mary, full of grace, the Lord is with thee. Blessed art thou amongst women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.",
      },
      { role: "CALLER", text: "Behold the handmaid of the Lord." },
      { role: "RESPONDER", text: "Be it done unto me according to thy word." },
      {
        role: "UNISON",
        text: "Hail Mary, full of grace, the Lord is with thee. Blessed art thou amongst women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.",
      },
      { role: "CALLER", text: "And the Word was made flesh," },
      { role: "RESPONDER", text: "and dwelt among us." },
      {
        role: "UNISON",
        text: "Hail Mary, full of grace, the Lord is with thee. Blessed art thou amongst women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.",
      },
      { role: "CALLER", text: "Pray for us, O holy Mother of God," },
      {
        role: "RESPONDER",
        text: "that we may be made worthy of the promises of Christ.",
      },
      {
        role: "CALLER",
        text: "Let us pray. Pour forth, we beseech thee, O Lord, thy grace into our hearts; that we, to whom the Incarnation of Christ thy Son was made known by the message of an angel, may by his Passion and Cross be brought to the glory of his Resurrection. Through the same Christ our Lord.",
      },
      { role: "RESPONDER", text: "Amen." },
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
