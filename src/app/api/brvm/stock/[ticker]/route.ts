import { NextResponse } from 'next/server';
import { fetchStockData } from '@/lib/brvm/scraper';
import { getStockByTicker } from '@/lib/brvm/stocks';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker: rawTicker } = await params;
  const ticker = decodeURIComponent(rawTicker).toLowerCase();

  const meta = getStockByTicker(ticker);
  if (!meta) {
    return NextResponse.json(
      { error: `Ticker inconnu: ${ticker}` },
      { status: 404 }
    );
  }

  try {
    const data = await fetchStockData(meta.ticker);
    if (!data) {
      return NextResponse.json(
        { error: 'Données indisponibles pour cette valeur' },
        { status: 502 }
      );
    }
    return NextResponse.json(data);
  } catch (err: any) {
    console.error('[api/brvm/stock] error:', err);
    return NextResponse.json(
      { error: err?.message || 'Erreur serveur' },
      { status: 500 }
    );
  }
}
