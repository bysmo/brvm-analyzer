// Moteur d'analyse: scores de liquidité, fondamentaux, dynamisme, verdict global

import { BRVM_TOP_LIQUID_30, getStocksBySector, BRVM_STOCKS } from './stocks';
import { fetchMultipleStocks, getMarketListCached } from './scraper';
import type {
  StockData, LiquidityScore, FundamentalsAnalysis,
  DynamismAnalysis, ShareholderAnalysis, Verdict, StockAnalysis,
} from './types';

// === 1. SCORE DE LIQUIDITE ===

export function computeLiquidityScore(stock: StockData): LiquidityScore {
  const q = stock.quote;
  const inTopBRVM30 = BRVM_TOP_LIQUID_30.includes(stock.ticker);

  const components = {
    volumeJour: 0,
    volumeXOF: 0,
    capitalEchange: 0,
    topBRVM30: inTopBRVM30 ? 30 : 0,
  };

  const reasons: string[] = [];

  // Volume journalier en titres (max 25 pts)
  // Seuils adaptés au marché BRVM (volumes plus modestes que places internationales):
  // - > 100 000 titres/jour = très liquide (25 pts)
  // - 10 000 - 100 000 = liquide (18 pts)
  // - 1 000 - 10 000 = peu liquide (10 pts)
  // - 100 - 1 000 = très peu liquide (4 pts)
  // - < 100 = illiquide (0 pt)
  const vt = q.volumeTitres;
  if (vt >= 100000) {
    components.volumeJour = 25;
    reasons.push(`Volume jour très élevé: ${vt.toLocaleString('fr-FR')} titres`);
  } else if (vt >= 10000) {
    components.volumeJour = 18;
    reasons.push(`Volume jour correct: ${vt.toLocaleString('fr-FR')} titres`);
  } else if (vt >= 1000) {
    components.volumeJour = 10;
    reasons.push(`Volume jour modéré: ${vt.toLocaleString('fr-FR')} titres`);
  } else if (vt >= 100) {
    components.volumeJour = 4;
    reasons.push(`Volume jour faible: ${vt.toLocaleString('fr-FR')} titres`);
  } else if (vt > 0) {
    components.volumeJour = 1;
    reasons.push(`Volume jour très faible: ${vt.toLocaleString('fr-FR')} titres`);
  } else {
    components.volumeJour = 0;
    reasons.push(`Aucun échange aujourd'hui`);
  }

  // Volume en XOF (max 25 pts) - adapté BRVM
  // - > 500M XOF = très liquide (25 pts)
  // - 100M - 500M = liquide (18 pts)
  // - 20M - 100M = peu liquide (10 pts)
  // - 2M - 20M = très peu liquide (4 pts)
  // - < 2M = illiquide (1 pt)
  const vx = q.volumeXOF;
  if (vx >= 500_000_000) {
    components.volumeXOF = 25;
    reasons.push(`Volume XOF très élevé: ${Math.round(vx / 1_000_000)}M XOF`);
  } else if (vx >= 100_000_000) {
    components.volumeXOF = 18;
    reasons.push(`Volume XOF correct: ${Math.round(vx / 1_000_000)}M XOF`);
  } else if (vx >= 20_000_000) {
    components.volumeXOF = 10;
    reasons.push(`Volume XOF modéré: ${Math.round(vx / 1_000_000)}M XOF`);
  } else if (vx >= 2_000_000) {
    components.volumeXOF = 4;
    reasons.push(`Volume XOF faible: ${Math.round(vx / 1_000_000)}M XOF`);
  } else if (vx > 0) {
    components.volumeXOF = 1;
    reasons.push(`Volume XOF très faible: ${Math.round(vx / 1_000_000)}M XOF`);
  } else {
    components.volumeXOF = 0;
  }

  // Capital échangé (max 20 pts) - % du nombre total de titres
  // Adapté BRVM où la plupart des actions ont un flottant faible
  // - > 0.5% = très liquide (20 pts)
  // - 0.1% - 0.5% = liquide (15 pts)
  // - 0.02% - 0.1% = peu liquide (7 pts)
  // - < 0.02% = illiquide (1 pt)
  const ce = q.capitalEchange;
  if (ce >= 0.5) {
    components.capitalEchange = 20;
    reasons.push(`Capital échangé élevé: ${ce.toFixed(3)}%`);
  } else if (ce >= 0.1) {
    components.capitalEchange = 15;
    reasons.push(`Capital échangé correct: ${ce.toFixed(3)}%`);
  } else if (ce >= 0.02) {
    components.capitalEchange = 7;
    reasons.push(`Capital échangé modéré: ${ce.toFixed(3)}%`);
  } else if (ce > 0) {
    components.capitalEchange = 1;
    reasons.push(`Capital échangé très faible: ${ce.toFixed(3)}%`);
  }

  // Top 30 BRVM (30 pts si dans le classement officiel)
  if (inTopBRVM30) {
    reasons.push(`Présente dans le Top 30 BRVM trimestriel`);
  } else {
    reasons.push(`Absente du Top 30 BRVM trimestriel`);
  }

  const score = Math.round(
    components.volumeJour +
    components.volumeXOF +
    components.capitalEchange +
    components.topBRVM30
  );

  let level: LiquidityScore['level'];
  let color: string;
  if (score >= 70) { level = 'TRES LIQUIDE'; color = '#00D678'; }
  else if (score >= 50) { level = 'LIQUIDE'; color = '#7CFC00'; }
  else if (score >= 25) { level = 'PEU LIQUIDE'; color = '#FFA500'; }
  else { level = 'ILLIQUIDE'; color = '#FF4757'; }

  return { score, level, color, reasons, components, inTopBRVM30 };
}

