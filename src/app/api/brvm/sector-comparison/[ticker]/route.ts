import { NextResponse } from 'next/server';
import { fetchMultipleStocks } from '@/lib/brvm/scraper';
import { getStockByTicker, BRVM_STOCKS } from '@/lib/brvm/stocks';
import { getUserFromRequest } from '@/lib/auth/auth';
import type { FundamentalYear } from '@/lib/brvm/types';

export const dynamic = 'force-dynamic';

// Cache en mémoire (TTL 1 heure) pour éviter de re-fetcher les données sectorielles
interface SectorCacheEntry {
  data: SectorComparisonData | null;
  timestamp: number;
}
const SECTOR_CACHE: Record<string, SectorCacheEntry> = {};
const SECTOR_TTL_MS = 60 * 60 * 1000; // 1h

export interface SectorCompany {
  ticker: string;
  name: string;
  flag: string;
  country: string;
  isCurrent: boolean;
  fundamentals: FundamentalYear[];
}

export interface SectorComparisonData {
  sector: string;
  currentTicker: string;
  companies: SectorCompany[];
  years: number[];
  // Moyennes sectorielles par année
  averages: {
    year: number;
    bnpa: number | null;
    per: number | null;
    dividende: number | null;
  }[];
  fetchedAt: string;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker: rawTicker } = await params;
  const ticker = decodeURIComponent(rawTicker).toLowerCase();

  // ── Vérification d'authentification et d'abonnement ────────────────────────
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }
  if (user.role !== 'admin' && !user.subscription?.isActive) {
    return NextResponse.json(
      { error: 'Abonnement actif requis pour accéder à la comparaison sectorielle' },
      { status: 403 }
    );
  }

  const meta = getStockByTicker(ticker);
  if (!meta) {
    return NextResponse.json({ error: `Ticker inconnu: ${ticker}` }, { status: 404 });
  }

  const sector = meta.sector;

  // Vérifier le cache sectoriel
  const cacheKey = sector;
  const now = Date.now();
  const cached = SECTOR_CACHE[cacheKey];
  if (cached && cached.data && (now - cached.timestamp) < SECTOR_TTL_MS) {
    // On a les données du secteur en cache, on marque juste la company courante
    const data: SectorComparisonData = {
      ...cached.data,
      currentTicker: meta.ticker,
      companies: cached.data.companies.map(c => ({
        ...c,
        isCurrent: c.ticker === meta.ticker,
      })),
    };
    return NextResponse.json(data);
  }

  // Trouver toutes les actions du même secteur
  const sectorStocks = BRVM_STOCKS.filter(s => s.sector === sector);

  try {
    // Récupérer les fondamentaux de toutes les actions du secteur
    const tickersToFetch = sectorStocks.map(s => s.ticker);
    const stocks = await fetchMultipleStocks(tickersToFetch);

    const companies: SectorCompany[] = sectorStocks.map(s => {
      const stockData = stocks.find(sd => sd.ticker === s.ticker);
      return {
        ticker: s.ticker,
        name: s.name,
        flag: s.flag,
        country: s.country,
        isCurrent: s.ticker === meta.ticker,
        fundamentals: stockData?.fundamentals || [],
      };
    });

    // Récupérer toutes les années présentes
    const yearSet = new Set<number>();
    for (const c of companies) {
      for (const f of c.fundamentals) {
        yearSet.add(f.year);
      }
    }
    const years = Array.from(yearSet).sort();

    // Calcul des moyennes sectorielles par année
    const averages = years.map(year => {
      const bnpaValues: number[] = [];
      const perValues: number[] = [];
      const divValues: number[] = [];
      for (const c of companies) {
        const f = c.fundamentals.find(f => f.year === year);
        if (f) {
          if (f.bnpa > 0) bnpaValues.push(f.bnpa);
          if (f.per > 0 && f.per < 200) perValues.push(f.per);
          if (f.dividende > 0) divValues.push(f.dividende);
        }
      }
      return {
        year,
        bnpa: bnpaValues.length > 0
          ? bnpaValues.reduce((a, b) => a + b, 0) / bnpaValues.length
          : null,
        per: perValues.length > 0
          ? perValues.reduce((a, b) => a + b, 0) / perValues.length
          : null,
        dividende: divValues.length > 0
          ? divValues.reduce((a, b) => a + b, 0) / divValues.length
          : null,
      };
    });

    const data: SectorComparisonData = {
      sector,
      currentTicker: meta.ticker,
      companies,
      years,
      averages,
      fetchedAt: new Date().toISOString(),
    };

    // Mettre en cache
    SECTOR_CACHE[cacheKey] = { data, timestamp: now };

    return NextResponse.json(data);
  } catch (err: any) {
    console.error('[api/brvm/sector-comparison] error:', err);
    return NextResponse.json(
      { error: err?.message || 'Erreur serveur' },
      { status: 500 }
    );
  }
}
