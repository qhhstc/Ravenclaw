import DiscoveryListPage from "@/components/influencer-discovery/DiscoveryListPage";
import { getYoutubeStatus } from "@/lib/influencer-discovery/sources";

export default function InfluencerDiscoveryPage() {
  // YouTube 数据源统一判定:需 ENABLED=true 且 KEY 非空;未配置时前端展示「未配置数据源」而不报错
  const status = getYoutubeStatus();
  return <DiscoveryListPage youtubeConfigured={status.enabled && status.configured} />;
}
