import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/crm";

type Context = { params: Promise<{ contactId: string }> };

export async function POST(_request: NextRequest, context: Context) {
  try {
    const { contactId } = await context.params;
    const contact = await prisma.customerContact.findUniqueOrThrow({ where: { id: Number(contactId) } });
    const item = await prisma.$transaction(async (tx) => {
      await tx.customerContact.updateMany({ where: { customerId: contact.customerId }, data: { isPrimary: false } });
      return tx.customerContact.update({ where: { id: Number(contactId) }, data: { isPrimary: true } });
    });
    return NextResponse.json({ item });
  } catch (error) {
    return apiError(error, "设置主联系人失败");
  }
}
