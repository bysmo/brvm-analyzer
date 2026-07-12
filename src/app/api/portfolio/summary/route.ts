import { NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/auth';
import { db } from '@/lib/db';
import { computePositionYield, computePortfolioSummary } from '@/lib/portfolio/yield-calculator';
import { getLatestPricesMap } from '@/lib/brvm/quotes-service';

export const dynamic = 'force-dynamic';

// GET /api/portfolio/summary — résumé global du portefeuille
export async function GET(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const [config, openPositions, soldPositions] = await Promise.all([
    db.portfolioConfig.findUnique({ where: { userId: user.id } }),
    db.portfolioPosition.findMany({ where: { userId: user.id, status: 'open' } }),
    db.portfolioPosition.findMany({
      where: { userId: user.id, status: 'sold' },
      select: { realizedGainXOF: true },
    }),
  ]);

  // Charger les derniers cours pour les positions ouvertes via notre service
  const tickers = [...new Set(openPositions.map(p => p.ticker))];
  const latestPrices = await getLatestPricesMap(tickers);

  // Enrichir les positions ouvertes avec la valeur actuelle
  const enrichedOpen = openPositions.map(pos => {
    // Si aucun cours n'est trouvé, on utilise pos.acquisitionPrice en guise de fallback (0% de gain)
    const currentPrice = latestPrices.get(pos.ticker) ?? pos.acquisitionPrice;
    const yieldData = computePositionYield(
      pos.acquisitionPrice,
      pos.quantity,
      currentPrice,
      new Date(pos.acquisitionDate)
    );
    return {
      totalCostXOF: pos.totalCostXOF,
      currentValueXOF: yieldData.currentValueXOF,
    };
  });

  const summary = computePortfolioSummary(
    enrichedOpen,
    soldPositions,
    config ? {
      targetAmountXOF: config.targetAmountXOF,
      initialAmountXOF: config.initialAmountXOF,
      monthlyContribXOF: config.monthlyContribXOF,
    } : undefined
  );

  // Distribution sectorielle
  const sectorDistribution = computeSectorDistribution(openPositions, latestPrices);

  return NextResponse.json({
    summary,
    config: config ?? null,
    sectorDistribution,
    lastUpdated: new Date().toISOString(),
  });
}

function computeSectorDistribution(
  positions: Array<{ ticker: string; totalCostXOF: number }>,
  prices: Map<string, number>
): Array<{ sector: string; valueXOF: number; pct: number }> {
  // Import dynamique car stocks peut être volumineux
  const { getStockByTicker } = require('@/lib/brvm/stocks');

  const sectorMap = new Map<string, number>();
  let total = 0;

  for (const pos of positions) {
    const meta = getStockByTicker(pos.ticker);
    const sector = meta?.sector ?? 'Autre';
    const currentPrice = prices.get(pos.ticker) ?? 0;
    // estimation valeur actuelle basée sur le coût si prix inconnu
    const value = currentPrice > 0 ? currentPrice * (pos.totalCostXOF / (pos.totalCostXOF || 1)) : pos.totalCostXOF;
    sectorMap.set(sector, (sectorMap.get(sector) ?? 0) + pos.totalCostXOF);
    total += pos.totalCostXOF;
  }

  if (total === 0) return [];

  return Array.from(sectorMap.entries())
    .map(([sector, valueXOF]) => ({
      sector,
      valueXOF: parseFloat(valueXOF.toFixed(0)),
      pct: parseFloat(((valueXOF / total) * 100).toFixed(1)),
    }))
    .sort((a, b) => b.valueXOF - a.valueXOF);
}
