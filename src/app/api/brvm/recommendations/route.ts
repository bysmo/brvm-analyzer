import { NextResponse } from 'next/server';
import { fetchMultipleStocks, getMarketListCached } from '@/lib/brvm/scraper';
import { BRVM_TOP_LIQUID_30, BRVM_STOCKS, getStockByTicker } from '@/lib/brvm/stocks';
import { analyzeStock } from '@/lib/brvm/analyzer';
import { getUserFromRequest } from '@/lib/auth/auth';
import type { StockAnalysis } from '@/lib/brvm/types';

export const dynamic = 'force-dynamic';
export const revalidate = 1800; // 30 min

// Cache en mémoire (TTL 30 min) car l'analyse de 30 actions prend du temps
let recommendationsCache: { data: RecommendationData | null; timestamp: number } = { data: null, timestamp: 0 };
const CACHE_TTL_MS = 30 * 60 * 1000;

export interface RecommendationItem {
  ticker: string;
  name: string;
  flag: string;
  country: string;
  countryName: string;
  sector: string;
  price: number;
  variation: number;
  verdictScore: number;
  recommandation: 'ACHAT' | 'CONSERVER' | 'VENDRE' | 'OBSERVER';
  verdictColor: string;
  liquidityScore: number;
  liquidityLevel: string;
  fundamentalsScore: number;
  dynamismScore: number;
  per: number;
  perRiskLevel: string;
  perVsSecteur: string;
  dpa: number;
  pctEtranger: number;
  topReasons: string[];  // top 3 justifications
}

export interface RecommendationData {
  topBuys: RecommendationItem[];      // top 5 à acheter
  topSells: RecommendationItem[];     // top 5 à vendre
  bestOpportunities: RecommendationItem[]; // 5 opportunités (ACHAT ou CONSERVER avec score élevé)
  stats: {
    totalAnalyzed: number;
    achat: number;
    conserver: number;
    observer: number;
    vendre: number;
  };
  fetchedAt: string;
}

