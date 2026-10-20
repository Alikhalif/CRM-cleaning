import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

// Next.js 16 renamed `middleware.ts` → `proxy.ts` and the function name
// from `middleware` to `proxy`. The runtime is always nodejs.

// Chemins publics ancrés : les routes d'auth doivent matcher exactement ou avec
// un sous-chemin (`/login`, `/login/…`) — mais PAS `/login-xxx`. `api/` et
// `_next/` restent des préfixes ; `favicon.ico` est exact.
// `sign` = signature électronique documents (/sign/{token}) ;
// `devis-signer` = signature du devis OPTIMIVV (/devis-signer/{token}). Dans les
// deux cas le client n'est pas authentifié, l'accès est validé par le token.
// `email-signatures/` = bannières publiques ajoutées aux e-mails client (doivent
// être chargeables par les clients mail non authentifiés, ex. le proxy Gmail).
const PUBLIC_PATH = /^\/(login|signup|forgot-password|reset-password|auth\/callback|sign|devis-signer)(\/|$)|^\/(api|_next|email-signatures)\/|^\/favicon\.ico$/;

// Chemins pour lesquels la validation du jeton n'apporte RIEN et coûte un
// aller-retour réseau à chaque requête.
//
// Liste volontairement étroite, et strictement incluse dans PUBLIC_PATH :
//   • `_next/` et `email-signatures/` : fichiers statiques.
//   • `favicon.ico` : idem.
//   • les extensions de fichiers servis depuis `public/` (polices, images,
//     PDF…), que le matcher laisse passer aujourd'hui.
//
// Ce qui N'EST PAS dans cette liste, à dessein :
//   • `/api/*` — son statut reste exactement celui d'aujourd'hui. Chaque route
//     d'API porte sa propre authentification (HMAC, secret de cron, session) ;
//     on ne touche pas à cet équilibre dans un correctif de performance.
//   • `/login` et `/signup` — c'est justement `getUser()` qui y renvoie un
//     utilisateur déjà connecté vers `/dashboard`.
//   • `/sign/…` et `/devis-signer/…` — pages client, rares, laissées intactes.
//
// Aucune route PRIVÉE n'est concernée : le chemin non public suit exactement le
// code d'avant, validation du jeton comprise.
const STATIC_PATH = /^\/(_next|email-signatures)\/|^\/favicon\.ico$|\.(?:js|css|map|png|jpe?g|gif|svg|webp|avif|ico|woff2?|ttf|otf|eot|pdf|txt|xml|webmanifest)$/i;

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });

  // Sortie anticipée AVANT toute validation de jeton : un fichier statique ne
  // dépend d'aucune session, et cet appel se payait sur chaque requête.
  if (STATIC_PATH.test(request.nextUrl.pathname)) return response;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          // Mirror Supabase's session cookies onto the outgoing response so
          // the next request carries a fresh access token.
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set({ name, value, ...options });
          });
        },
      },
    },
  );

  // getUser() validates the token against Supabase rather than trusting the
  // cookie alone — safer than getSession() in middleware.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATH.test(pathname);

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Already signed in but landing on /login or /signup → bounce home.
  if (user && (pathname === "/login" || pathname === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Run for everything except Next internals and static images. The function
  // body further whitelists /login + /signup for unauthenticated access.
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico).*)"],
};
