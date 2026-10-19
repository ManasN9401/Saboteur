// The clock's camera move (public/assets/fx/clock-pan*), held in memory so it always plays straight
// through. Streamed from the network, a click before it had buffered would stall the video on its first
// frame and the move would jump to its end; from memory it starts at once. Loaded when the night desk is
// idle (components/DeskClock.tsx); until it's in, opening the clock uses the zoom instead.

interface Footage {
  forward: string;
  back: string;
}

let footage: Footage | null = null;
let loading = false;

/** The footage's object URLs, or null while it hasn't loaded. */
export const panFootage = () => footage;

export function loadPan() {
  if (footage || loading || typeof document === "undefined") return;
  loading = true;
  const ext = document.createElement("video").canPlayType('video/webm; codecs="vp9"') ? "webm" : "mp4";
  const get = (name: string) =>
    fetch(`/assets/fx/${name}.${ext}`, { priority: "low" } as RequestInit).then((r) => {
      if (!r.ok) throw new Error(`${name}: ${r.status}`);
      return r.blob();
    });
  Promise.all([get("clock-pan"), get("clock-pan-back")])
    .then(([f, b]) => {
      footage = { forward: URL.createObjectURL(f), back: URL.createObjectURL(b) };
    })
    .catch(() => {
      loading = false; // try again on the next idle or hover
    });
}
