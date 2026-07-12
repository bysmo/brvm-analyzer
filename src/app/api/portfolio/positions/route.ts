import { NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/auth';
import { db } from '@/lib/db';
import { computePositionYield } from '@/lib/portfolio/yield-calculator';
import { getStockByTicker } from '@/lib/brvm/stocks';
import { getLatestPricesMap } from '@/lib/brvm/quotes-service';

export const dynamic = 'force-dynamic';

// GET /api/portfolio/positions — liste toutes les positions de l'utilisateur
export async function GET(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get('status'); // 'open' | 'sold' | null (tous)

  const positions = await db.portfolioPosition.findMany({
    where: {
      userId: user.id,
      ...(statusFilter ? { status: statusFilter } : {}),
    },
    orderBy: [{ status: 'asc' }, { acquisitionDate: 'desc' }],
  });

  // Charger la config pour le seuil de rendement
  const config = await db.portfolioConfig.findUnique({ where: { userId: user.id } });
  const yieldThreshold = config?.yieldThresholdPct ?? null;

  // Charger les derniers cours pour les positions ouvertes
  const tickers = [...new Set(positions.filter(p => p.status === 'open').map(p => p.ticker))];
  const latestPrices = await getLatestPricesMap(tickers);

  const enriched = positions.map(pos => {
    if (pos.status === 'sold') {
      // Position fermée : données historiques
      const realizedGainPct = pos.totalCostXOF > 0 && pos.realizedGainXOF !== null
        ? parseFloat(((pos.realizedGainXOF / pos.totalCostXOF) * 100).toFixed(2))
        : 0;
      return {
        ...pos,
        currentPrice: pos.salePrice ?? null,
        currentValueXOF: pos.saleTotalXOF ?? pos.totalCostXOF,
        grossYieldPct: realizedGainPct,
        annualizedYieldPct: null,
        gainXOF: pos.realizedGainXOF ?? 0,
        holdingDays: null,
        yieldThresholdReached: false,
        priceAvailable: pos.salePrice !== null,
      };
    }

    // Position ouverte — récupérer le cours actuel
    // Si absent, on utilise pos.acquisitionPrice en tant que fallback (évite les ND)
    const dbPrice = latestPrices.get(pos.ticker);
    const currentPrice = dbPrice ?? pos.acquisitionPrice;
    const priceAvailable = dbPrice !== undefined && dbPrice !== null;

    // Calcul du rendement : (cours_actuel - cours_entrée) / cours_entrée
    const yieldData = computePositionYield(
      pos.acquisitionPrice,
      pos.quantity,
      currentPrice,
      new Date(pos.acquisitionDate)
    );

    const yieldThresholdReached = yieldThreshold !== null && yieldData.grossYieldPct >= yieldThreshold;

    return {
      ...pos,
      currentPrice,
      currentValueXOF: yieldData.currentValueXOF,
      grossYieldPct: yieldData.grossYieldPct,
      annualizedYieldPct: yieldData.annualizedYieldPct,
      gainXOF: yieldData.gainXOF,
      holdingDays: yieldData.holdingDays,
      yieldThresholdReached,
      priceAvailable,
    };
  });

  return NextResponse.json({
    positions: enriched,
    yieldThresholdPct: yieldThreshold,
  });
}

// POST /api/portfolio/positions — ajouter une nouvelle position
export async function POST(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  let body: {
    ticker: string;
    acquisitionDate: string;
    acquisitionPrice: number;
    quantity: number;
    notes?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 });
  }

  const { ticker, acquisitionDate, acquisitionPrice, quantity, notes } = body;

  // Validations
  if (!ticker?.trim()) return NextResponse.json({ error: 'Ticker requis' }, { status: 400 });
  if (!acquisitionDate) return NextResponse.json({ error: 'Date d\'acquisition requise' }, { status: 400 });
  if (!acquisitionPrice || acquisitionPrice <= 0)
    return NextResponse.json({ error: 'Prix d\'acquisition invalide' }, { status: 400 });
  if (!quantity || quantity <= 0 || !Number.isInteger(Number(quantity)))
    return NextResponse.json({ error: 'Quantité invalide (entier > 0)' }, { status: 400 });

  const normalizedTicker = ticker.trim().toLowerCase();

  // Résoudre le nom de l'action depuis la liste BRVM
  const stockMeta = getStockByTicker(normalizedTicker);
  const name = stockMeta?.name ?? normalizedTicker.toUpperCase();

  const totalCostXOF = acquisitionPrice * Number(quantity);

  const position = await db.portfolioPosition.create({
    data: {
      userId: user.id,
      ticker: normalizedTicker,
      name,
      acquisitionDate: new Date(acquisitionDate),
      acquisitionPrice,
      quantity: Number(quantity),
      totalCostXOF,
      status: 'open',
      notes: notes?.trim() || null,
    },
  });

  return NextResponse.json({ position }, { status: 201 });
}
