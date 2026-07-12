import { NextResponse } from 'next/server';
import { forceRefreshMarketList } from '@/lib/brvm/scraper';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max (Vercel Pro)

// ─────────────────────────────────────────────────────────────────────────────
// Cron job : rafraîchit les cotations BRVM toutes les 30 minutes
// Règles métier :
//   - La BRVM est en UTC (GMT+0 comme l'Afrique de l'Ouest)
//   - Marché ouvert ~09h30 – 15h00, dernières publications ~17h00
//   - Ce job scrappe la liste A-Z, écrase les enregistrements du JOUR en cours
//     (upsert sur [ticker, tradeDate]) jusqu'aux valeurs finales du soir
//   - Après 17h00 UTC, le job répond "market closed" sans scraper
// ─────────────────────────────────────────────────────────────────────────────

const MARKET_CLOSE_HOUR_UTC = 17; // 17h00 UTC = clôture définitive des données

function getTodayBRVM(): string {
  // La BRVM est en UTC (pas de décalage horaire)
  const now = new Date();
  return now.toISOString().slice(0, 10); // YYYY-MM-DD
}

function isMarketDataFrozen(): boolean {
  const now = new Date();
  const hourUTC = now.getUTCHours();
  const dayOfWeek = now.getUTCDay(); // 0 = dimanche, 6 = samedi

  // Week-end : pas de trading
  if (dayOfWeek === 0 || dayOfWeek === 6) return true;

  // Après 17h00 UTC : données figées pour la journée
  return hourUTC >= MARKET_CLOSE_HOUR_UTC;
}

export async function GET(request: Request) {
  // Vérification du secret cron (obligatoire en production)
  const cronSecret = request.headers.get('X-Cron-Secret');
  const expectedSecret = process.env.CRON_SECRET;

  if (expectedSecret && cronSecret !== expectedSecret) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const now = new Date();
  const tradeDate = getTodayBRVM();

  // Si les données sont figées (après 17h ou week-end), on skipe le scraping
  if (isMarketDataFrozen()) {
    return NextResponse.json({
      success: true,
      skipped: true,
      reason: 'market_closed',
      tradeDate,
      timestamp: now.toISOString(),
    });
  }

  try {
    console.log(`[cron/refresh-market] Démarrage rafraîchissement – ${tradeDate} ${now.toISOString()}`);

    // Scrape la liste complète A-Z (invalide le cache mémoire)
    const rows = await forceRefreshMarketList();

    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Aucune donnée scrappée (liste vide)' },
        { status: 502 }
      );
    }

    // Upsert en base : écrase les valeurs du jour pour chaque ticker
    const upserts = rows.map((row) =>
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
    );

    // Exécution en parallèle (batch de 10 pour ne pas saturer SQLite)
    const BATCH_SIZE = 10;
    let upsertedCount = 0;
    for (let i = 0; i < upserts.length; i += BATCH_SIZE) {
      const batch = upserts.slice(i, i + BATCH_SIZE);
      await Promise.all(batch);
      upsertedCount += batch.length;
    }

    console.log(`[cron/refresh-market] ✅ ${upsertedCount} cotations mises à jour pour ${tradeDate}`);

    return NextResponse.json({
      success: true,
      skipped: false,
      tradeDate,
      updatedCount: upsertedCount,
      timestamp: now.toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[cron/refresh-market] Erreur:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
