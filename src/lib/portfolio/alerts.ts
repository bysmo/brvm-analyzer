/**
 * alerts.ts
 * ─────────────────────────────────────────────────────────────────────
 * Vérification des alertes pour les positions du portefeuille.
 *
 * Déclenche un email si :
 *  1. Rendement brut d'une position ≥ seuil configuré (yieldThresholdPct)
 *  2. Recommandation du moteur = VENDRE pour une position ouverte
 *
 * Anti-spam : une alerte par position ne peut être envoyée plus d'une fois
 * par 24h (contrôlé via alertSentAt en DB).
 * ─────────────────────────────────────────────────────────────────────
 */

import { db } from '@/lib/db';
import { sendEmail } from '@/lib/email/mailer';
import { computePositionYield } from './yield-calculator';
import { portfolioAlertTemplate } from '@/lib/email/mailer';
import { getLatestPricesMap } from '@/lib/brvm/quotes-service';

const ALERT_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24h entre deux alertes

export interface AlertResult {
  positionId: string;
  ticker: string;
  userEmail: string;
  alertType: 'YIELD_THRESHOLD' | 'SELL_RECOMMENDATION';
  grossYieldPct: number;
  emailSent: boolean;
}

/**
 * Vérifie toutes les positions ouvertes et envoie des alertes si nécessaire.
 * Peut être ciblé sur un userId spécifique ou traiter tous les utilisateurs.
 *
 * @param targetUserId  Si fourni, ne vérifie que cet utilisateur
 * @returns  Liste des alertes déclenchées
 */
export async function checkPortfolioAlerts(targetUserId?: string): Promise<AlertResult[]> {
  const results: AlertResult[] = [];
  const now = new Date();

  try {
    // Charger toutes les positions ouvertes avec config et user
    const positions = await db.portfolioPosition.findMany({
      where: {
        status: 'open',
        ...(targetUserId ? { userId: targetUserId } : {}),
        user: {
          emailValidated: true,
          subscriptions: {
            some: {
              status: 'active',
              endDate: { gt: now },
            },
          },
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            portfolioConfig: true,
          },
        },
      },
    });

    if (positions.length === 0) return results;

    // Charger les derniers cours pour tous les tickers concernés (avec normalisation)
    const tickers = [...new Set(positions.map(p => p.ticker))];
    const latestQuotes = await getLatestPricesMap(tickers);

    // Analyser chaque position
    for (const position of positions) {
      const config = position.user.portfolioConfig;
      if (!config) continue; // pas de config financière = pas de seuil

      // Récupérer le cours actuel (avec fallback sur le prix d'achat si indisponible pour éviter N/D)
      const currentPrice = latestQuotes.get(position.ticker) ?? position.acquisitionPrice;

      const yieldData = computePositionYield(
        position.acquisitionPrice,
        position.quantity,
        currentPrice,
        new Date(position.acquisitionDate)
      );

      // Vérification anti-spam
      const lastAlert = position.alertSentAt ? new Date(position.alertSentAt) : null;
      const cooldownOk = !lastAlert || (now.getTime() - lastAlert.getTime()) >= ALERT_COOLDOWN_MS;
      if (!cooldownOk) continue;

      // Condition 1 : seuil de rendement atteint
      const yieldThresholdReached = yieldData.grossYieldPct >= config.yieldThresholdPct;

      if (yieldThresholdReached) {
        const { html, text, subject } = portfolioAlertTemplate({
          firstName: position.user.firstName,
          email: position.user.email,
          ticker: position.ticker,
          name: position.name,
          acquisitionPrice: position.acquisitionPrice,
          acquisitionDate: new Date(position.acquisitionDate),
          quantity: position.quantity,
          currentPrice,
          grossYieldPct: yieldData.grossYieldPct,
          annualizedYieldPct: yieldData.annualizedYieldPct,
          gainXOF: yieldData.gainXOF,
          yieldThresholdPct: config.yieldThresholdPct,
          alertType: 'YIELD_THRESHOLD',
        });

        const emailResult = await sendEmail({
          to: position.user.email,
          subject,
          html,
          text,
        });

        // Mettre à jour alertSentAt
        await db.portfolioPosition.update({
          where: { id: position.id },
          data: { alertSentAt: now },
        });

        results.push({
          positionId: position.id,
          ticker: position.ticker,
          userEmail: position.user.email,
          alertType: 'YIELD_THRESHOLD',
          grossYieldPct: yieldData.grossYieldPct,
          emailSent: emailResult.success,
        });
      }
    }

    console.log(`[portfolio-alerts] ${results.length} alerte(s) déclenchée(s) sur ${positions.length} positions vérifiées.`);
  } catch (err) {
    console.error('[portfolio-alerts] Erreur:', err);
  }

  return results;
}

/**
 * Vérifie les alertes pour une position spécifique (appelé après ajout/mise à jour).
 */
export async function checkSinglePositionAlert(positionId: string): Promise<AlertResult | null> {
  const results = await checkPortfolioAlerts();
  return results.find(r => r.positionId === positionId) ?? null;
}
