import { NextResponse } from 'next/server';
import { fetchBRVMNews } from '@/lib/brvm/news-scraper';
import { getStockByTicker } from '@/lib/brvm/stocks';
import { getUserFromRequest } from '@/lib/auth/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  // ── Auth Check ────────────────────────
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  // Vérification d'abonnement actif
  if (user.role !== 'admin' && !user.subscription?.isActive) {
    return NextResponse.json(
      { error: "Abonnement actif requis pour accéder aux actualités boursières" },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get('ticker');
  const forceRefresh = searchParams.get('refresh') === '1';

  try {
    const allNews = await fetchBRVMNews(forceRefresh);

    if (ticker) {
      const normalizedTicker = ticker.toLowerCase();
      const cleanTickerBase = normalizedTicker.split('.')[0]; // ex: "boab" ou "snts"

      // Trouver les actualités correspondantes
      const filtered = allNews.filter(item => {
        const titleLower = item.title.toLowerCase();
        const summaryLower = item.summary.toLowerCase();

        // 1. Match base ticker
        if (titleLower.includes(cleanTickerBase) || summaryLower.includes(cleanTickerBase)) {
          return true;
        }

        // 2. Match par mots-clés du nom officiel de la société
        const meta = getStockByTicker(ticker);
        if (meta) {
          const nameKeywords = meta.name.toLowerCase()
            .replace(/\b(ci|sn|bf|bj|ml|ne|tg|togo|côte d'?ivoire|bénin|sénégal|mali|niger|burkina faso|group|sa|cie)\b/g, '')
            .split(/\s+/)
            .map(k => k.trim())
            .filter(k => k.length > 2); // mots de 3 lettres et plus

          const matchesKeyword = nameKeywords.some(keyword => 
            titleLower.includes(keyword) || summaryLower.includes(keyword)
          );
          if (matchesKeyword) return true;
        }

        return false;
      });

      return NextResponse.json({ news: filtered });
    }

    return NextResponse.json({ news: allNews });
  } catch (err: any) {
    console.error('[api/brvm/news] error:', err);
    return NextResponse.json(
      { error: err?.message || 'Erreur serveur' },
      { status: 500 }
    );
  }
}
