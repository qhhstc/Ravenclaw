import CandidateDetailPage from "@/components/influencer-discovery/CandidateDetailPage";

type Props = { params: Promise<{ id: string }> };

export default async function InfluencerCandidateDetailPage({ params }: Props) {
  const { id } = await params;
  return <CandidateDetailPage candidateId={Number(id)} />;
}
