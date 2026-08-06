import { redirect } from "next/navigation";

/** Legacy Decision Mode entry — always Live Movie Night. */
export default function DecidePage() {
  redirect("/movie-night");
}