// === 2. ANALYSE DES FONDAMENTAUX (5 ans) ===

function isStrictlyIncreasing(arr: number[]): boolean {
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] <= arr[i - 1]) return false;
  }
  return arr.length > 1;
}

function isMostlyIncreasing(arr: number[]): boolean {
  let up = 0, down = 0;
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] > arr[i - 1]) up++;
    else if (arr[i] < arr[i - 1]) down++;
  }
  return up >= down && up > 0;
}

function computeGrowthRate(arr: number[]): number {
  if (arr.length < 2 || arr[0] === 0) return 0;
  const first = arr[0];
  const last = arr[arr.length - 1];
  return ((last - first) / first) * 100;
}

export function computeFundamentals(stock: StockData): FundamentalsAnalysis {
  const f = stock.fundamentals;
  const details: string[] = [];

  if (f.length < 2) {
    return {
      score: 0,
      caCroissant: false,
      rnCroissant: false,
      divCroissant: false,
      caGrowth5ans: 0,
      rnGrowth5ans: 0,
      divGrowth5ans: 0,
      details: ['Données historiques insuffisantes (moins de 2 ans)'],
    };
  }

  const caArr = f.map(y => y.chiffreAffaires).filter(v => v > 0);
  const rnArr = f.map(y => y.resultatNet).filter(v => v > 0);
  const divArr = f.map(y => y.dividende).filter(v => v > 0);

  const caStrictlyUp = isStrictlyIncreasing(caArr);
  const caMostlyUp = isMostlyIncreasing(caArr);
  const rnStrictlyUp = isStrictlyIncreasing(rnArr);
  const rnMostlyUp = isMostlyIncreasing(rnArr);
  const divStrictlyUp = isStrictlyIncreasing(divArr);
  const divMostlyUp = isMostlyIncreasing(divArr);

  const caGrowth5ans = computeGrowthRate(caArr);
  const rnGrowth5ans = computeGrowthRate(rnArr);
  const divGrowth5ans = computeGrowthRate(divArr);

  let score = 0;

  // CA: jusqu'à 35 pts
  if (caStrictlyUp) {
    score += 35;
    details.push(`✓ CA strictement croissant sur ${caArr.length} ans (${caArr[0]}M → ${caArr[caArr.length-1]}M XOF, +${caGrowth5ans.toFixed(1)}%)`);
  } else if (caMostlyUp) {
    score += 22;
    details.push(`△ CA globalement croissant mais irrégulier (+${caGrowth5ans.toFixed(1)}% sur la période)`);
  } else {
    score += 5;
    details.push(`✗ CA non croissant (${caGrowth5ans.toFixed(1)}% sur la période)`);
  }

  // RN: jusqu'à 35 pts
  if (rnStrictlyUp) {
    score += 35;
    details.push(`✓ Résultat Net strictement croissant (${rnArr[0]}M → ${rnArr[rnArr.length-1]}M XOF, +${rnGrowth5ans.toFixed(1)}%)`);
  } else if (rnMostlyUp) {
    score += 22;
    details.push(`△ RN globalement croissant mais irrégulier (+${rnGrowth5ans.toFixed(1)}%)`);
  } else {
    score += 5;
    details.push(`✗ RN non croissant (${rnGrowth5ans.toFixed(1)}%)`);
  }

  // Dividendes: jusqu'à 30 pts
  if (divArr.length >= 2) {
    if (divStrictlyUp) {
      score += 30;
      details.push(`✓ Dividendes strictement croissants (${divArr[0]} → ${divArr[divArr.length-1]} XOF, +${divGrowth5ans.toFixed(1)}%)`);
    } else if (divMostlyUp) {
      score += 18;
      details.push(`△ Dividendes globalement croissants (+${divGrowth5ans.toFixed(1)}%)`);
    } else {
      score += 5;
      details.push(`✗ Dividendes non croissants (${divGrowth5ans.toFixed(1)}%)`);
    }
  } else {
    details.push(`— Données dividendes insuffisantes`);
  }

  return {
    score: Math.min(100, Math.round(score)),
    caCroissant: caStrictlyUp || caMostlyUp,
    rnCroissant: rnStrictlyUp || rnMostlyUp,
    divCroissant: divStrictlyUp || divMostlyUp,
    caGrowth5ans,
    rnGrowth5ans,
    divGrowth5ans,
    details,
  };
}

