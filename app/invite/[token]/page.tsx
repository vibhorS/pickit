import { AcceptInvitationClient } from "@/components/collaboration/accept-invitation-client";
import { PageShell } from "@/components/page-shell";

type InvitePageProps = {
  params: Promise<{ token: string }>;
};

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params;

  return (
    <PageShell>
      <AcceptInvitationClient token={token} />
    </PageShell>
  );
}
