import { gradeSubmission } from "@/lib/grade";
import { FriendlyError } from "@/lib/errors";
import { buildDaily, dailyDateOf, isDailyDate } from "@/lib/daily";
import { getRound, saveRound } from "@/lib/roundStore.server";
import { SubmissionSchema } from "@/lib/schemas";
import { guard, MAX_BODY, readJson } from "@/lib/security/guard";

export const maxDuration = 120;

export async function POST(request: Request) {
  const pass = guard(request, "grade");
  if (pass instanceof Response) return pass;
  const body = await readJson(request, MAX_BODY.medium);
  if ("response" in body) return body.response;
  const parsed = SubmissionSchema.safeParse(body.data);
  if (!parsed.success) return Response.json({ error: "Your flags couldn't be read. Refresh the page and try again." }, { status: 400 });

  let stored = getRound(parsed.data.roundId);
  // The daily case is rebuilt from its date, so it never expires.
  const daily = dailyDateOf(parsed.data.roundId);
  if (!stored && daily && isDailyDate(daily)) {
    const built = await buildDaily(daily);
    saveRound(built.round, built.errors);
    stored = getRound(built.round.id);
  }
  if (!stored) {
    return Response.json(
      { error: "This round has expired on the server (it may have restarted). Start a new round.", expired: true },
      { status: 410 },
    );
  }

  try {
    return Response.json(await gradeSubmission(parsed.data, stored.round, stored.errors));
  } catch (err) {
    console.error("[grade]", err);
    return Response.json({ error: err instanceof FriendlyError ? err.message : "Grading failed. Try submitting again." }, { status: 502 });
  }
}
