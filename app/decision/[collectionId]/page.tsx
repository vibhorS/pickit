import { redirect } from "next/navigation";

type DecisionPageProps = {
  params: Promise<{ collectionId: string }>;
};

export default async function DecisionPage({ params }: DecisionPageProps) {
  await params;
  redirect("/movie-night");
}
