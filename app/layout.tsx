import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.scss";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "CGK CRM", template: "%s · CGK CRM" },
  description: "Commercial · devis · facturation",
};

// Inline pre-paint script: applies the saved theme before React hydrates,
// preventing a light->dark flash. Runs once, synchronously.
const themeBootstrap = `
(function(){try{
  var t=localStorage.getItem('cgk-theme');
  if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}
  document.documentElement.setAttribute('data-theme',t);
}catch(_){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The pre-paint theme script (below) mutates `data-theme` on <html> before
    // hydration — suppressHydrationWarning tells React to ignore that delta
    // here only. Children still get the normal hydration check.
    <html lang="fr" className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
