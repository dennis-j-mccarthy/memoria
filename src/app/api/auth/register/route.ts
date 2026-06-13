import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSession, credentialsSchema, hashPassword } from "@/lib/auth";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = credentialsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }
  const { email, password, name } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  const existing = await db.user.findUnique({
    where: { email: normalizedEmail },
  });
  if (existing) {
    return NextResponse.json(
      { error: "An account with that email already exists" },
      { status: 409 },
    );
  }

  const user = await db.user.create({
    data: {
      email: normalizedEmail,
      name: name || null,
      passwordHash: hashPassword(password),
    },
  });

  await createSession(user.id);
  return NextResponse.json({ id: user.id, email: user.email, name: user.name });
}
