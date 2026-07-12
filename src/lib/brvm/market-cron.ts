/**
 * market-cron.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Cron interne Node.js pour le rafraîchissement des cotations BRVM.
 *
 * Règles métier :
 *  - La BRVM est en heure UTC (Afrique de l'Ouest = GMT+0 en saison)
 *  - Marché ouvert : lundi-vendredi, ~09h30 – 15h00
 *  - Dernières publications disponibles : jusqu'à ~17h00 UTC
 *  - Ce cron s'exécute TOUTES LES 30 MINUTES
 *  - Entre 09h00 et 17h00 (UTC, jours ouvrés) : scrape + upsert en DB
 *  - En dehors de cette plage : skip silencieux
 *  - Les données du même jour sont toujours ÉCRASÉES (upsert par ticker+date)
 *
 * ───────────────────────────────────────────────────────────────────────────
 */

import { forceRefreshMarketList } from './scraper';
import { db } from '@/lib/db';

// Intervalle : 30 minutes en millisecondes
const INTERVAL_MS = 30 * 60 * 1000;

// Heure de début et fin (UTC) pour le scraping actif
const MARKET_OPEN_HOUR_UTC = 9;   // 09h00 UTC
const MARKET_CLOSE_HOUR_UTC = 17; // 17h00 UTC

let cronTimer: ReturnType<typeof setInterval> | null = null;
let isRunning = false; // garde-fou contre les exécutions simultanées

/**
 * Vérifie si on doit scraper maintenant.
 * Retourne false en dehors des heures de marché ou le week-end.
 */
function shouldRefresh(): boolean {
  const now = new Date();
  const dayOfWeek = now.getUTCDay(); // 0 = dimanche, 6 = samedi
  const hourUTC = now.getUTCHours();

  if (dayOfWeek === 0 || dayOfWeek === 6) return false;
  return hourUTC >= MARKET_OPEN_HOUR_UTC && hourUTC < MARKET_CLOSE_HOUR_UTC;
}

/**
 * Retourne la date de trading au format YYYY-MM-DD (UTC).
 */
function getTradeDateUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Exécute un rafraîchissement complet des cotations BRVM.
 * Upsert en base : les valeurs du même jour sont ÉCRASÉES à chaque passage.
 */
async function runRefresh(): Promise<void> {
  if (isRunning) {
    console.log('[market-cron] Rafraîchissement déjà en cours, skip.');
    return;
  }

  if (!shouldRefresh()) {
    console.log('[market-cron] Hors plage horaire (marché fermé), skip.');
    return;
  }

  isRunning = true;
  const now = new Date();
  const tradeDate = getTradeDateUTC();

  try {
    console.log(`[market-cron] ⏱ Démarrage – ${tradeDate} ${now.toISOString()}`);

    const rows = await forceRefreshMarketList();

    if (!rows || rows.length === 0) {
      console.warn('[market-cron] ⚠️ Scraping retourné vide, aucune mise à jour.');
      return;
    }

    // Upsert en batch (10 à la fois pour ne pas saturer SQLite)
    const BATCH_SIZE = 10;
    let upsertedCount = 0;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map((row) =>
          db.marketQuote.upsert({
            where: {
              ticker_tradeDate: {
                ticker: row.ticker,
                tradeDate,
              },
            },
            update: {
              name: row.name,
              ouverture: row.ouverture,
              plusHaut: row.plusHaut,
              plusBas: row.plusBas,
              dernier: row.dernier,
              variation: row.variation,
              volumeTitres: row.volumeTitres,
              volumeXOF: row.volumeXOF,
              inTopBRVM30: row.inTopBRVM30,
              scrapedAt: now,
            },
            create: {
              ticker: row.ticker,
              tradeDate,
              name: row.name,
              ouverture: row.ouverture,
              plusHaut: row.plusHaut,
              plusBas: row.plusBas,
              dernier: row.dernier,
              variation: row.variation,
              volumeTitres: row.volumeTitres,
              volumeXOF: row.volumeXOF,
              inTopBRVM30: row.inTopBRVM30,
              scrapedAt: now,
            },
          })
        )
      );
      upsertedCount += batch.length;
    }

    console.log(`[market-cron] ✅ ${upsertedCount} cotations mises à jour pour ${tradeDate}`);
  } catch (err) {
    console.error('[market-cron] ❌ Erreur lors du rafraîchissement:', err);
  } finally {
    isRunning = false;
  }
}

/**
 * Démarre le cron de rafraîchissement des cotations BRVM.
 * - S'exécute immédiatement au boot si dans les heures d'ouverture
 * - Puis toutes les 30 minutes
 * - Appel idempotent : ignoré si le cron est déjà démarré
 */
export function startMarketRefreshCron(): void {
  if (cronTimer) {
    console.log('[market-cron] Cron déjà démarré, skip.');
    return;
  }

  console.log('[market-cron] 🚀 Démarrage du cron BRVM (intervalle: 30 min)');

  // Exécution immédiate au démarrage du serveur
  runRefresh().catch((err) =>
    console.error('[market-cron] Erreur exécution initiale:', err)
  );

  // Puis toutes les 30 minutes
  cronTimer = setInterval(() => {
    runRefresh().catch((err) =>
      console.error('[market-cron] Erreur dans le setInterval:', err)
    );
  }, INTERVAL_MS);

  // Évite que le timer bloque l'arrêt propre du processus
  if (cronTimer.unref) cronTimer.unref();

  console.log(`[market-cron] ✅ Cron planifié – prochain tick dans ${INTERVAL_MS / 60000} min`);
}

/**
 * Arrête le cron (utile pour les tests ou un arrêt propre).
 */
export function stopMarketRefreshCron(): void {
  if (cronTimer) {
    clearInterval(cronTimer);
    cronTimer = null;
    console.log('[market-cron] 🛑 Cron arrêté.');
  }
}
