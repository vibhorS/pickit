import type { HTMLAttributes, ReactNode } from "react";

type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger";

const TONE_CLASS: Record<BadgeTone, string> = {
  neutral: "bg-white/[0.05] text-netflix-muted",
  accent: "bg-netflix-red/15 text-netflix-red",
  success: "bg-emerald-400/10 text-emerald-300",
  warning: "bg-amber-400/10 text-amber-200",
  danger: "bg-red-500/15 text-red-300",
};

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
  children: ReactNode;
};

export function Badge({
  tone = "neutral",
  className = "",
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-medium tracking-wide ${TONE_CLASS[tone]} ${className}`.trim()}
      {...props}
    >
      {children}
    </span>
  );
}
