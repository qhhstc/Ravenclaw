import InquiryDetailPage from "@/components/inquiries/InquiryDetailPage";

export default async function InquiryDetailRoutePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <InquiryDetailPage id={id} />;
}
