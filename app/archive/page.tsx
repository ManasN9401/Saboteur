import type { Metadata } from "next";
import { CaseArchive } from "@/components/HomeClient";

export const metadata: Metadata = { title: "Case archive · Saboteur" };

export default function ArchivePage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-5 pb-24 pt-6 sm:px-8">
      <p className="eyebrow mb-3">Case archive</p>
      <h1 className="display mb-8 text-[clamp(40px,6vw,72px)] text-desk">Closed and open cases</h1>
      <CaseArchive />
    </main>
  );
}