// === 3. ANALYSE DU DYNAMISME (BNPA, PER, DPA) ===

let sectorStatsCache: { timestamp: number; data: Map<string, { per: number; dpa: number; count: number }> } | null = null;
const SECTOR_TTL_MS = 60 * 60 * 1000; // 1h

async function getSectorStats(): Promise<Map<string, { per: number; dpa: number; count: number }>> {
  const now = Date.now();
  if (sectorStatsCache && (now - sectorStatsCache.timestamp) < SECTOR_TTL_MS) {
    return sectorStatsCache.data;
  }
  // Pour calculer les moyennes sectorielles, on a besoin de toutes les actions
  // Précharge: on prend les 30 actions du top BRVM qui couvrent tous les secteurs principaux
  const tickersToFetch = BRVM_STOCKS.slice(0, 15).map(s => s.ticker);
  const stocks = await fetchMultipleStocks(tickersToFetch);

  const bySector = new Map<string, { perSum: number; dpaSum: number; count: number }>();
  for (const s of stocks) {
    if (!s.fundamentals || s.fundamentals.length === 0) continue;
    const last = s.fundamentals[s.fundamentals.length - 1];
    if (last.per <= 0 && last.dividende <= 0) continue;
    const sector = s.meta.sector;
    if (!bySector.has(sector)) bySector.set(sector, { perSum: 0, dpaSum: 0, count: 0 });
    const e = bySector.get(sector)!;
    if (last.per > 0 && last.per < 200) e.perSum += last.per;
    const lastDiv = s.dividends[s.dividends.length - 1];
    if (lastDiv && lastDiv.yield > 0) e.dpaSum += lastDiv.yield;
    e.count += 1;
  }

  const result = new Map<string, { per: number; dpa: number; count: number }>();
  for (const [sector, e] of bySector.entries()) {
    result.set(sector, {
      per: e.perSum / e.count,
      dpa: e.dpaSum / e.count,
      count: e.count,
    });
  }
  sectorStatsCache = { timestamp: now, data: result };
  return result;
}

