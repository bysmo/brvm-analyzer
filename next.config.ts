import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    // TODO: Réactiver les erreurs de build en production dès que possible
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    webpackBuildWorker: false,
  },
  reactStrictMode: true,

  // ── Headers de sécurité HTTP ───────────────────────────────────────────────
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Interdit l'intégration dans un iframe (prévient le clickjacking)
          { key: "X-Frame-Options", value: "DENY" },
          // Empêche le navigateur d'interpréter les fichiers avec un type MIME différent
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Politique de referrer stricte
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Désactive les fonctionnalités navigateur inutiles (caméra, micro, géoloc)
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          // Force HTTPS pour 1 an (uniquement en production, Caddy ou Vercel s'en chargent)
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
          // Politique de sécurité de contenu (CSP) – adaptée à Next.js + Stripe + Orange Money
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // Scripts Next.js, Stripe Elements et inline nécessaires pour SSR/hydration
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com",
              // Styles inline autorisés (Tailwind + Radix UI)
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              // Polices Google Fonts
              "font-src 'self' https://fonts.gstatic.com",
              // Frames Stripe uniquement
              "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
              // Images: self + data URIs (avatars, flags emojis, icons)
              "img-src 'self' data: https:",
              // Connexions API : self + Stripe + Orange Money + Jina Reader
              "connect-src 'self' https://api.stripe.com https://api.orange.com https://r.jina.ai",
              // Pas d'objets embarqués
              "object-src 'none'",
              // Bloque les requêtes vers des origines non listées
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;

