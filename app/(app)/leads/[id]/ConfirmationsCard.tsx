import Link from "next/link";
import type { TimelineEvent, TimelineEventKind } from "@/lib/leads";
import styles from "./LeadDetail.module.scss";

// Confirmations des actions réellement effectuées, dans la fiche.
//
// L'historique complet vit dans son onglet ; le commercial, lui, a besoin de
// voir d'un coup d'œil ce qui est PARTI : la demande de photos est-elle
// envoyée ? le devis est-il expédié ? la relance faite ? Sans ce repère il
// renvoie deux fois, ou n'ose pas.
//
// Ces lignes ne décrivent que des événements RÉELLEMENT enregistrés dans le
// journal d'audit. Aucune n'est produite par optimisme : si le journal ne
// contient rien, la carte le dit.

// Événements qui confirment une action commerciale. Les autres — changements
// de statut, notes — appartiennent à l'historique, pas à cette carte.
const CONFIRMES: TimelineEventKind[] = [
  "email", "email-reply", "sms", "call", "doc-issued", "doc-signed", "payment",
];

// Tonalité par nature d'événement. Vert = fait et confirmé ; bleu = réponse du
// client, qui n'est pas une action de notre côté.
const TON: Partial<Record<TimelineEventKind, "vert" | "bleu">> = {
  email: "vert",
  sms: "vert",
  call: "vert",
  "doc-issued": "vert",
  "doc-signed": "vert",
  payment: "vert",
  "email-reply": "bleu",
};

// Fuseau FIXÉ : le serveur rend en UTC, le commercial est à Paris.
const QUAND = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  timeZone: "Europe/Paris",
});

export default function ConfirmationsCard({
  timeline,
  leadId,
  max = 6,
}: {
  timeline: TimelineEvent[];
  leadId: string;
  max?: number;
}) {
  const confirmes = timeline.filter((e) => CONFIRMES.includes(e.kind)).slice(0, max);

  return (
    <section className={styles.card}>
      <header className={styles.cardHead}>
        <h2 className={styles.h2}>Actions confirmées</h2>
        <Link href={`/leads/${leadId}?tab=historique`} className={styles.confirmLien}>
          Historique complet →
        </Link>
      </header>

      {confirmes.length === 0 ? (
        <p className={styles.empty}>
          Aucune action enregistrée pour l&apos;instant. Les envois, appels et documents
          apparaîtront ici dès qu&apos;ils seront réellement partis.
        </p>
      ) : (
        <ul className={styles.confirmListe}>
          {confirmes.map((e) => (
            <li key={e.id} className={styles.confirmLigne} data-ton={TON[e.kind] ?? "bleu"}>
              <span className={styles.confirmPuce} aria-hidden="true">✓</span>
              <span className={styles.confirmLabel}>
                {e.label}
                {e.sublabel && <span className={styles.confirmSub}> · {e.sublabel}</span>}
              </span>
              <time className={styles.confirmQuand} dateTime={e.at}>
                {QUAND.format(new Date(e.at))}
              </time>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
