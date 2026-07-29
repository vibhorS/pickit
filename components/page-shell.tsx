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
      className={`relative flex min-h-screen overflow-x-hidden bg-netflix-black px-3 py-5 pb-24 text-white sm:px-5 sm:py-8 sm:pb-26 ${
        top ? "items-start justify-start" : "items-center justify-center"
      } ${className}`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(229,9,20,0.12)_0%,_transparent_55%)]"
      />
      <div
        className={`relative w-full min-w-0 ${wide ? "max-w-3xl" : "max-w-xl"}`}
      >
        {children}
      </div>
    </main>
  );
}
