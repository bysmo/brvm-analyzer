/**
 * weekly-digest.ts
 * ─────────────────────────────────────────────────────────────────────
 * Envoi du digest hebdomadaire à tous les abonnés actifs.
 *
 * Pour chaque abonné :
 *  1. Charge ses positions ouvertes
 *  2. Calcule les rendements avec les derniers cours en DB
 *  3. Récupère les 10 actualités BRVM (sikafinance)
 *  4. Envoie le template weeklyDigestTemplate
 * ─────────────────────────────────────────────────────────────────────
 */

import { db } from '@/lib/db';
import { sendEmail, weeklyDigestTemplate, type WeeklyDigestPosition } from '@/lib/email/mailer';
import { computePositionYield, computePortfolioSummary } from './yield-calculator';
import { fetchBRVMNews } from '@/lib/brvm/news-scraper';
import { getLatestPricesMap } from '@/lib/brvm/quotes-service';

export interface DigestResult {
  userId: string;
  email: string;
  positionsCount: number;
  emailSent: boolean;
  error?: string;
}

/**
 * Envoie le bilan hebdomadaire à tous les abonnés actifs ayant un email validé.
 */
export async function sendWeeklyDigest(): Promise<DigestResult[]> {
  const results: DigestResult[] = [];
  const now = new Date();

  console.log('[weekly-digest] 🚀 Démarrage de l\'envoi hebdomadaire...');

  try {
    // 1. Récupérer les actualités BRVM (une seule fois pour tous les users)
    const news = await fetchBRVMNews(true);
    console.log(`[weekly-digest] ${news.length} actualité(s) récupérée(s).`);

    // 2. Récupérer tous les abonnés actifs avec email validé
    const activeSubscribers = await db.user.findMany({
      where: {
        emailValidated: true,
        subscriptions: {
          some: {
            status: 'active',
            endDate: { gt: now },
          },
        },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        portfolioConfig: true,
        positions: {
          where: { status: 'open' },
          select: {
            id: true,
            ticker: true,
            name: true,
            quantity: true,
            acquisitionPrice: true,
            acquisitionDate: true,
            totalCostXOF: true,
          },
        },
      },
    });

    console.log(`[weekly-digest] ${activeSubscribers.length} abonné(s) à traiter.`);

    // Charger les derniers cours pour tous les tickers distincts (avec normalisation via service)
    const allTickers = [...new Set(activeSubscribers.flatMap(u => u.positions.map(p => p.ticker)))];
    const latestPrices = await getLatestPricesMap(allTickers);

    // Label de la semaine
    const weekLabel = now.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

    // 3. Traiter chaque abonné
    for (const user of activeSubscribers) {
      try {
        // Calculer les rendements de chaque position
        const digestPositions: WeeklyDigestPosition[] = [];
        let totalCostXOF = 0;
        let totalCurrentValueXOF = 0;

        for (const pos of user.positions) {
          // Fallback sur le prix d'acquisition si indisponible
          const currentPrice = latestPrices.get(pos.ticker) ?? pos.acquisitionPrice;
          const yieldData = computePositionYield(
            pos.acquisitionPrice,
            pos.quantity,
            currentPrice,
            new Date(pos.acquisitionDate)
          );

          totalCostXOF += pos.totalCostXOF;
          totalCurrentValueXOF += yieldData.currentValueXOF;

          // Couleur de recommandation basée sur le rendement vs seuil
          const threshold = user.portfolioConfig?.yieldThresholdPct ?? 15;
          let recommandation = 'CONSERVER';
          let recommandationColor = '#FFD700';
          if (yieldData.grossYieldPct >= threshold) {
            recommandation = 'VENDRE';
            recommandationColor = '#FF4757';
          } else if (yieldData.grossYieldPct >= threshold * 0.7) {
            recommandation = 'OBSERVER';
            recommandationColor = '#FF8C42';
          } else if (yieldData.grossYieldPct > 0) {
            recommandation = 'CONSERVER';
            recommandationColor = '#00D678';
          }

          digestPositions.push({
            ticker: pos.ticker,
            name: pos.name,
            quantity: pos.quantity,
            acquisitionPrice: pos.acquisitionPrice,
            currentPrice,
            grossYieldPct: yieldData.grossYieldPct,
            annualizedYieldPct: yieldData.annualizedYieldPct,
            gainXOF: yieldData.gainXOF,
            recommandation,
            recommandationColor,
          });
        }

        const totalGainXOF = totalCurrentValueXOF - totalCostXOF;
        const totalGrossYieldPct = totalCostXOF > 0
          ? parseFloat(((totalGainXOF / totalCostXOF) * 100).toFixed(2))
          : 0;

        // Calcul progression vers objectif
        let progressionPct: number | null = null;
        if (user.portfolioConfig) {
          progressionPct = parseFloat(
            Math.min(100, (totalCurrentValueXOF / user.portfolioConfig.targetAmountXOF) * 100).toFixed(1)
          );
        }

        const { html, text, subject } = weeklyDigestTemplate({
          firstName: user.firstName,
          email: user.email,
          positions: digestPositions,
          totalCurrentValueXOF,
          totalGainXOF,
          totalGrossYieldPct,
          progressionPct,
          targetAmountXOF: user.portfolioConfig?.targetAmountXOF ?? null,
          monthlyContribXOF: user.portfolioConfig?.monthlyContribXOF ?? null,
          news,
          weekOf: weekLabel,
        });

        const emailResult = await sendEmail({ to: user.email, subject, html, text });

        results.push({
          userId: user.id,
          email: user.email,
          positionsCount: digestPositions.length,
          emailSent: emailResult.success,
        });

        // Petite pause pour ne pas saturer le SMTP
        await sleep(200);
      } catch (err: any) {
        console.error(`[weekly-digest] Erreur pour ${user.email}:`, err);
        results.push({
          userId: user.id,
          email: user.email,
          positionsCount: 0,
          emailSent: false,
          error: err?.message,
        });
      }
    }

    const sent = results.filter(r => r.emailSent).length;
    console.log(`[weekly-digest] ✅ ${sent}/${results.length} emails envoyés.`);
  } catch (err) {
    console.error('[weekly-digest] Erreur globale:', err);
  }

  return results;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
