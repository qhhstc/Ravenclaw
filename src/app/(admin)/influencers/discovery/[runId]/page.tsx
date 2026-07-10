import DiscoveryDetailPage from "@/components/influencer-discovery/DiscoveryDetailPage";
import { getYoutubeStatus } from "@/lib/influencer-discovery/sources";

type Props = { params: Promise<{ runId: string }> };

export default async function InfluencerDiscoveryDetailPage({ params }: Props) {
  const { runId } = await params;
  const status = getYoutubeStatus();
  return <DiscoveryDetailPage runId={Number(runId)} youtubeEnabled={status.enabled && status.configured} />;
}
