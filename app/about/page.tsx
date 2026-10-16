import type { Metadata } from "next";
import { StartButton } from "@/components/HomeClient";

export const metadata: Metadata = { title: "How it works · Saboteur" };

const STEPS = [
  { title: "Read the briefing", body: "Pick any topic and level. Saboteur writes a clear explanation, grounded in your notes if you paste them." },
  { title: "Hunt the lies", body: "Two to four sentences hide a believable mistake. Flag them, write the fix, and bet how sure you are." },
  { title: "Face the verdict", body: "See exactly what changed, why it was wrong, and why it fooled you. Confident mistakes get called out." },
];

export default function About() {
  return (
    <main className="mx-auto w-full max-w-6xl px-5 pb-24 pt-6 sm:px-8">
      <section className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="rise">
          <p className="eyebrow mb-4">An AI study tool that lies on purpose</p>
          <h1 className="display text-[clamp(52px,8vw,104px)] text-desk">
            Study by catching the <em>lies</em>.
          </h1>
          <p className="mt-6 max-w-[34ch] text-[20px] text-desk-soft">
            Every AI tool gives you the right answers. This one hides a few wrong ones in a convincing explanation and makes you find them.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <StartButton>Start a round</StartButton>
          </div>
        </div>

        <div className="rise relative" style={{ animationDelay: "120ms" }} aria-hidden="true">
          <div className="paper rotate-[-1.5deg] px-8 pb-10 pt-7 sm:px-10">
            <div className="paper-head label">
              <span>
                <b>Case file 0417</b> · Photosynthesis
              </span>
              <span>A-level · Subtle</span>
            </div>
            <p className="passage text-[18px]">
              Photosynthesis converts light energy into chemical energy stored in glucose. The light-dependent reactions take place in the{" "}
              <span className="relative inline-block">
                stroma
                <svg className="absolute -inset-x-3 -inset-y-2 h-[calc(100%+16px)] w-[calc(100%+24px)] overflow-visible" viewBox="0 0 100 40" preserveAspectRatio="none">
                  <path d="M8 22 C 6 8, 40 3, 70 5 S 99 18, 92 30 S 40 41, 14 33 S 2 14, 30 8" fill="none" stroke="var(--pen)" strokeWidth="2.2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                </svg>
              </span>
              . There, water is split by photolysis, releasing oxygen as a by-product.
            </p>
            <p className="hand mt-2 rotate-[-3deg] text-right text-[28px] leading-none text-pen">thylakoid membranes!</p>
            <div className="absolute -bottom-6 right-6 rotate-[-10deg]">
              <span className="stamp-mark text-[22px]" data-kind="catch">
                Caught
                <br />
                red-handed
                <small>Swapped terms</small>
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-24" aria-labelledby="how-h">
        <h2 id="how-h" className="display mb-6 text-[clamp(30px,4vw,48px)] text-desk">
          How a round works
        </h2>
        <ol className="m-0 grid list-none gap-5 p-0 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="paper rise px-6 pb-6 pt-5" style={{ animationDelay: `${200 + i * 90}ms` }}>
              <p className="label">Step {i + 1} of 3</p>
              <h3 className="mb-2 mt-1 text-[24px] font-bold leading-tight" style={{ fontFamily: "var(--font-display)", fontStretch: "85%" }}>
                {s.title}
              </h3>
              <p className="text-[16px] text-ink-soft">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

    </main>
  );
}
