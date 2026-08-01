"use client";

import {
  crewMemberInitials,
  resolveCrewMemberAvatarUrl,
  resolveCrewMemberLabel,
} from "@/lib/crew/member-identity";
import type { UserProfile } from "@/lib/types";

type CrewMemberAvatarProps = {
  profile: UserProfile | null | undefined;
  sizeClassName?: string;
  className?: string;
};

export function CrewMemberAvatar({
  profile,
  sizeClassName = "size-7",
  className = "",
}: CrewMemberAvatarProps) {
  const label = resolveCrewMemberLabel(profile);
  const avatarUrl = resolveCrewMemberAvatarUrl(profile);
  const initials = crewMemberInitials(label);
  const color = profile?.color ?? "#e50914";

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- user-uploaded avatars
      <img
        src={avatarUrl}
        alt=""
        className={`${sizeClassName} rounded-full object-cover ${className}`}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`inline-flex ${sizeClassName} items-center justify-center rounded-full text-[0.65rem] font-semibold text-white ${className}`}
      style={{ backgroundColor: color }}
    >
      {initials}
    </span>
  );
}
