import { redirect } from "next/navigation";

type TonightPageProps = {
  params: Promise<{ collectionId: string }>;
};

export default async function TonightPage({ params }: TonightPageProps) {
  await params;
  redirect("/movie-night");
}
