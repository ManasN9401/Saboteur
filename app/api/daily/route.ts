import { connection } from "next/server";
import { dailyInfo, isDailyDate } from "@/lib/daily";

/** What the daily case is for a date (the player's local date): topic, subject and difficulty. */
export async function GET(request: Request) {
  await connection();
  const date = new URL(request.url).searchParams.get("date") ?? "";
  if (!isDailyDate(date)) return Response.json({ error: "No daily case for that date." }, { status: 404 });
  return Response.json(dailyInfo(date), { headers: { "Cache-Control": "public, max-age=3600" } });
}
