import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { ApiAuthError } from "@/lib/permissions";

export const VENDOR_TYPES = ["supplier", "logistics", "service", "other"] as const;

export const vendorInclude = {} satisfies Prisma.VendorInclude;

function textValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function enumValue<T extends readonly string[]>(value: unknown, options: T, fallback: T[number]) {
  const normalized = textValue(value);
  return normalized && options.includes(normalized) ? normalized : fallback;
}

export function vendorApiError(error: unknown, fallback = "供应商操作失败") {
  if (error instanceof ApiAuthError) {
    return NextResponse.json({ message: error.message }, { status: error.status });
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return NextResponse.json({ message: "供应商名称已存在" }, { status: 409 });
    if (error.code === "P2003") return NextResponse.json({ message: "该供应商已被产品使用，无法删除" }, { status: 409 });
    if (error.code === "P2025") return NextResponse.json({ message: "供应商不存在或已删除" }, { status: 404 });
  }
  return NextResponse.json({ message: error instanceof Error ? error.message : fallback }, { status: 400 });
}

export function normalizeVendorInput(input: Record<string, unknown>) {
  const name = textValue(input.name);
  if (!name) throw new Error("供应商名称不能为空");
  return {
    name,
    vendorType: enumValue(input.vendorType, VENDOR_TYPES, "supplier"),
    countryCode: textValue(input.countryCode)?.toUpperCase(),
    contact: textValue(input.contact),
    email: textValue(input.email),
    phone: textValue(input.phone),
    whatsapp: textValue(input.whatsapp),
    website: textValue(input.website),
    status: textValue(input.status) ?? "active",
    remark: textValue(input.remark),
  };
}

export function buildVendorWhere(params: URLSearchParams): Prisma.VendorWhereInput {
  const keyword = params.get("keyword")?.trim();
  return {
    ...(keyword
      ? {
          OR: [
            { name: { contains: keyword } },
            { contact: { contains: keyword } },
            { email: { contains: keyword } },
            { phone: { contains: keyword } },
            { whatsapp: { contains: keyword } },
            { website: { contains: keyword } },
          ],
        }
      : {}),
    ...(params.get("vendorType") ? { vendorType: params.get("vendorType")! } : {}),
    ...(params.get("countryCode") ? { countryCode: params.get("countryCode")! } : {}),
    ...(params.get("status") ? { status: params.get("status")! } : {}),
  };
}
