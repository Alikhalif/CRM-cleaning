import { notFound } from "next/navigation";
import { getGridBySlug } from "@/lib/pricing/grid-server";
import GridEditor from "./GridEditor";

export const metadata = { title: "Grille tarifaire" };

export default async function GridPage({ params }: { params: Promise<{ slug: string }> }) {
  // Next 16 : params est asynchrone.
  const { slug } = await params;
  // `true` : lecture pour ÉDITION, non soumise à la règle de diffusion.
  const grid = await getGridBySlug(slug, true);
  if (!grid) notFound();
  return <GridEditor initial={grid} />;
}
