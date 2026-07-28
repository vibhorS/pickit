import { redirect } from "next/navigation";

type LegacyDecidePageProps = {
  params: Promise<{ collectionId: string }>;
};

export default async function LegacyDecidePage({
  params,
}: LegacyDecidePageProps) {
  await params;
  redirect("/movie-night");
}
