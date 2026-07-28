import { HomeClient } from "@/components/home/home-client";
import { PageShell } from "@/components/page-shell";

export default function Home() {
  return (
    <PageShell top wide>
      <HomeClient />
    </PageShell>
  );
}
