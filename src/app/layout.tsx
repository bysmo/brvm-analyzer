import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BRVM Analyzer — Analyse boursière temps réel",
  description: "Application d'analyse des actions cotées à la Bourse Régionale des Valeurs Mobilières (BRVM) : liquidité, fondamentaux, PER, DPA, actionnaires, verdict d'investissement.",
  keywords: ["BRVM", "bourse", "Afrique de l'Ouest", "sikafinance", "actions", "investissement", "PER", "DPA"],
  authors: [{ name: "BRVM Analyzer" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased bg-brvm-bg text-brvm-fg`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
