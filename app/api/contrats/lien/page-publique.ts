import "server-only";

// Page HTML minimale des liens de contrat (D23). Publique : le client n'a pas
// de compte. Aucune donnée du contrat n'y figure — ni montant, ni nom, ni
// adresse —, seulement l'état du lien et l'action possible.

const ENTETES = {
  "Content-Type": "text/html; charset=utf-8",
  // Une page d'état de lien ne se met pas en cache et ne se partage pas.
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
};

export function pagePublique(titre: string, corpsHtml: string, statut = 200): Response {
  const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titre}</title>
<style>
  :root { color-scheme: light dark; }
  body { margin: 0; font: 16px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif;
         background: Canvas; color: CanvasText; }
  main { max-width: 32rem; margin: 12vh auto; padding: 0 16px; }
  h1 { font-size: 1.25rem; margin: 0 0 12px; }
  p { margin: 0 0 12px; }
  button { min-height: 44px; padding: 0 20px; font: inherit; border-radius: 8px;
           border: 0; background: #2563eb; color: #fff; cursor: pointer; }
</style></head>
<body><main><h1>${titre}</h1>${corpsHtml}</main></body></html>`;
  return new Response(html, { status: statut, headers: ENTETES });
}
