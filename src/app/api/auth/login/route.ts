import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSessionToken, setSessionCookie } from "@/lib/auth";

export async function POST(request: Request) {
  const { email, password } = (await request.json()) as {
    email?: string;
    password?: string;
  };

  if (!email || !password) {
    return NextResponse.json({ message: "请输入邮箱和密码" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user || user.status !== "active") {
    return NextResponse.json({ message: "账号或密码错误" }, { status: 401 });
  }

  const passwordMatched = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatched) {
    return NextResponse.json({ message: "账号或密码错误" }, { status: 401 });
  }

  const token = createSessionToken({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });

  await setSessionCookie(token);

  return NextResponse.json({ ok: true });
}
