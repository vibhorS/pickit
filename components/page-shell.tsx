type PageShellProps = {
  children: React.ReactNode;
  className?: string;
  wide?: boolean;
  top?: boolean;
};

export function PageShell({
  children,
  className = "",
  wide = false,
  top = false,
}: PageShellProps) {
  return (
    <main
      className={`relative flex min-h-screen bg-netflix-black px-4 py-8 text-white sm:px-6 sm:py-12 ${
        top ? "items-start justify-start" : "items-center justify-center"
      } ${className}`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(229,9,20,0.12)_0%,_transparent_55%)]"
      />
      <div
        className={`relative w-full ${wide ? "max-w-6xl" : "max-w-2xl"}`}
      >
        {children}
      </div>
    </main>
  );
}
