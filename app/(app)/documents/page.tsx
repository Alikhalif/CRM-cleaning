import { getCurrentUserProfile } from "@/lib/users-server";
import { getDocumentsDashboard } from "@/lib/documents/dashboard-server";
import DocumentsDashboard from "./DocumentsDashboard";

export const metadata = { title: "Documents & Contrats" };
export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const profile = await getCurrentUserProfile();
  if (!profile) return null; // le proxy garde déjà l'accès
  const data = await getDocumentsDashboard();
  return <DocumentsDashboard data={data} />;
}
