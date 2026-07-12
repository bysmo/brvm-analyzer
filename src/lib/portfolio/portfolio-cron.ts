/**
 * portfolio-cron.ts
 * ─────────────────────────────────────────────────────────────────────
 * Cron interne Node.js pour les tâches périodiques du portefeuille :
 *
 *  1. Vérification horaire des alertes de rendement (toutes les heures)
 *  2. Envoi du digest hebdomadaire (chaque lundi à 08h00 UTC)
 *
 * Démarre via instrumentation.ts au boot du serveur.
 * ─────────────────────────────────────────────────────────────────────
 */

import { checkPortfolioAlerts } from './alerts';
import { sendWeeklyDigest } from './weekly-digest';

// Intervalle de vérification des alertes : 1 heure
const ALERT_CHECK_INTERVAL_MS = 60 * 60 * 1000;

// Heure d'envoi du digest hebdomadaire (UTC)
const DIGEST_HOUR_UTC = 8;    // 08h00 UTC
const DIGEST_DAY_UTC  = 1;    // Lundi (0=dim, 1=lun, ..., 6=sam)

let alertCronTimer: ReturnType<typeof setInterval> | null = null;
let digestCronTimer: ReturnType<typeof setInterval> | null = null;
let alertRunning = false;
let digestRunning = false;

// Track si le digest a déjà été envoyé cette semaine (par date ISO lundi)
let lastDigestWeek: string | null = null;

// ── ALERTES PORTEFEUILLE ──────────────────────────────────────────────

async function runAlertCheck(): Promise<void> {
  if (alertRunning) {
    console.log('[portfolio-cron] Vérification alertes déjà en cours, skip.');
    return;
  }

  alertRunning = true;
  try {
    console.log('[portfolio-cron] ⏱ Vérification des alertes portefeuille...');
    const results = await checkPortfolioAlerts();
    if (results.length > 0) {
      console.log(`[portfolio-cron] 🔔 ${results.length} alerte(s) déclenchée(s).`);
    }
  } catch (err) {
    console.error('[portfolio-cron] ❌ Erreur vérification alertes:', err);
  } finally {
    alertRunning = false;
  }
}

// ── DIGEST HEBDOMADAIRE ───────────────────────────────────────────────

/**
 * Retourne la date du lundi de la semaine courante au format YYYY-MM-DD.
 * Utilisé pour éviter les envois doubles.
 */
function getCurrentWeekMonday(): string {
  const now = new Date();
  const day = now.getUTCDay(); // 0 = dim
  const monday = new Date(now);
  // Décalage pour revenir au lundi
  monday.setUTCDate(now.getUTCDate() - ((day + 6) % 7));
  return monday.toISOString().slice(0, 10);
}

function shouldSendDigest(): boolean {
  const now = new Date();
  const dayUTC = now.getUTCDay();
  const hourUTC = now.getUTCHours();

  if (dayUTC !== DIGEST_DAY_UTC) return false;
  if (hourUTC !== DIGEST_HOUR_UTC) return false;

  const thisWeek = getCurrentWeekMonday();
  if (lastDigestWeek === thisWeek) return false; // déjà envoyé cette semaine

  return true;
}

async function runDigest(): Promise<void> {
  if (!shouldSendDigest()) return;

  if (digestRunning) {
    console.log('[portfolio-cron] Digest déjà en cours d\'envoi, skip.');
    return;
  }

  digestRunning = true;
  const thisWeek = getCurrentWeekMonday();

  try {
    console.log(`[portfolio-cron] 📧 Démarrage du digest hebdomadaire (semaine: ${thisWeek})...`);
    await sendWeeklyDigest();
    lastDigestWeek = thisWeek;
    console.log(`[portfolio-cron] ✅ Digest hebdomadaire envoyé pour la semaine du ${thisWeek}.`);
  } catch (err) {
    console.error('[portfolio-cron] ❌ Erreur envoi digest:', err);
  } finally {
    digestRunning = false;
  }
}

// ── DÉMARRAGE / ARRÊT ─────────────────────────────────────────────────

/**
 * Démarre les crons portefeuille.
 * Appel idempotent — ignoré si déjà démarré.
 */
export function startPortfolioCron(): void {
  if (alertCronTimer && digestCronTimer) {
    console.log('[portfolio-cron] Crons déjà démarrés, skip.');
    return;
  }

  console.log('[portfolio-cron] 🚀 Démarrage des crons portefeuille.');

  // Cron 1 : vérification des alertes toutes les heures
  // (exécution initiale 5 min après le boot pour laisser le serveur démarrer)
  setTimeout(() => {
    runAlertCheck().catch(err =>
      console.error('[portfolio-cron] Erreur exécution initiale alertes:', err)
    );
  }, 5 * 60 * 1000);

  alertCronTimer = setInterval(() => {
    runAlertCheck().catch(err =>
      console.error('[portfolio-cron] Erreur alertes setInterval:', err)
    );
  }, ALERT_CHECK_INTERVAL_MS);

  if (alertCronTimer.unref) alertCronTimer.unref();

  // Cron 2 : vérification toutes les 10 minutes si c'est l'heure du digest
  digestCronTimer = setInterval(() => {
    runDigest().catch(err =>
      console.error('[portfolio-cron] Erreur digest setInterval:', err)
    );
  }, 10 * 60 * 1000);

  if (digestCronTimer.unref) digestCronTimer.unref();

  console.log('[portfolio-cron] ✅ Alertes: toutes les heures | Digest: lundi 08h00 UTC');
}

/**
 * Arrête les crons (utile pour les tests ou arrêt propre).
 */
export function stopPortfolioCron(): void {
  if (alertCronTimer) { clearInterval(alertCronTimer); alertCronTimer = null; }
  if (digestCronTimer) { clearInterval(digestCronTimer); digestCronTimer = null; }
  console.log('[portfolio-cron] 🛑 Crons portefeuille arrêtés.');
}

/**
 * Force l'envoi immédiat du digest (pour tests / admin).
 */
export async function forceDigest(): Promise<void> {
  console.log('[portfolio-cron] 🔧 Envoi forcé du digest hebdomadaire...');
  await sendWeeklyDigest();
}
