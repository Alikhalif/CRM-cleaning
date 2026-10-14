import { notFound } from "next/navigation";
import { getGridBySlug } from "@/lib/pricing/grid-server";
import GridEditor from "./GridEditor";

export const metadata = { title: "Grille tarifaire" };

export default async function GridPage({ params }: { params: Promise<{ slug: string }> }) {
  // Next 16 : params est asynchrone.
  const { slug } = await params;
  const grid = await getGridBySlug(slug);
  if (!grid) notFound();
  return <GridEditor initial={grid} />;
}
