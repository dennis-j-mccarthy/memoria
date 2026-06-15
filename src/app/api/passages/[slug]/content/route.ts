import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/auth";
import { toWords } from "@/lib/recite";

/**
 * Edit a prayer's canonical content — anchor words and Leader/Response roles.
 * Signed-in only (so visitors can't alter prayers). Changes are the default
 * for everyone; the page is revalidated so they show on next load.
 */
const ROLES = ["CALLER", "RESPONDER", "UNISON", "SOLO"] as const;

const bodySchema = z.object({
  anchors: z
    .record(z.string(), z.array(z.number().int().nonnegative()).max(200))
    .optional(),
  roles: z.record(z.string(), z.enum(ROLES)).optional(),
});

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Sign in to edit" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { anchors, roles } = parsed.data;

  const passage = await db.passage.findUnique({
    where: { slug },
    select: { id: true, segments: { select: { id: true, text: true, role: true } } },
  });
  if (!passage) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Apply anchor + role updates per segment, validating against the passage.
  const updates: Promise<unknown>[] = [];
  for (const seg of passage.segments) {
    const data: { connectiveIndices?: string; role?: string } = {};
    if (anchors && seg.id in anchors) {
      const max = toWords(seg.text).length;
      const valid = [...new Set(anchors[seg.id])]
        .filter((i) => i < max)
        .sort((a, b) => a - b);
      data.connectiveIndices = JSON.stringify(valid);
    }
    if (roles && seg.id in roles) {
      data.role = roles[seg.id];
    }
    if (Object.keys(data).length > 0) {
      updates.push(db.segment.update({ where: { id: seg.id }, data }));
    }
  }
  await Promise.all(updates);

  // A passage is call-and-response if any segment is a Leader/Response line.
  if (roles) {
    const finalRoles = passage.segments.map((s) => roles[s.id] ?? s.role);
    const dialogic = finalRoles.some(
      (r) => r === "CALLER" || r === "RESPONDER",
    );
    await db.passage.update({ where: { id: passage.id }, data: { dialogic } });
  }

  revalidatePath(`/prayers/${slug}`);
  revalidatePath("/");
  return NextResponse.json({ ok: true });
}
