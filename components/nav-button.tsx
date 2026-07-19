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
  const styles = variant === "primary" ? "btn-primary" : "btn-secondary";

  return (
    <Link href={href} prefetch className={styles}>
      {children}
    </Link>
  );
}
