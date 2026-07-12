import { NextResponse } from 'next/server';
import { fetchStockData } from '@/lib/brvm/scraper';
import { analyzeStock } from '@/lib/brvm/analyzer';
import { getStockByTicker } from '@/lib/brvm/stocks';
import { getUserFromRequest } from '@/lib/auth/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  // ── Vérification d'authentification et d'abonnement ────────────────────────
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }
  if (user.role !== 'admin' && !user.subscription?.isActive) {
    return NextResponse.json(
      { error: 'Abonnement actif requis pour comparer des actions' },
      { status: 403 }
    );
  }

  let body: { tickers?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide (JSON attendu)' }, { status: 400 });
  }

  const tickers = (body.tickers || []).slice(0, 4);
  if (tickers.length === 0) {
    return NextResponse.json({ error: 'Aucun ticker fourni' }, { status: 400 });
  }

  try {
    const results = await Promise.all(
      tickers.map(async (t) => {
        const meta = getStockByTicker(t);
        if (!meta) return null;
        const data = await fetchStockData(meta.ticker);
        if (!data) return null;
        const analysis = await analyzeStock(data);
        return { stock: data, analysis };
      })
    );
    const valid = results.filter(Boolean);
    return NextResponse.json({ results: valid });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Erreur serveur' },
      { status: 500 }
    );
  }
}
