"use client";

import { Check, Copy, Link2, UserMinus, UserPlus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { PartnerPresence } from "@/components/presence/partner-presence";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { analytics } from "@/lib/observability/analytics";
import { useAuthStore } from "@/store/auth-store";

export function PartnerPanel() {
  const partner = useAuthStore((state) => state.partner);
  const refreshPartner = useAuthStore((state) => state.refreshPartner);
  const invitePartner = useAuthStore((state) => state.invitePartner);
  const cancelPartnerInvite = useAuthStore(
    (state) => state.cancelPartnerInvite,
  );
  const disconnectPartner = useAuthStore((state) => state.disconnectPartner);
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void refreshPartner();
  }, [refreshPartner]);

  useEffect(() => {
    if (partner.state === "invite-pending" && partner.relationship) {
      setToken(partner.relationship.inviteToken);
    }
    if (partner.state === "connected") {
      analytics.track("partner_connected");
    }
  }, [partner]);

  async function handleInvite() {
    setBusy(true);
    try {
      const next = await invitePartner();
      setToken(next);
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    if (!token) return;
    const url = `${window.location.origin}/invite/partner/${token}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section className="mt-10">
      <div className="flex items-center gap-2">
        <UserPlus className="size-4 text-netflix-red" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-white">Partner</h2>
      </div>
      <p className="mt-2 text-sm text-netflix-muted">
        One partner for shared lists, ratings, and Movie Night.
      </p>

      <Surface className="mt-4">
        {partner.state === "no-partner" && (
          <>
            <p className="text-sm text-white">No partner yet</p>
            <Button
              className="mt-4"
              disabled={busy}
              onClick={() => void handleInvite()}
            >
              <Link2 className="mr-2 size-4" aria-hidden="true" />
              Invite partner
            </Button>
          </>
        )}

        {partner.state === "invite-pending" && (
          <>
            <p className="text-sm text-white">Invite pending</p>
            <p className="mt-1 text-xs text-netflix-muted">
              Share this link with your partner. They can accept from their
              device.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => void copyLink()}>
                {copied ? (
                  <Check className="mr-2 size-4 text-emerald-400" aria-hidden="true" />
                ) : (
                  <Copy className="mr-2 size-4" aria-hidden="true" />
                )}
                {copied ? "Copied" : "Copy invite link"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => void cancelPartnerInvite()}
              >
                <X className="mr-2 size-4" aria-hidden="true" />
                Cancel invite
              </Button>
            </div>
          </>
        )}

        {partner.state === "invitation-received" && (
          <p className="text-sm text-white">
            Open your invite link to accept or decline.
          </p>
        )}

        {partner.state === "connected" && partner.partner && (
          <>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-white">
                  {partner.partner.displayName}
                </p>
                <div className="mt-1">
                  <PartnerPresence />
                </div>
              </div>
              <span
                className="size-11 rounded-full"
                style={{ backgroundColor: partner.partner.color }}
                aria-hidden="true"
              />
            </div>
            <Button
              variant="ghost"
              className="mt-4"
              onClick={() => void disconnectPartner()}
            >
              <UserMinus className="mr-2 size-4" aria-hidden="true" />
              Disconnect partner
            </Button>
          </>
        )}
      </Surface>
    </section>
  );
}
