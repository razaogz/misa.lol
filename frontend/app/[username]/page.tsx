import { PublicProfileView } from "@/components/profile/PublicProfileView";

export default async function PublicProfile({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  return <main className="min-h-[100svh]"><PublicProfileView username={username} /></main>;
}
