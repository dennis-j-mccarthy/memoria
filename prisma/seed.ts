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
  set: string; // content-set slug this prayer belongs to
  source?: string;
  language?: string; // defaults "en"
  tier?: number; // defaults 1
  tags?: string[];
  popularity?: number;
  dialogic?: boolean;
  lines: SeedSegment[];
}

// Content sets shown as categories on the home page (ordered by sortOrder).
const SETS = [
  {
    slug: "the-rosary",
    title: "The Rosary",
    description:
      "Every prayer of the Holy Rosary, in the order you pray them — from the Sign of the Cross to the Hail Holy Queen — plus the Joyful Mysteries.",
    sortOrder: 0,
  },
  {
    slug: "catholic-prayers",
    title: "Prayers & Devotions",
    description:
      "Foundational prayers and devotions of the Catholic tradition, marked up for recitation practice.",
    sortOrder: 1,
  },
];

const PRAYERS: SeedPassage[] = [
  {
    slug: "sign-of-the-cross",
    title: "Sign of the Cross",
    set: "the-rosary",
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
    set: "the-rosary",
    source: "The Lord's Prayer (traditional English)",
    tags: ["foundational", "lords-prayer"],
    popularity: 99,
    dialogic: true,
    lines: [
      { role: "CALLER", text: "Our Father, who art in heaven," },
      { role: "CALLER", text: "hallowed be thy name;" },
      { role: "CALLER", text: "thy kingdom come," },
      { role: "CALLER", text: "thy will be done" },
      { role: "CALLER", text: "on earth as it is in heaven." },
      { role: "CALLER", text: "Give us this day our daily bread," },
      { role: "CALLER", text: "and forgive us our trespasses," },
      { role: "CALLER", text: "as we forgive those who trespass against us;" },
      { role: "CALLER", text: "and lead us not into temptation," },
      { role: "RESPONDER", text: "but deliver us from evil." },
      { role: "RESPONDER", text: "Amen." },
    ],
  },
  {
    slug: "hail-mary",
    title: "Hail Mary",
    set: "the-rosary",
    tags: ["foundational", "marian"],
    popularity: 98,
    dialogic: true,
    lines: [
      { role: "CALLER", text: "Hail Mary, full of grace," },
      { role: "CALLER", text: "the Lord is with thee." },
      { role: "CALLER", text: "Blessed art thou amongst women," },
      { role: "CALLER", text: "and blessed is the fruit of thy womb, Jesus." },
      { role: "RESPONDER", text: "Holy Mary, Mother of God," },
      { role: "RESPONDER", text: "pray for us sinners," },
      { role: "RESPONDER", text: "now and at the hour of our death." },
      { role: "RESPONDER", text: "Amen." },
    ],
  },
  {
    slug: "glory-be",
    title: "Glory Be",
    set: "the-rosary",
    source: "Doxology (Gloria Patri, English)",
    tags: ["foundational", "doxology"],
    popularity: 95,
    dialogic: true,
    lines: [
      { role: "CALLER", text: "Glory be to the Father," },
      { role: "CALLER", text: "and to the Son," },
      { role: "CALLER", text: "and to the Holy Spirit." },
      { role: "RESPONDER", text: "As it was in the beginning," },
      { role: "RESPONDER", text: "is now, and ever shall be," },
      { role: "RESPONDER", text: "world without end." },
      { role: "RESPONDER", text: "Amen." },
    ],
  },
  {
    slug: "grace-before-meals",
    title: "Grace Before Meals",
    set: "catholic-prayers",
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
    set: "catholic-prayers",
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
    set: "catholic-prayers",
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
    slug: "st-michael",
    title: "Prayer to St. Michael",
    set: "catholic-prayers",
    source: "Leonine Prayer (Pope Leo XIII)",
    tags: ["angelic", "protection"],
    popularity: 87,
    lines: [
      { text: "St. Michael the Archangel, defend us in battle." },
      { text: "Be our defense against the wickedness and snares of the devil." },
      { text: "May God rebuke him, we humbly pray;" },
      { text: "and do thou, O Prince of the heavenly hosts," },
      { text: "by the power of God, cast into hell Satan," },
      { text: "and all the evil spirits who prowl about the world" },
      { text: "seeking the ruin of souls." },
      { text: "Amen." },
    ],
  },
  {
    slug: "apostles-creed",
    title: "Apostles' Creed",
    set: "the-rosary",
    source: "Roman Missal, 3rd ed. (current ICEL/USCCB translation)",
    tier: 2,
    tags: ["creed", "profession-of-faith"],
    popularity: 80,
    dialogic: true,
    lines: [
      { role: "CALLER", text: "I believe in God, the Father almighty," },
      { role: "CALLER", text: "Creator of heaven and earth," },
      { role: "CALLER", text: "and in Jesus Christ, his only Son, our Lord," },
      { role: "CALLER", text: "who was conceived by the Holy Spirit," },
      { role: "CALLER", text: "born of the Virgin Mary," },
      { role: "CALLER", text: "suffered under Pontius Pilate," },
      { role: "CALLER", text: "was crucified, died and was buried;" },
      { role: "CALLER", text: "he descended into hell;" },
      { role: "CALLER", text: "on the third day he rose again from the dead;" },
      { role: "CALLER", text: "he ascended into heaven," },
      { role: "CALLER", text: "and is seated at the right hand of God the Father almighty;" },
      { role: "CALLER", text: "from there he will come to judge the living and the dead." },
      { role: "RESPONDER", text: "I believe in the Holy Spirit," },
      { role: "RESPONDER", text: "the holy catholic Church," },
      { role: "RESPONDER", text: "the communion of saints," },
      { role: "RESPONDER", text: "the forgiveness of sins," },
      { role: "RESPONDER", text: "the resurrection of the body," },
      { role: "RESPONDER", text: "and life everlasting." },
      { role: "RESPONDER", text: "Amen." },
    ],
  },
  {
    slug: "the-angelus",
    title: "The Angelus",
    set: "catholic-prayers",
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
  {
    slug: "o-my-jesus",
    title: "O My Jesus",
    set: "the-rosary",
    source: "The Fatima Prayer (said after each Glory Be)",
    tags: ["marian", "fatima", "rosary"],
    popularity: 93,
    lines: [
      { text: "O my Jesus, forgive us our sins," },
      { text: "save us from the fires of hell," },
      { text: "lead all souls to Heaven," },
      { text: "especially those most in need of thy mercy." },
    ],
  },
  {
    slug: "hail-holy-queen",
    title: "Hail, Holy Queen",
    set: "the-rosary",
    source: "Salve Regina (English) — concludes the Rosary",
    tier: 2,
    tags: ["marian", "rosary"],
    popularity: 92,
    lines: [
      { text: "Hail, holy Queen, Mother of mercy," },
      { text: "our life, our sweetness, and our hope." },
      { text: "To thee do we cry," },
      { text: "poor banished children of Eve." },
      { text: "To thee do we send up our sighs," },
      { text: "mourning and weeping in this valley of tears." },
      { text: "Turn then, most gracious advocate," },
      { text: "thine eyes of mercy toward us," },
      { text: "and after this our exile," },
      { text: "show unto us the blessed fruit of thy womb, Jesus." },
      { text: "O clement, O loving, O sweet Virgin Mary." },
    ],
  },
  {
    slug: "joyful-mysteries",
    title: "The Joyful Mysteries",
    set: "the-rosary",
    source: "Prayed on Mondays and Saturdays",
    tags: ["marian", "rosary", "mysteries"],
    popularity: 91,
    lines: [
      { text: "The Annunciation" },
      { text: "The Visitation" },
      { text: "The Nativity" },
      { text: "The Presentation in the Temple" },
      { text: "The Finding of Jesus in the Temple" },
    ],
  },
  {
    slug: "concluding-prayer",
    title: "O God, Whose Only Begotten Son",
    set: "the-rosary",
    source: "Concluding Prayer of the Holy Rosary",
    tier: 2,
    tags: ["marian", "rosary", "collect"],
    popularity: 70,
    lines: [
      { text: "O God, whose only begotten Son," },
      { text: "by his life, death, and resurrection," },
      { text: "has purchased for us the rewards of eternal life;" },
      { text: "grant, we beseech thee," },
      { text: "that meditating upon these mysteries" },
      { text: "of the most holy Rosary of the Blessed Virgin Mary," },
      { text: "we may imitate what they contain" },
      { text: "and obtain what they promise," },
      { text: "through the same Christ our Lord." },
      { text: "Amen." },
    ],
  },
];

async function main() {
  console.log("Seeding prayers…");

  // Upsert content sets and index them by slug.
  const setIdBySlug: Record<string, string> = {};
  for (const s of SETS) {
    const set = await db.contentSet.upsert({
      where: { slug: s.slug },
      create: {
        slug: s.slug,
        title: s.title,
        description: s.description,
        sortOrder: s.sortOrder,
      },
      update: {
        title: s.title,
        description: s.description,
        sortOrder: s.sortOrder,
      },
    });
    setIdBySlug[s.slug] = set.id;
  }

  for (const p of PRAYERS) {
    const contentSetId = setIdBySlug[p.set];
    if (!contentSetId) throw new Error(`Unknown set "${p.set}" for ${p.slug}`);
    const passage = await db.passage.upsert({
      where: { slug: p.slug },
      create: {
        contentSetId,
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
        contentSetId,
        title: p.title,
        source: p.source,
        tier: p.tier ?? 1,
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
