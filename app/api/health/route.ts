import { z } from "zod";
import { MODELS } from "@/lib/config";
import { callJSON, isMock, LLMError } from "@/lib/llm";
import { guard } from "@/lib/security/guard";

const HealthSchema = z.object({ ok: z.literal(true), haiku: z.string().min(3) });

/**
 * Smoke test: one validated JSON round-trip through callJSON. GET /api/health
 * It spends a real model call, so in production it needs HEALTH_TOKEN (sent as x-health-token) and
 * is otherwise not there. For uptime checks use /api/live, which costs nothing.
 */
export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") {
    const token = process.env.HEALTH_TOKEN;
    if (!token || request.headers.get("x-health-token") !== token) return new Response("Not found", { status: 404 });
  }
  const pass = guard(request, "health");
  if (pass instanceof Response) return pass;
  try {
    if (isMock()) return Response.json({ mode: "mock", ok: true });
    const out = await callJSON(
      {
        name: "health",
        params: {},
        model: MODELS.grade,
        effort: "low",
        maxTokens: 2000,
        system: 'Reply with JSON only: { "ok": true, "haiku": "<a three-line haiku about catching a lie>" }',
        user: "Health check.",
      },
      HealthSchema,
    );
    return Response.json({ mode: "live", model: MODELS.grade, ...out });
  } catch (err) {
    return Response.json({ ok: false, error: err instanceof LLMError ? err.message : "Health check failed." }, { status: 500 });
  }
}
