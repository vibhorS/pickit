import { redirect } from "next/navigation";

type LegacyDecidePageProps = {
  params: Promise<{ collectionId: string }>;
};

export default async function LegacyDecidePage({
  params,
}: LegacyDecidePageProps) {
  const { collectionId } = await params;
  redirect(`/decision/${collectionId}`);
}
