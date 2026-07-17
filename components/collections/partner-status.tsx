import { PARTNER_USER } from "@/lib/users";

type PartnerStatusProps = {
  status: "connected" | "waiting";
};

export function PartnerStatus({ status }: PartnerStatusProps) {
  const isConnected = status === "connected";

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-netflix-muted/80">
        Partner Status
      </p>
      <p
        className={`inline-flex items-center gap-1.5 text-sm font-medium ${
          isConnected ? "text-emerald-300/90" : "text-amber-200/85"
        }`}
      >
        <span aria-hidden="true">{isConnected ? "🟢" : "🟡"}</span>
        {isConnected ? "Connected" : "Waiting for ratings"}
        <span className="font-normal text-netflix-muted/70">
          · {PARTNER_USER.name}
        </span>
      </p>
    </div>
  );
}
