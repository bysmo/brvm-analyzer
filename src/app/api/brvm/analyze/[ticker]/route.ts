import { NextResponse } from 'next/server';
import { fetchStockData } from '@/lib/brvm/scraper';
import { analyzeStock } from '@/lib/brvm/analyzer';
import { getStockByTicker } from '@/lib/brvm/stocks';
import { getUserFromRequest } from '@/lib/auth/auth';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker: rawTicker } = await params;
  const ticker = decodeURIComponent(rawTicker).toLowerCase();
  const forceRefresh = new URL(request.url).searchParams.get('refresh') === '1';

  // ── Vérification d'authentification et d'abonnement ────────────────────────
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }
  if (user.role !== 'admin' && !user.subscription?.isActive) {
    return NextResponse.json(
      { error: 'Abonnement actif requis pour accéder à l\'analyse des actions' },
      { status: 403 }
    );
  }

  const meta = getStockByTicker(ticker);
  if (!meta) {
    return NextResponse.json(
      { error: `Ticker inconnu: ${ticker}` },
      { status: 404 }
    );
  }

  try {
    const data = await fetchStockData(meta.ticker, forceRefresh);
    if (!data) {
      return NextResponse.json(
        { error: 'Données indisponibles pour cette valeur' },
        { status: 502 }
      );
    }

    const analysis = await analyzeStock(data);

    return NextResponse.json({
      stock: data,
      analysis,
    });
  } catch (err: any) {
    console.error('[api/brvm/analyze] error:', err);
    return NextResponse.json(
      { error: err?.message || 'Erreur serveur' },
      { status: 500 }
    );
  }
}
