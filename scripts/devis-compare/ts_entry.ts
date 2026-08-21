// Entrée de test : génère le PDF du devis via le générateur TS (lib/devis) pour
// un JSON donné, afin de le comparer au PDF de référence (reportlab).
//
//   node_modules/.bin/esbuild scripts/devis-compare/ts_entry.ts \
//     --bundle --platform=node --format=esm --external:pdfkit \
//     --outfile=_ts_entry.mjs
//   node _ts_entry.mjs <data.json> <sortie.pdf>
//
// (esbuild résout les imports relatifs ; pdfkit reste externe et est résolu au
//  runtime depuis node_modules — d'où le --outfile à la racine du projet.)

import { genererDevisBuffer } from "../../lib/devis/render";
import fs from "node:fs";

const [, , inPath, outPath] = process.argv;
if (!inPath || !outPath) {
  console.error("usage: node ts_entry.mjs <data.json> <sortie.pdf>");
  process.exit(1);
}
const data = JSON.parse(fs.readFileSync(inPath, "utf8"));
const pdf = await genererDevisBuffer(data);
fs.writeFileSync(outPath, pdf);
console.log("PDF TS écrit :", outPath, pdf.length, "octets");
