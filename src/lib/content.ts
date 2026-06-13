import { db } from "@/lib/db";

export type SegmentRole = "CALLER" | "RESPONDER" | "UNISON" | "SOLO";

export interface SegmentView {
  id: string;
  order: number;
  role: SegmentRole;
  text: string;
  /** word indices (0-based) that are connective-tissue anchors */
  connectiveIndices: number[];
  lociHint: string | null;
}

export interface PassageView {
  id: string;
  slug: string;
  title: string;
  source: string | null;
  language: string;
  tier: number;
  tags: string[];
  popularity: number;
  dialogic: boolean;
  segments: SegmentView[];
}

export interface ContentSetView {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  passages: PassageView[];
}

function parseJsonArray<T>(raw: string, fallback: T[]): T[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : fallback;
  } catch {
    return fallback;
  }
}

function toSegmentView(s: {
  id: string;
  order: number;
  role: string;
  text: string;
  connectiveIndices: string;
  lociHint: string | null;
}): SegmentView {
  return {
    id: s.id,
    order: s.order,
    role: (s.role as SegmentRole) ?? "SOLO",
    text: s.text,
    connectiveIndices: parseJsonArray<number>(s.connectiveIndices, []),
    lociHint: s.lociHint,
  };
}

function toPassageView(p: {
  id: string;
  slug: string;
  title: string;
  source: string | null;
  language: string;
  tier: number;
  tags: string;
  popularity: number;
  dialogic: boolean;
  segments: Parameters<typeof toSegmentView>[0][];
}): PassageView {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    source: p.source,
    language: p.language,
    tier: p.tier,
    tags: parseJsonArray<string>(p.tags, []),
    popularity: p.popularity,
    dialogic: p.dialogic,
    segments: p.segments.map(toSegmentView),
  };
}

/** All curated content sets with their passages, ordered for the catalog. */
export async function getContentSets(): Promise<ContentSetView[]> {
  const sets = await db.contentSet.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      passages: {
        where: { ownerUserId: null },
        orderBy: [{ tier: "asc" }, { popularity: "desc" }],
        include: { segments: { orderBy: { order: "asc" } } },
      },
    },
  });
  return sets.map((set) => ({
    id: set.id,
    slug: set.slug,
    title: set.title,
    description: set.description,
    passages: set.passages.map(toPassageView),
  }));
}

/** A single passage by slug, with ordered segments. */
export async function getPassage(slug: string): Promise<PassageView | null> {
  const p = await db.passage.findUnique({
    where: { slug },
    include: { segments: { orderBy: { order: "asc" } } },
  });
  return p ? toPassageView(p) : null;
}

/** Slugs for static generation. */
export async function getAllPassageSlugs(): Promise<string[]> {
  const rows = await db.passage.findMany({
    where: { ownerUserId: null },
    select: { slug: true },
  });
  return rows.map((r) => r.slug);
}
