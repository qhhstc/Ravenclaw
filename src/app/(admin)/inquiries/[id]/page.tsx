import ModulePlaceholder from "@/components/common/ModulePlaceholder";

export default async function InquiryDetailRoutePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ModulePlaceholder title={`询盘详情 #${id}`} description="完整询盘详情后续接入；报价转订单入口已在 /inquiries 报价列表中启用。" />;
}