export async function computeDynamism(stock: StockData): Promise<DynamismAnalysis> {
  const details: string[] = [];
  const last = stock.fundamentals.length > 0 ? stock.fundamentals[stock.fundamentals.length - 1] : null;

  const bnpa = last?.bnpa ?? 0;
  const per = last?.per ?? 0;
  const lastDiv = stock.dividends.length > 0 ? stock.dividends[stock.dividends.length - 1] : null;
  const dpa = lastDiv?.yield ?? 0;

  const sectorStats = await getSectorStats();
  const sectorInfo = sectorStats.get(stock.meta.sector);
  const perSectoriel = sectorInfo?.per ?? null;
  const dpaSectoriel = sectorInfo?.dpa ?? null;

  let score = 0;

  // BNPA (max 25 pts) - on valorise un BNPA élevé et croissant
  if (bnpa > 0) {
    if (stock.fundamentals.length >= 2) {
      const firstBnpa = stock.fundamentals[0].bnpa;
      if (firstBnpa > 0 && bnpa > firstBnpa) {
        score += 25;
        details.push(`✓ BNPA en hausse: ${firstBnpa.toFixed(0)} → ${bnpa.toFixed(0)} XOF`);
      } else if (firstBnpa > 0 && bnpa > firstBnpa * 0.8) {
        score += 15;
        details.push(`△ BNPA stable: ${bnpa.toFixed(0)} XOF`);
      } else {
        score += 8;
        details.push(`✗ BNPA en baisse: ${firstBnpa.toFixed(0)} → ${bnpa.toFixed(0)} XOF`);
      }
    } else {
      score += 10;
      details.push(`BNPA actuel: ${bnpa.toFixed(0)} XOF`);
    }
  } else {
    details.push(`— BNPA non disponible`);
  }

  // PER (max 40 pts) - Analyse complète en 3 dimensions:
  //   1. Risque lié au niveau absolu du PER (plus élevé = plus risqué)
  //   2. Comparaison vs moyenne sectorielle (sous-cotée = solide à acheter, sur-cotée = risque)
  //   3. Tendance sur 5 ans (décroissant = bon signe, croissant = alerte)
  let perVsSecteur: DynamismAnalysis['perVsSecteur'] = 'inconnu';
  let perTrend5ans: DynamismAnalysis['perTrend5ans'] = 'inconnu';
  let perTrend5ansPct: number | null = null;
  let perRiskLevel: DynamismAnalysis['perRiskLevel'] = 'INCONNU';

  if (per > 0 && per < 200) {
    // --- 1. NIVEAU DE RISQUE BASE SUR LE PER ABSOLU ---
    // Plus le PER est élevé, plus le risque est élevé
    // Seuils adaptés au contexte BRVM:
    //   - PER < 10  → FAIBLE (très peu risqué, action bon père de famille)
    //   - PER 10-15 → MODERE (risque acceptable)
    //   - PER 15-25 → ELEVE (risque élevé, valorisation tendue)
    //   - PER > 25  → TRES ELEVE (très risqué, décrochage probable)
    let perAbsoluteScore = 0;  // sur 15
    if (per < 8) {
      perRiskLevel = 'FAIBLE';
      perAbsoluteScore = 15;
      details.push(`✓ PER ${per.toFixed(1)} très bas (risque FAIBLE) — action défensive`);
    } else if (per < 12) {
      perRiskLevel = 'FAIBLE';
      perAbsoluteScore = 13;
      details.push(`✓ PER ${per.toFixed(1)} bas (risque FAIBLE)`);
    } else if (per < 15) {
      perRiskLevel = 'MODERE';
      perAbsoluteScore = 10;
      details.push(`△ PER ${per.toFixed(1)} modéré (risque MODERE)`);
    } else if (per < 20) {
      perRiskLevel = 'ELEVE';
      perAbsoluteScore = 6;
      details.push(`⚠ PER ${per.toFixed(1)} élevé (risque ELEVE) — prudence`);
    } else if (per < 30) {
      perRiskLevel = 'TRES_ELEVE';
      perAbsoluteScore = 3;
      details.push(`⚠ PER ${per.toFixed(1)} très élevé (risque TRES ELEVE) — ne pas acheter`);
    } else {
      perRiskLevel = 'TRES_ELEVE';
      perAbsoluteScore = 0;
      details.push(`✗ PER ${per.toFixed(1)} excessif (risque TRES ELEVE) — fuir`);
    }

    // --- 2. COMPARAISON VS MOYENNE SECTORIELLE ---
    // Règle: si PER < moyenne sectorielle → action solide à conserver/acheter
    //        si PER > moyenne sectorielle → risque accru, éviter d'acheter
    let perSectorScore = 0;  // sur 15
    if (perSectoriel && perSectoriel > 0) {
      const ratio = per / perSectoriel;
      const ecartPct = ((per - perSectoriel) / perSectoriel) * 100;
      if (ratio < 0.7) {
        perSectorScore = 15;
        perVsSecteur = 'sous-cote';
        details.push(`✓ PER ${per.toFixed(1)} très sous-cotée vs secteur ${perSectoriel.toFixed(1)} (${ecartPct.toFixed(0)}% sous la moyenne) — action SOLIDE à acheter`);
      } else if (ratio < 0.9) {
        perSectorScore = 12;
        perVsSecteur = 'sous-cote';
        details.push(`✓ PER ${per.toFixed(1)} sous-cotée vs secteur ${perSectoriel.toFixed(1)} (${ecartPct.toFixed(0)}% sous la moyenne) — solide à conserver`);
      } else if (ratio < 1.1) {
        perSectorScore = 8;
        perVsSecteur = 'neutre';
        details.push(`△ PER ${per.toFixed(1)} ≈ secteur ${perSectoriel.toFixed(1)} (correctement cotée)`);
      } else if (ratio < 1.3) {
        perSectorScore = 4;
        perVsSecteur = 'sur-cote';
        details.push(`⚠ PER ${per.toFixed(1)} > secteur ${perSectoriel.toFixed(1)} (${ecartPct.toFixed(0)}% au-dessus) — sur-cotée, risque accru`);
      } else {
        perSectorScore = 0;
        perVsSecteur = 'sur-cote';
        details.push(`✗ PER ${per.toFixed(1)} très au-dessus du secteur ${perSectoriel.toFixed(1)} (+${ecartPct.toFixed(0)}%) — NE PAS ACHETER, valorisation excessive`);
      }
    } else {
      // Sans référence sectorielle, on garde le score absolu seulement
      perSectorScore = perAbsoluteScore * 0.6;
    }

    // --- 3. TENDANCE 5 ANS DU PER ---
    // Règle: PER décroissant sur 5 ans = bon signe (valorisation qui se rase, action plus abordable)
    //        PER croissant sur 5 ans = alerte (valorisation qui s'étire, risque de décrochage)
    let perTrendScore = 0;  // sur 10
    const perHistory = stock.fundamentals
      .map(f => f.per)
      .filter(p => p > 0 && p < 200);
    
    if (perHistory.length >= 2) {
      const firstPer = perHistory[0];
      const lastPer = perHistory[perHistory.length - 1];
      perTrend5ansPct = firstPer > 0 ? ((lastPer - firstPer) / firstPer) * 100 : null;
      
      // Vérifie si strictement décroissant
      let isStrictlyDecreasing = true;
      let isMostlyDecreasing = true;
      let decreaseCount = 0;
      for (let i = 1; i < perHistory.length; i++) {
        if (perHistory[i] >= perHistory[i - 1]) {
          isStrictlyDecreasing = false;
        }
        if (perHistory[i] < perHistory[i - 1]) {
          decreaseCount++;
        } else {
          isMostlyDecreasing = false;
        }
      }
      const decreaseRatio = decreaseCount / (perHistory.length - 1);
      
      if (isStrictlyDecreasing) {
        perTrend5ans = 'decroissant';
        perTrendScore = 10;
        details.push(`✓ PER strictement décroissant sur ${perHistory.length} ans (${firstPer.toFixed(1)} → ${lastPer.toFixed(1)}, ${perTrend5ansPct.toFixed(0)}%) — excellent signal d'achat`);
      } else if (decreaseRatio >= 0.7 && perTrend5ansPct < 0) {
        perTrend5ans = 'decroissant';
        perTrendScore = 8;
        details.push(`✓ PER globalement décroissant (${firstPer.toFixed(1)} → ${lastPer.toFixed(1)}, ${perTrend5ansPct.toFixed(0)}%) — bon signal`);
      } else if (Math.abs(perTrend5ansPct) < 10) {
        perTrend5ans = 'stable';
        perTrendScore = 5;
        details.push(`△ PER stable sur ${perHistory.length} ans (${firstPer.toFixed(1)} → ${lastPer.toFixed(1)})`);
      } else if (perTrend5ansPct > 0 && perTrend5ansPct < 30) {
        perTrend5ans = 'croissant';
        perTrendScore = 2;
        details.push(`⚠ PER croissant sur ${perHistory.length} ans (${firstPer.toFixed(1)} → ${lastPer.toFixed(1)}, +${perTrend5ansPct.toFixed(0)}%) — risque croissant`);
      } else {
        perTrend5ans = 'croissant';
        perTrendScore = 0;
        details.push(`✗ PER fortement croissant (${firstPer.toFixed(1)} → ${lastPer.toFixed(1)}, +${perTrend5ansPct.toFixed(0)}%) — ALERTE, ne pas acheter`);
      }
    } else {
      details.push(`— Historique PER insuffisant pour analyser la tendance`);
    }

    // Score total PER (max 40 pts): absolu (15) + sectoriel (15) + tendance (10)
    score += perAbsoluteScore + perSectorScore + perTrendScore;
  } else {
    details.push(`— PER non disponible ou non significatif (PER = ${per.toFixed(1)})`);
  }

  // DPA / Rendement (max 35 pts)
  let dpaVsSecteur: DynamismAnalysis['dpaVsSecteur'] = 'inconnu';
  if (dpa > 0) {
    if (dpaSectoriel && dpaSectoriel > 0) {
      const ratio = dpa / dpaSectoriel;
      if (ratio > 1.3) {
        score += 35;
        dpaVsSecteur = 'bon-achat';
        details.push(`✓ Rendement ${dpa.toFixed(2)}% > secteur ${dpaSectoriel.toFixed(2)}% (très bon achat)`);
      } else if (ratio > 1) {
        score += 28;
        dpaVsSecteur = 'bon-achat';
        details.push(`✓ Rendement ${dpa.toFixed(2)}% > secteur ${dpaSectoriel.toFixed(2)}% (bon achat)`);
      } else if (ratio > 0.7) {
        score += 18;
        dpaVsSecteur = 'neutre';
        details.push(`△ Rendement ${dpa.toFixed(2)}% ≈ secteur ${dpaSectoriel.toFixed(2)}%`);
      } else {
        score += 8;
        dpaVsSecteur = 'mauvais-achat';
        details.push(`✗ Rendement ${dpa.toFixed(2)}% < secteur ${dpaSectoriel.toFixed(2)}%`);
      }
    } else {
      if (dpa > 8) { score += 35; details.push(`✓ Rendement ${dpa.toFixed(2)}% très élevé`); }
      else if (dpa > 5) { score += 28; details.push(`✓ Rendement ${dpa.toFixed(2)}% élevé`); }
      else if (dpa > 3) { score += 20; details.push(`△ Rendement ${dpa.toFixed(2)}% modéré`); }
      else { score += 8; details.push(`✗ Rendement ${dpa.toFixed(2)}% faible`); }
    }
  } else {
    details.push(`— Aucun dividende distribué récemment`);
  }

  return {
    score: Math.min(100, Math.round(score)),
    bnpa, per, perSectoriel, perVsSecteur,
    perTrend5ans, perTrend5ansPct, perRiskLevel,
    dpa, dpaSectoriel, dpaVsSecteur,
    details,
  };
}

