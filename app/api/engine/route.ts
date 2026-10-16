import { connection } from "next/server";
import { engineMode } from "@/lib/engine";
import { LIBRARY } from "@/lib/offline/library";

/** Tells the setup screen whether rounds will be written by the AI or built offline by rules. */
export async function GET() {
  await connection(); // read the environment at request time, not at build time
  return Response.json({ ...engineMode(), topics: LIBRARY.map((e) => e.title) });
}
