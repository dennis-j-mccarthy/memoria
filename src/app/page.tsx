import { getAllPrayers } from "@/lib/immersive";
import { Immersive } from "@/components/immersive/Immersive";

export default async function Home() {
  const prayers = await getAllPrayers();
  return <Immersive prayers={prayers} />;
}
