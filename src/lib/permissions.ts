import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const ROLES = ["admin", "sales", "finance", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export type SessionUser = {
  userId: number;
  email: string;
  name: string;
  role: string;
};

export class ApiAuthError extends Error {
  status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.name = "ApiAuthError";
    this.status = status;
  }
}

export function isRole(role: string | undefined | null): role is Role {
  return Boolean(role && ROLES.includes(role as Role));
}

export function canViewAllOrders(role?: string | null) {
  return ["admin", "finance", "viewer"].includes(role ?? "");
}

export function canCreateOrder(role?: string | null) {
  return ["admin", "sales"].includes(role ?? "");
}

export function canEditOrder(role?: string | null, order?: { createdBy?: number | null; salespersonId?: number | null; orderStatus?: string | null }, userId?: number) {
  if (role === "admin") return true;
  if (role === "sales") {
    const ownOrder = order && userId && (order.createdBy === userId || order.salespersonId === userId);
    return Boolean(ownOrder && !["completed", "cancelled", "refunded"].includes(order.orderStatus ?? ""));
  }
  return false;
}

export function canEditOrderCosts(role?: string | null) {
  return ["admin", "finance"].includes(role ?? "");
}

export function canDeleteOrder(role?: string | null) {
  return role === "admin";
}

export function canViewProfitReports(role?: string | null) {
  return ["admin", "finance"].includes(role ?? "");
}

export function canExport(role?: string | null) {
  return ["admin", "finance"].includes(role ?? "");
}

export function canManageProducts(role?: string | null) {
  return ["admin", "finance"].includes(role ?? "");
}

export function canManageAccounts(role?: string | null) {
  return role === "admin";
}

export async function requireApiSession() {
  const session = await getSession();
  if (!session) throw new ApiAuthError("请先登录", 401);
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, name: true, role: true, status: true },
  });
  if (!user || user.status !== "active") throw new ApiAuthError("登录状态已失效，请重新登录", 401);
  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}

export function forbidden(message = "没有权限执行该操作") {
  return NextResponse.json({ message }, { status: 403 });
}
