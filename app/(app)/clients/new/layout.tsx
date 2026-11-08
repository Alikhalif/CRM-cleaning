import { requireBackOffice } from "@/lib/access-server";

// Garde de la création d'un client direct — back-office uniquement (D21).
//
// La RLS de `clients` réserve l'insertion à l'admin et à la planification
// depuis l'origine. L'écran, lui, s'ouvrait à tous : un commercial remplissait
// le formulaire entier avant d'essuyer un refus de la base. La règle ne change
// pas, elle est simplement appliquée AVANT la saisie. Un accès par URL directe
// rend un 404, comme les autres modules restreints.
//
// Le commercial n'en est pas privé de clients : `ensureClientFromLead()` crée
// le client à partir de SON lead, au moment du devis.
export default async function NewClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireBackOffice();
  return children;
}
