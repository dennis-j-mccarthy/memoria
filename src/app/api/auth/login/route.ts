import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, verifyPassword } from "@/lib/auth";

const loginSchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(1).max(200),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { email, password } = parsed.data;

  const user = await db.user.findUnique({
    where: { email: email.toLowerCase() },
  });
  // Same response for unknown email vs. wrong password, to avoid leaking which.
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.json(
      { error: "Incorrect email or password" },
      { status: 401 },
    );
  }

  await createSession(user.id);
  return NextResponse.json({ id: user.id, email: user.email, name: user.name });
}
