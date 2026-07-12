// Instrumentation Next.js - exécuté au démarrage du serveur
// 1. Initialise le compte admin par défaut (admin/admin)
// 2. Lance le cron interne de rafraîchissement des cotations BRVM (toutes les 30 min)

export async function register() {
  // Ne s'exécute que côté serveur (nodejs runtime)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // ── Admin ──────────────────────────────────────────────────────────────
    try {
      const { ensureAdminUserExists } = await import('@/lib/auth/init-admin');
      await ensureAdminUserExists();
    } catch (err) {
      console.error('[instrumentation] Erreur initialisation admin:', err);
    }

    // ── Cron BRVM : rafraîchissement cotations toutes les 30 minutes ───────
    try {
      const { startMarketRefreshCron } = await import('@/lib/brvm/market-cron');
      startMarketRefreshCron();
    } catch (err) {
      console.error('[instrumentation] Erreur démarrage cron BRVM:', err);
    }
  }
}
