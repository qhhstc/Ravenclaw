import PublicChannelEntryPage from "@/components/channel-entry/PublicChannelEntryPage";
import { currentEntryPeriod, validateEntryPeriod } from "@/lib/public-channel-entry";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "渠道经营台 · Ravenclaw", robots: { index: false, follow: false } };

export default async function ChannelEntryRoutePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  let initialPeriod = currentEntryPeriod();
  try { initialPeriod = validateEntryPeriod(query.year ?? initialPeriod.year, query.month ?? initialPeriod.month); } catch { /* Invalid page links open the current month. APIs still reject invalid inputs. */ }
  return <PublicChannelEntryPage initialPeriod={initialPeriod} />;
}
