export type LeaderboardRange = "7D" | "30D" | "ALL";
export type LeaderboardMetric = "views" | "clicks";
export type LeaderboardSort = "latest" | "popular";

export interface LeaderboardEntry {
  rank: number | null;
  username: string;
  displayName: string;
  views: number;
  clicks: number;
  avatar: string;
}

export interface LeaderboardPayload {
  range: LeaderboardRange;
  metric: LeaderboardMetric;
  sort: LeaderboardSort;
  entries: LeaderboardEntry[];
  you: LeaderboardEntry | null;
}

export async function loadLeaderboard(sort: LeaderboardSort, range: LeaderboardRange, metric: LeaderboardMetric): Promise<LeaderboardPayload> {
  const response = await fetch("/api/v1/community/leaderboard?sort=" + sort + "&range=" + range + "&metric=" + metric, { credentials: "include", cache: "no-store" });
  if (!response.ok) throw new Error("Could not load the leaderboard.");
  return response.json() as Promise<LeaderboardPayload>;
}