// === 4. ANALYSE DES ACTIONNAIRES (local vs étranger) ===

export function computeShareholders(stock: StockData): ShareholderAnalysis {
  const details: string[] = [];
  const shs = stock.shareholders;

  if (shs.length === 0) {
    return {
      pctLocal: 0,
      pctEtranger: 0,
      exportDevises: 'FAIBLE',
      impactDividendes: 'Données indisponibles',
      details: ['Structure actionnariale non communiquée'],
    };
  }

  // Calcule les % en pondérant les "mixte" et "inconnu"
  let local = 0;
  let etranger = 0;
  let mixte = 0;
  let inconnu = 0;

  for (const sh of shs) {
    switch (sh.type) {
      case 'local': local += sh.percentage; break;
      case 'etranger': etranger += sh.percentage; break;
      case 'mixte': mixte += sh.percentage; break;
      default: inconnu += sh.percentage; break;
    }
  }

  // On répartit le mixte 50/50 et l'inconnu proportionnellement
  const total = local + etranger + mixte + inconnu;
  let pctLocal = local;
  let pctEtranger = etranger;
  if (total > 0) {
    pctLocal += mixte * 0.5;
    pctEtranger += mixte * 0.5;
    // Inconnu: on répartit proportionnellement au reste
    if (local + etranger > 0) {
      const ratio = local / (local + etranger);
      pctLocal += inconnu * ratio;
      pctEtranger += inconnu * (1 - ratio);
    } else {
      pctLocal += inconnu * 0.5;
      pctEtranger += inconnu * 0.5;
    }
  }

  const pctLocalFinal = total > 0 ? Math.round((pctLocal / total) * 100) : 0;
  const pctEtrangerFinal = total > 0 ? Math.round((pctEtranger / total) * 100) : 0;

  let exportDevises: ShareholderAnalysis['exportDevises'];
  let impactDividendes: string;

  if (pctEtrangerFinal >= 60) {
    exportDevises = 'TRES FORT';
    impactDividendes = 'Forte exportation de devises via dividendes vers l\'étranger';
    details.push(`⚠ ${pctEtrangerFinal}% d'actionnaires étrangers → fuite importante de devises`);
  } else if (pctEtrangerFinal >= 40) {
    exportDevises = 'FORT';
    impactDividendes = 'Exportation de devises élevée via dividendes';
    details.push(`⚠ ${pctEtrangerFinal}% d'actionnaires étrangers → exportation de devises élevée`);
  } else if (pctEtrangerFinal >= 20) {
    exportDevises = 'MODERE';
    impactDividendes = 'Exportation de devises modérée';
    details.push(`△ ${pctEtrangerFinal}% d'actionnaires étrangers → exportation modérée`);
  } else {
    exportDevises = 'FAIBLE';
    impactDividendes = 'Faible exportation de devises, dividendes majoritairement locaux';
    details.push(`✓ ${pctLocalFinal}% d'actionnaires locaux → devises conservées sur le territoire`);
  }

  // Liste les principaux actionnaires
  const top = [...shs].sort((a, b) => b.percentage - a.percentage).slice(0, 3);
  for (const sh of top) {
    const tag = sh.type === 'local' ? '🇨🇮 LOCAL' :
                sh.type === 'etranger' ? '🌍 ÉTRANGER' :
                sh.type === 'mixte' ? '🔀 MIXTE' : '❓ INCONNU';
    details.push(`• ${sh.name}: ${sh.percentage}% ${tag}`);
  }

  return {
    pctLocal: pctLocalFinal,
    pctEtranger: pctEtrangerFinal,
    exportDevises,
    impactDividendes,
    details,
  };
}