export async function GET(request: Request) {
  // ── Vérification d'authentification et d'abonnement ────────────────────────
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }
  if (user.role !== 'admin' && !user.subscription?.isActive) {
    return NextResponse.json(
      { error: 'Abonnement actif requis pour accéder aux recommandations' },
      { status: 403 }
    );
  }

  const now = Date.now();
  if (recommendationsCache.data && (now - recommendationsCache.timestamp) < CACHE_TTL_MS) {
    return NextResponse.json(recommendationsCache.data);
  }

  try {
    // Récupère les cours du jour pour tous les tickers
    const marketList = await getMarketListCached();

    // Sélectionne les actions à analyser: Top 30 BRVM + celles qui ont un volume significatif aujourd'hui
    const topTickers = BRVM_TOP_LIQUID_30.filter(t => getStockByTicker(t));
    
    // Ajoute les 5 actions les plus échangées aujourd'hui (au cas où elles ne seraient pas dans le Top 30)
    const sortedByVolume = [...marketList].sort((a, b) => b.volumeXOF - a.volumeXOF);
    for (const m of sortedByVolume.slice(0, 10)) {
      if (!topTickers.includes(m.ticker) && getStockByTicker(m.ticker)) {
        topTickers.push(m.ticker);
      }
    }
    
    // Limite à 35 actions pour garder un temps de réponse raisonnable
    const tickersToAnalyze = topTickers.slice(0, 35);

    console.log(`[recommendations] Analyzing ${tickersToAnalyze.length} stocks...`);

    // Récupère les données fondamentales de toutes ces actions
    const stocks = await fetchMultipleStocks(tickersToAnalyze);

    // Analyse chaque action
    const analyses: { ticker: string; analysis: StockAnalysis; price: number; variation: number }[] = [];
    for (const stock of stocks) {
      try {
        const analysis = await analyzeStock(stock);
        const marketEntry = marketList.find(m => m.ticker === stock.ticker);
        analyses.push({
          ticker: stock.ticker,
          analysis,
          price: marketEntry?.dernier ?? stock.quote.price,
          variation: marketEntry?.variation ?? stock.quote.variation,
        });
      } catch (err) {
        console.error(`[recommendations] Failed to analyze ${stock.ticker}:`, err);
      }
    }

    console.log(`[recommendations] Successfully analyzed ${analyses.length} stocks`);

    // Construit la liste des items
    const items: RecommendationItem[] = analyses.map(({ ticker, analysis, price, variation }) => {
      const meta = getStockByTicker(ticker)!;
      const topReasons = analysis.verdict.justifications.slice(0, 3);
      return {
        ticker,
        name: meta.name,
        flag: meta.flag,
        country: meta.country,
        countryName: meta.countryName,
        sector: meta.sector,
        price,
        variation,
        verdictScore: analysis.verdict.scoreGlobal,
        recommandation: analysis.verdict.recommandation,
        verdictColor: analysis.verdict.couleur,
        liquidityScore: analysis.liquidity.score,
        liquidityLevel: analysis.liquidity.level,
        fundamentalsScore: analysis.fundamentals.score,
        dynamismScore: analysis.dynamism.score,
        per: analysis.dynamism.per,
        perRiskLevel: analysis.dynamism.perRiskLevel,
        perVsSecteur: analysis.dynamism.perVsSecteur,
        dpa: analysis.dynamism.dpa,
        pctEtranger: analysis.shareholders.pctEtranger,
        topReasons,
      };
    });

    // === TOP ACHATS ===
    // Tri: ACHAT d'abord, puis par score décroissant
    const topBuys = items
      .filter(i => i.recommandation === 'ACHAT' || i.recommandation === 'CONSERVER')
      .sort((a, b) => {
        // ACHAT d'abord
        if (a.recommandation === 'ACHAT' && b.recommandation !== 'ACHAT') return -1;
        if (a.recommandation !== 'ACHAT' && b.recommandation === 'ACHAT') return 1;
        // Puis par score
        return b.verdictScore - a.verdictScore;
      })
      .slice(0, 5);

    // === TOP VENTES ===
    // Tri: VENDRE d'abord, puis OBSERVER, par score croissant (les plus faibles d'abord)
    const topSells = items
      .filter(i => i.recommandation === 'VENDRE' || i.recommandation === 'OBSERVER')
      .sort((a, b) => {
        // VENDRE d'abord
        if (a.recommandation === 'VENDRE' && b.recommandation !== 'VENDRE') return -1;
        if (a.recommandation !== 'VENDRE' && b.recommandation === 'VENDRE') return 1;
        // Puis par score croissant (les pires d'abord)
        return a.verdictScore - b.verdictScore;
      })
      .slice(0, 5);

    // === MEILLEURES OPPORTUNITÉS (variété) ===
    // On prend des actions avec PER bas + DPA élevé + bonnes fondamentaux,
    // indépendamment du verdict global, pour mettre en évidence des opportunités
    const bestOpportunities = items
      .filter(i => i.per > 0 && i.per < 20 && i.perVsSecteur === 'sous-cote')
      .sort((a, b) => {
        // Score composite: PER bas + DPA élevé + fondamentaux
        const scoreA = (20 - a.per) + (a.dpa * 2) + (a.fundamentalsScore / 10);
        const scoreB = (20 - b.per) + (b.dpa * 2) + (b.fundamentalsScore / 10);
        return scoreB - scoreA;
      })
      .slice(0, 5);

    // Stats
    const stats = {
      totalAnalyzed: items.length,
      achat: items.filter(i => i.recommandation === 'ACHAT').length,
      conserver: items.filter(i => i.recommandation === 'CONSERVER').length,
      observer: items.filter(i => i.recommandation === 'OBSERVER').length,
      vendre: items.filter(i => i.recommandation === 'VENDRE').length,
    };

    const data: RecommendationData = {
      topBuys,
      topSells,
      bestOpportunities,
      stats,
      fetchedAt: new Date().toISOString(),
    };

    recommendationsCache = { data, timestamp: now };

    return NextResponse.json(data);
  } catch (err: any) {
    console.error('[recommendations] error:', err);
    return NextResponse.json(
      { error: err?.message || 'Erreur serveur' },
      { status: 500 }
    );
  }
}
