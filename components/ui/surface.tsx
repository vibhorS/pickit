import type { HTMLAttributes, ReactNode } from "react";

type SurfaceProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  as?: "div" | "section" | "article";
  elevated?: boolean;
};

/** Interactive or content surface — prefer for grouped actions, not marketing heroes. */
export function Surface({
  as: Tag = "div",
  elevated = false,
  className = "",
  children,
  ...props
}: SurfaceProps) {
  return (
    <Tag
      className={`rounded-2xl border border-white/10 bg-white/[0.03] p-5 ${
        elevated ? "shadow-[var(--shadow-card)]" : ""
      } ${className}`.trim()}
      {...props}
    >
      {children}
    </Tag>
  );
}