// === 5. VERDIT GLOBAL ===

export function computeVerdict(
  ticker: string,
  name: string,
  liquidity: LiquidityScore,
  fundamentals: FundamentalsAnalysis,
  dynamism: DynamismAnalysis,
  shareholders: ShareholderAnalysis,
): Verdict {
  // Pondérations:
  // - Liquidité: 25% (importante pour pouvoir vendre)
  // - Fondamentaux: 35% (santé de l'entreprise)
  // - Dynamisme: 30% (opportunité d'investissement)
  // - Actionnaires: 10% (risque de fuite de devises)
  let scoreGlobal = Math.round(
    liquidity.score * 0.25 +
    fundamentals.score * 0.35 +
    dynamism.score * 0.30 +
    (100 - shareholders.pctEtranger) * 0.10
  );

  // === PÉNALITÉS SPECIALES LIEES AU PER ===
  // Règle stricte: PER très élevé = risque très élevé = ne pas acheter
  // On applique une pénalité qui peut faire chuter le score significativement
  let perPenalty = 0;
  if (dynamism.perRiskLevel === 'TRES_ELEVE') {
    perPenalty = 20;
    if (dynamism.per > 0 && dynamism.per > 30) {
      perPenalty = 25;
    }
  } else if (dynamism.perRiskLevel === 'ELEVE' && dynamism.perVsSecteur === 'sur-cote') {
    // PER élevé ET au-dessus du secteur = doublement risqué
    perPenalty = 12;
  }
  
  // Bonus pour PER bas et décroissant
  let perBonus = 0;
  if (dynamism.perRiskLevel === 'FAIBLE' && dynamism.perVsSecteur === 'sous-cote') {
    perBonus = 8;
    if (dynamism.perTrend5ans === 'decroissant') {
      perBonus = 12;  // Triple condition idéale
    }
  } else if (dynamism.perRiskLevel === 'FAIBLE' && dynamism.perTrend5ans === 'decroissant') {
    perBonus = 6;
  }
  
  scoreGlobal = Math.max(0, Math.min(100, scoreGlobal - perPenalty + perBonus));

  let recommandation: Verdict['recommandation'];
  let couleur: string;
  const justifications: string[] = [];

  // === RÈGLES DE SURCLASSEMENT LIÉES AU PER ===
  // Si PER très élevé + sur-coté vs secteur → forcer OBSERVER au mieux, VENDRE si score < 50
  const perHighRisk = dynamism.perRiskLevel === 'TRES_ELEVE' && dynamism.perVsSecteur === 'sur-cote';
  const perIncreasingHigh = dynamism.perRiskLevel === 'ELEVE' && dynamism.perTrend5ans === 'croissant';

  if (perHighRisk || perIncreasingHigh) {
    // Surclassement vers VENDRE/OBSERVER obligatoire
    if (scoreGlobal >= 55) {
      scoreGlobal = Math.min(scoreGlobal, 49);  // Plafonne à 49
    }
  }

  if (scoreGlobal >= 75) {
    recommandation = 'ACHAT';
    couleur = '#00D678';
    justifications.push(`Score global excellent (${scoreGlobal}/100)`);
  } else if (scoreGlobal >= 55) {
    recommandation = 'CONSERVER';
    couleur = '#7CFC00';
    justifications.push(`Score global correct (${scoreGlobal}/100)`);
  } else if (scoreGlobal >= 35) {
    recommandation = 'OBSERVER';
    couleur = '#FFA500';
    justifications.push(`Score global moyen (${scoreGlobal}/100), à surveiller`);
  } else {
    recommandation = 'VENDRE';
    couleur = '#FF4757';
    justifications.push(`Score global faible (${scoreGlobal}/100), risque élevé`);
  }

  if (liquidity.level === 'ILLIQUIDE' || liquidity.level === 'PEU LIQUIDE') {
    justifications.push(`Liquidité ${liquidity.level.toLowerCase()} → difficulté à vendre rapidement`);
  } else if (liquidity.level === 'TRES LIQUIDE') {
    justifications.push(`Très liquide → Facile à acheter/vendre à tout moment`);
  }

  if (fundamentals.caCroissant && fundamentals.rnCroissant) {
    justifications.push(`Fondamentaux solides: CA et RN en croissance`);
  } else if (!fundamentals.caCroissant && !fundamentals.rnCroissant) {
    justifications.push(`Fondamentaux dégradés: CA et RN en baisse`);
  }

  // === Justifications détaillées PER (priorité au signal risque) ===
  if (perHighRisk) {
    justifications.push(`✗ PER ${dynamism.per.toFixed(1)} TRÈS ÉLEVÉ et sur-coté vs secteur — NE PAS ACHETER, risque de décrochage`);
  } else if (dynamism.perRiskLevel === 'TRES_ELEVE') {
    justifications.push(`⚠ PER ${dynamism.per.toFixed(1)} très élevé (risque élevé) — éviter d'acheter`);
  } else if (dynamism.perVsSecteur === 'sur-cote') {
    justifications.push(`⚠ PER ${dynamism.per.toFixed(1)} au-dessus du secteur ${dynamism.perSectoriel?.toFixed(1)} — sur-cotée, risque accru`);
  } else if (dynamism.perRiskLevel === 'FAIBLE' && dynamism.perVsSecteur === 'sous-cote') {
    justifications.push(`✓ PER ${dynamism.per.toFixed(1)} bas et sous-coté vs secteur — action solide à acheter/conserver`);
  } else if (dynamism.perVsSecteur === 'sous-cote') {
    justifications.push(`✓ Action sous-cotée vs secteur (PER ${dynamism.per.toFixed(1)} < ${dynamism.perSectoriel?.toFixed(1)})`);
  }

  // Tendance du PER sur 5 ans
  if (dynamism.perTrend5ans === 'decroissant') {
    justifications.push(`✓ PER décroissant sur 5 ans (${dynamism.perTrend5ansPct?.toFixed(0)}%) — valorisation qui se rase, bon signal`);
  } else if (dynamism.perTrend5ans === 'croissant' && (dynamism.perTrend5ansPct ?? 0) > 20) {
    justifications.push(`✗ PER fortement croissant sur 5 ans (+${dynamism.perTrend5ansPct?.toFixed(0)}%) — risque croissant`);
  }

  if (dynamism.dpaVsSecteur === 'bon-achat') {
    justifications.push(`Rendement dividende attractif vs secteur`);
  }

  if (shareholders.exportDevises === 'TRES FORT' || shareholders.exportDevises === 'FORT') {
    justifications.push(`⚠ Forte fuite de devises via dividendes (${shareholders.pctEtranger}% étrangers)`);
  }

  return { scoreGlobal, recommandation, couleur, justifications };
}

