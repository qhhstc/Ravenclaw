import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { ApiAuthError, ROLES, type Role } from "@/lib/permissions";

export const USER_STATUS_OPTIONS = ["active", "inactive"] as const;
export type UserStatus = (typeof USER_STATUS_OPTIONS)[number];

export const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

function textValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function normalizeEmail(value: unknown) {
  return textValue(value)?.toLowerCase() ?? null;
}

export function isValidRole(value: unknown): value is Role {
  return typeof value === "string" && ROLES.includes(value as Role);
}

export function isValidStatus(value: unknown): value is UserStatus {
  return typeof value === "string" && USER_STATUS_OPTIONS.includes(value as UserStatus);
}

export function normalizeUserInput(input: Record<string, unknown>, options: { requirePassword: boolean }) {
  const name = textValue(input.name);
  const email = normalizeEmail(input.email);
  const role = textValue(input.role) ?? "sales";
  const status = textValue(input.status) ?? "active";
  const password = typeof input.password === "string" ? input.password.trim() : "";

  if (!name) throw new Error("请输入姓名");
  if (!email) throw new Error("请输入邮箱");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("邮箱格式不正确");
  if (!isValidRole(role)) throw new Error("请选择有效角色");
  if (!isValidStatus(status)) throw new Error("请选择有效状态");
  if (options.requirePassword && password.length < 6) throw new Error("初始密码至少 6 位");
  if (!options.requirePassword && password && password.length < 6) throw new Error("新密码至少 6 位");

  return { name, email, role, status, password };
}

export function buildUserWhere(params: URLSearchParams): Prisma.UserWhereInput {
  const keyword = params.get("keyword")?.trim();
  const role = params.get("role")?.trim();
  const status = params.get("status")?.trim();
  return {
    ...(keyword ? { OR: [{ name: { contains: keyword } }, { email: { contains: keyword } }] } : {}),
    ...(role && isValidRole(role) ? { role } : {}),
    ...(status && isValidStatus(status) ? { status } : {}),
  };
}

export function parsePositiveInt(value: string | null, fallback: number) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : fallback;
}

export function systemUserApiError(error: unknown, fallback = "账号操作失败") {
  if (error instanceof ApiAuthError) {
    return NextResponse.json({ message: error.message }, { status: error.status });
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return NextResponse.json({ message: "邮箱已存在，请更换邮箱" }, { status: 409 });
    if (error.code === "P2025") return NextResponse.json({ message: "账号不存在或已删除" }, { status: 404 });
  }
  return NextResponse.json({ message: error instanceof Error ? error.message : fallback }, { status: 400 });
}
