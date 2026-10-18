/** Liveness for the host's health checks: no model calls, no work. GET /api/live */
export function GET() {
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
