import { db } from '@/lib/db';
import { fetchMarketList } from './scraper';

/**
 * Normalise un ticker pour la base de données.
 * Les cotations dans MarketQuote et BRVM_STOCKS sont enregistrées en minuscules avec le suffixe (ex: 'boab.bj').
 */
export function normalizeTicker(ticker: string): string {
  if (!ticker) return '';
  return ticker.trim().toLowerCase();
}

/**
 * Garantit que la table MarketQuote contient des données.
 * Si elle est vide, lance un scraping immédiat de la liste A-Z pour la peupler.
 */
export async function ensureQuotesPopulated(): Promise<void> {
  try {
    const count = await db.marketQuote.count();
    if (count > 0) return;

    console.log('[quotes-service] 💡 La table MarketQuote est vide. Remplissage à la volée...');
    const rows = await fetchMarketList();
    if (!rows || rows.length === 0) {
      console.warn('[quotes-service] ⚠️ Aucun cours récupéré lors du remplissage initial.');
      return;
    }

    const now = new Date();
    const tradeDate = now.toISOString().split('T')[0];

    // Insertion en DB
    await db.$transaction(
      rows.map(row =>
        db.marketQuote.upsert({
          where: {
            ticker_tradeDate: {
              ticker: row.ticker.toLowerCase(),
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
            ticker: row.ticker.toLowerCase(),
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
    console.log(`[quotes-service] ✅ Remplissage initial réussi avec ${rows.length} cotations.`);
  } catch (err) {
    console.error('[quotes-service] ❌ Erreur lors du remplissage des cotations:', err);
  }
}

/**
 * Récupère le dernier cours en DB pour un ticker de position.
 * Gère le format exact en minuscules (ex: 'boab.bj').
 */
export async function getLatestPriceForTicker(ticker: string): Promise<number | null> {
  await ensureQuotesPopulated();

  const key = normalizeTicker(ticker);
  if (!key) return null;

  try {
    // 1. Chercher par ticker exact (ex: 'boab.bj')
    let quote = await db.marketQuote.findFirst({
      where: { ticker: key },
      orderBy: { tradeDate: 'desc' },
      select: { dernier: true },
    });

    if (quote?.dernier && quote.dernier > 0) {
      return quote.dernier;
    }

    // 2. Fallback pour les alias ou saisies inexactes
    // Si l'utilisateur a écrit 'boa.bj' ou 'boab' sans extension
    const baseTicker = key.includes('.') ? key.split('.')[0] : key;

    // Si on a saisi 'boa' (ou 'boa.bj'), chercher un ticker BOA Bénin de préférence
    if (baseTicker === 'boa') {
      const fallbackBOA = await db.marketQuote.findFirst({
        where: { ticker: 'boab.bj' },
        orderBy: { tradeDate: 'desc' },
        select: { dernier: true },
      });
      if (fallbackBOA?.dernier) return fallbackBOA.dernier;
    }

    // Chercher par préfixe (ex: si key est 'boab', trouver 'boab.bj')
    quote = await db.marketQuote.findFirst({
      where: {
        ticker: {
          startsWith: baseTicker,
        },
      },
      orderBy: { tradeDate: 'desc' },
      select: { dernier: true },
    });

    if (quote?.dernier && quote.dernier > 0) {
      return quote.dernier;
    }

    return null;
  } catch (err) {
    console.error(`[quotes-service] Erreur récupération prix pour ${ticker}:`, err);
    return null;
  }
}

/**
 * Récupère une Map des derniers cours pour une liste de tickers de positions.
 */
export async function getLatestPricesMap(tickers: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  for (const ticker of tickers) {
    const price = await getLatestPriceForTicker(ticker);
    if (price !== null && price > 0) {
      map.set(ticker, price);
    }
  }
  return map;
}
