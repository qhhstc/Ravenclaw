import OrderDetailPage from "@/components/orders/OrderDetailPage";

export default async function OrderDetailRoutePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OrderDetailPage orderId={Number(id)} />;
}
