import { NextResponse } from 'next/server';
import { fetchMarketList } from '@/lib/brvm/scraper';
import { BRVM_STOCKS, BRVM_TOP_LIQUID_30 } from '@/lib/brvm/stocks';
import { getUserFromRequest } from '@/lib/auth/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 1800; // 30 min

export async function GET(request: Request) {
  // ── Vérification d'authentification et d'abonnement ────────────────────────
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }
  if (user.role !== 'admin' && !user.subscription?.isActive) {
    return NextResponse.json(
      { error: 'Abonnement actif requis pour accéder au palmarès' },
      { status: 403 }
    );
  }

  try {
    const marketList = await fetchMarketList();
    const rows = marketList.map(m => {
      const meta = BRVM_STOCKS.find(s => s.ticker === m.ticker);
      return {
        ticker: m.ticker,
        name: m.name,
        sector: meta?.sector || '—',
        country: meta?.country || '',
        countryName: meta?.countryName || '',
        flag: meta?.flag || '',
        price: m.dernier,
        variation: m.variation,
        ouverture: m.ouverture,
        plusHaut: m.plusHaut,
        plusBas: m.plusBas,
        volumeTitres: m.volumeTitres,
        volumeXOF: m.volumeXOF,
        inTopBRVM30: m.inTopBRVM30,
      };
    });
    return NextResponse.json({
      rows,
      total: rows.length,
      topLiquid30: BRVM_TOP_LIQUID_30,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Erreur lors de la récupération du palmarès' },
      { status: 500 }
    );
  }
}
