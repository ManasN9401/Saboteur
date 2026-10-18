// The clock's hands (public/assets/clock/hand-*.webp, scripts/assets/batch10.py): photographed pointing
// up, each with its pivot (the centre of the hole in its boss) and its length from pivot to tip, in the
// image's own pixels. Both clocks turn these same pictures about their pivots.
export interface HandArt {
  src: string;
  w: number;
  h: number;
  px: number;
  py: number;
  len: number;
}

const art = (name: string, w: number, h: number, px: number, py: number, len: number): HandArt => ({ src: `/assets/clock/hand-${name}.webp`, w, h, px, py, len });

export const HAND = {
  hour: art("hour", 95, 374, 47.6, 327.1, 324.1),
  minute: art("minute", 96, 481, 48.4, 435.5, 432.5),
  second: art("second", 43, 482, 21.0, 391.0, 388.0),
  alarm: art("alarm", 86, 317, 42.9, 274.3, 271.3),
  nut: art("nut", 100, 99, 50.0, 49.5, 46.5),
};

/**
 * How long each hand is on a dial, as a fraction of the minute track's radius. The set was photographed
 * together, so one scale (the minute hand reaching the track) sizes the hour and alarm hands and the
 * nut; the seconds hand gets its own, to reach the track too.
 */
export function handScale(track: number) {
  const set = (0.93 * track) / HAND.minute.len;
  return { set, second: (0.95 * track) / HAND.second.len };
}

/** Clock time as angles that only ever increase (counted from local midnight), so hands never sweep back. */
export function handAngles(now: number) {
  const d = new Date(now);
  const midnight = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const secs = Math.floor((now - midnight) / 1000);
  return { second: secs * 6, minute: (secs / 60) * 6, hour: (secs / 3600) * 30 };
}
