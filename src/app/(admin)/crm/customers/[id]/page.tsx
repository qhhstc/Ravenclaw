import CustomerDetailPage from "@/components/crm/CustomerDetailPage";

export default async function CustomerDetailRoutePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CustomerDetailPage customerId={Number(id)} />;
}
