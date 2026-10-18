import { connection } from "next/server";
import { engineMode } from "@/lib/engine";
import { LIBRARY } from "@/lib/offline/library";
import { router } from "@/lib/router/router";
import { guard } from "@/lib/security/guard";

/** Tells the setup screen whether rounds will be written by the AI or built offline by rules. */
export async function GET(request: Request) {
  await connection(); // read the environment at request time, not at build time
  const pass = guard(request, "info");
  if (pass instanceof Response) return pass;
  // In development, also which keys and routes are resting and why (never the keys themselves).
  const routing = process.env.NODE_ENV === "production" ? undefined : router().status();
  return Response.json({ ...engineMode(), topics: LIBRARY.map((e) => e.title), routing });
}
