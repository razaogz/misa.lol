import { NextRequest, NextResponse } from "next/server";
import { nativeCoreEnabled } from "@/lib/server/rollout";
import { clientIp } from "@/lib/server/client-ip";
import { withinLimit } from "@/lib/server/rate-limit";
import { one } from "@/lib/server/postgres";
import { validateUsername } from "@/lib/server/usernames";
import { apiError } from "@/lib/server/http";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  if (!nativeCoreEnabled()) return apiError("Not found.",404);
  try {
    if (!await withinLimit(`rl:available:${clientIp(request)}`,60,60)) return apiError("Too many checks. Try again shortly.",429);
    let username;
    try { username = validateUsername(request.nextUrl.searchParams.get("username") || ""); }
    catch { return NextResponse.json({available:false,reason:"reserved"},{headers:{"Cache-Control":"no-store"}}); }
    const row = await one<{ taken:boolean; reserved:boolean }>(`SELECT
      EXISTS(SELECT 1 FROM users WHERE lower(username)=$1) AS taken,
      (EXISTS(SELECT 1 FROM reserved_usernames WHERE username=$1)
      OR EXISTS(SELECT 1 FROM username_history WHERE lower(old_username)=$1)
      OR EXISTS(SELECT 1 FROM banned_username_words WHERE lower(word)=$1 OR (length(word)>=4 AND strpos($1,lower(word))>0))) AS reserved`,[username]);
    return NextResponse.json({username,available:!row?.taken&&!row?.reserved,reason:row?.taken?"taken":row?.reserved?"reserved":null},{headers:{"Cache-Control":"no-store"}});
  } catch { return apiError("Username availability is temporarily unavailable.",503); }
}
