import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Self-contained server bundle (.next/standalone) for the Docker/VPS deploy.
  output: "standalone",
  // Pin the workspace root to this project so Turbopack stops picking up the
  // user-home lockfile when multiple lockfiles exist on the machine.
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Ship the embedded PDF font with the server bundle (read via process.cwd()
  // in the @react-pdf devis renderer) so it survives on Vercel.
  outputFileTracingIncludes: {
    "/api/documents/**": ["./public/fonts/**"],
  },
  experimental: {
    // Derrière le reverse-proxy (Traefik) : autorise les Server Actions depuis
    // le domaine public, sinon le contrôle CSRF de Next fait échouer la
    // navigation post-login (« This page couldn't load »).
    serverActions: {
      allowedOrigins: ["crmoptimum.com", "www.crmoptimum.com"],
      // Upload photos/vidéos (uploadLeadMedia) : le défaut Next est 1 Mo, or on
      // accepte jusqu'à 100 Mo/fichier. On aligne (+ marge multipart) pour qu'un
      // fichier au plafond passe. Uploader les grosses vidéos une par une.
      bodySizeLimit: "110mb",
    },
  },
  // En-têtes de sécurité (CDC §Sécurité). CSP limitée à `frame-ancestors 'none'`
  // (anti-clickjacking) pour ne pas casser le chargement des ressources ; une
  // CSP de contenu complète (script-src/connect-src avec nonces) reste à ajouter
  // après tests (webphone Ringover, Realtime Supabase, workers PDF).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "geolocation=(), payment=(), usb=(), browsing-topics=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        ],
      },
    ];
  },
};

export default nextConfig;
