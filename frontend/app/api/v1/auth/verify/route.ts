import { NextRequest } from "next/server";
import { completeOAuthChallenge } from "@/lib/server/oauth-routes";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  return completeOAuthChallenge(request);
}
