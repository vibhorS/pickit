import { redirect } from "next/navigation";

/** Legacy Decision Mode entry — Movie Night is now the primary journey. */
export default function DecidePage() {
  redirect("/movie-night");
}
