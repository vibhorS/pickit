import Link from "next/link";

type NavButtonProps = {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
};

export function NavButton({
  href,
  children,
  variant = "primary",
}: NavButtonProps) {
  const styles =
    variant === "primary"
      ? "bg-netflix-red text-white hover:bg-netflix-red-hover"
      : "bg-netflix-elevated/80 text-white hover:bg-netflix-elevated";

  return (
    <Link
      href={href}
      className={`inline-block rounded px-6 py-3 text-sm font-bold uppercase tracking-wide transition-colors ${styles}`}
    >
      {children}
    </Link>
  );
}
