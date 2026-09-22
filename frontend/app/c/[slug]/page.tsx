import { PublicConstellationView } from "@/components/constellations/PublicConstellationView";
import type { PublicConstellation } from "@/lib/constellations";
import { publicConstellation } from "@/lib/server/constellations";

export const dynamic = "force-dynamic";

async function loadConstellation(slug: string): Promise<{ group: PublicConstellation | null; error: string }> {
  try {
    const group = await publicConstellation(slug);
    return { group: group as unknown as PublicConstellation, error: "" };
  } catch {
    return { group: null, error: "This Constellation is unavailable." };
  }
}

export default async function PublicConstellationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await loadConstellation(slug);
  return <PublicConstellationView group={result.group} error={result.error} />;
}