// === ANALYSE COMPLETE ===

export async function analyzeStock(stock: StockData): Promise<StockAnalysis> {
  const liquidity = computeLiquidityScore(stock);
  const fundamentals = computeFundamentals(stock);
  const dynamism = await computeDynamism(stock);
  const shareholders = computeShareholders(stock);
  const verdict = computeVerdict(stock.ticker, stock.meta.name, liquidity, fundamentals, dynamism, shareholders);

  return {
    ticker: stock.ticker,
    name: stock.meta.name,
    liquidity,
    fundamentals,
    dynamism,
    shareholders,
    verdict,
  };
}

// === CLASSEMENTS ===

export interface RankingRow {
  ticker: string;
  name: string;
  sector: string;
  country: string;
  flag: string;
  price: number;
  variation: number;
  volumeTitres: number;
  volumeXOF: number;
  inTopBRVM30: boolean;
  liquidityScore?: number;
  liquidityLevel?: string;
  fundamentalsScore?: number;
  dynamismScore?: number;
  verdictScore?: number;
  verdict?: string;
}

export async function getRankings(): Promise<RankingRow[]> {
  const marketList = await getMarketListCached();

  const rows: RankingRow[] = marketList.map(m => {
    const stockMeta = BRVM_STOCKS.find(s => s.ticker === m.ticker);
    return {
      ticker: m.ticker,
      name: m.name,
      sector: stockMeta?.sector || '—',
      country: stockMeta?.country || '',
      flag: stockMeta?.flag || '',
      price: m.dernier,
      variation: m.variation,
      volumeTitres: m.volumeTitres,
      volumeXOF: m.volumeXOF,
      inTopBRVM30: m.inTopBRVM30,
    };
  });

  return rows;
}
