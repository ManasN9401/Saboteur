import { z } from "zod";
import { MODELS } from "@/lib/config";
import { callJSON, isMock, LLMError } from "@/lib/llm";

const HealthSchema = z.object({ ok: z.literal(true), haiku: z.string().min(3) });

/** Phase 0 smoke test: one validated JSON round-trip through callJSON. GET /api/health */
export async function GET() {
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
