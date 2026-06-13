import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/auth";
import { toWords } from "@/lib/recite";

type Overrides = Record<string, number[]>;

function parseOverrides(raw: string): Overrides {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Overrides) : {};
  } catch {
    return {};
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ overrides: {} });

  const passage = await db.passage.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!passage) return NextResponse.json({ overrides: {} });

  const set = await db.anchorSet.findUnique({
    where: { userId_passageId: { userId, passageId: passage.id } },
    select: { overrides: true },
  });
  return NextResponse.json({ overrides: set ? parseOverrides(set.overrides) : {} });
}

const bodySchema = z.object({
  overrides: z.record(
    z.string(),
    z.array(z.number().int().nonnegative()).max(200),
  ),
});

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Sign in to save" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const passage = await db.passage.findUnique({
    where: { slug },
    select: { id: true, segments: { select: { id: true, text: true } } },
  });
  if (!passage) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Keep only segments that belong to this passage, with indices in range and
  // non-empty — defends the DB against stale or hand-crafted payloads.
  const wordCount = new Map(
    passage.segments.map((s) => [s.id, toWords(s.text).length]),
  );
  const clean: Overrides = {};
  for (const [segId, indices] of Object.entries(parsed.data.overrides)) {
    const max = wordCount.get(segId);
    if (max === undefined) continue;
    const valid = [...new Set(indices)].filter((i) => i < max).sort((a, b) => a - b);
    if (valid.length > 0) clean[segId] = valid;
  }

  await db.anchorSet.upsert({
    where: { userId_passageId: { userId, passageId: passage.id } },
    create: { userId, passageId: passage.id, overrides: JSON.stringify(clean) },
    update: { overrides: JSON.stringify(clean) },
  });
  return NextResponse.json({ ok: true });
}
