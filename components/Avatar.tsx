/* eslint-disable @next/next/no-img-element -- small, pre-sized pin art */
import type { Avatar as AvatarData } from "@/lib/profile/schema";

/** A player's pin: one of the twelve illustrated agent badges, or their initials in their colour. */
export function Avatar({ avatar, name, size = 40, className = "" }: { avatar: AvatarData; name: string; size?: number; className?: string }) {
  if (avatar.kind === "pin") return <img src={`/assets/avatars/${avatar.id}.webp`} alt="" width={size} height={size} className={`avatar ${className}`} draggable={false} />;
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "?";
  return (
    <span className={`avatar avatar--mono ${className}`} style={{ width: size, height: size, background: avatar.colour, fontSize: size * 0.38 }} aria-hidden="true">
      {initials}
    </span>
  );
}
