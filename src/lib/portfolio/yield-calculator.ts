/**
 * yield-calculator.ts
 * ─────────────────────────────────────────────────────────────────────
 * Moteur de calcul financier pour le portefeuille BRVM.
 *
 * Logique :
 *  - L'utilisateur fournit son versement mensuel (PMT).
 *  - L'application calcule le rendement annuel requis pour atteindre
 *    la cible via méthode de bisection (IRR approximation).
 * ─────────────────────────────────────────────────────────────────────
 */

export interface FinancialConfig {
  targetAmountXOF: number;    // Objectif final (XOF)
  initialAmountXOF: number;   // Mise de départ (XOF)
  targetYears: number;        // Durée en années
  monthlyContribXOF: number;  // Versement mensuel choisi par l'utilisateur (XOF)
}

export interface FinancialPlan {
  monthlyContribXOF: number;  // Versement mensuel (fourni par l'utilisateur)
  yieldThresholdPct: number;  // Rendement annuel requis pour atteindre la cible (%)
  totalMonths: number;
  totalInvestment: number;    // Mise initiale + contributions totales
  gainNeeded: number;         // Gain supplémentaire nécessaire via marché
  feasible: boolean;          // true si le taux requis est réaliste (≤ 50%/an)
}

/**
 * Calcule le rendement annuel requis (IRR) pour atteindre la cible.
 *
 * L'utilisateur précise : target, initial, years ET le versement mensuel.
 * L'application résout par bisection le taux annuel `r` tel que :
 *   FV(pv=initial, pmt=monthly, n=mois, r) = target
 */
export function computeFinancialPlan(config: FinancialConfig): FinancialPlan {
  const { targetAmountXOF, initialAmountXOF, targetYears, monthlyContribXOF } = config;
  const totalMonths = targetYears * 12;

  // Épargne brute sans rendement marché
  const pureSavings = initialAmountXOF + monthlyContribXOF * totalMonths;
  const gainNeeded = Math.max(0, targetAmountXOF - pureSavings);

  // Si l'épargne pure suffit, taux requis = 0
  const requiredAnnualRate = gainNeeded === 0
    ? 0
    : findRequiredAnnualRate(initialAmountXOF, monthlyContribXOF, totalMonths, targetAmountXOF);

  const totalInvestment = initialAmountXOF + monthlyContribXOF * totalMonths;
  const feasible = requiredAnnualRate <= 50; // > 50%/an = objectif irréaliste

  return {
    monthlyContribXOF,
    yieldThresholdPct: parseFloat(Math.max(0, requiredAnnualRate).toFixed(2)),
    totalMonths,
    totalInvestment,
    gainNeeded,
    feasible,
  };
}

/**
 * Trouve le taux de rendement annuel requis par bisection.
 * FV(pv, pmt, n, r) = target → résoudre pour r.
 */
function findRequiredAnnualRate(
  pv: number,
  pmt: number,
  n: number,
  fvTarget: number
): number {
  if (pv + pmt * n >= fvTarget) return 0;

  let low = 0;
  let high = 2.0; // 200% annuel max
  let mid = 0.1;

  for (let iter = 0; iter < 200; iter++) {
    mid = (low + high) / 2;
    const fv = futureValue(pv, pmt, n, mid / 12);
    if (Math.abs(fv - fvTarget) < 1) break;
    if (fv < fvTarget) low = mid;
    else high = mid;
  }

  return mid * 100; // convertir en %
}

/**
 * Valeur future d'un investissement avec contributions régulières.
 * FV = PV*(1+r)^n + PMT*((1+r)^n - 1)/r
 */
function futureValue(pv: number, pmt: number, n: number, r: number): number {
  if (r === 0) return pv + pmt * n;
  const factor = Math.pow(1 + r, n);
  return pv * factor + pmt * (factor - 1) / r;
}

// ─── RENDEMENT D'UNE POSITION ────────────────────────────────────────────

export interface PositionYield {
  currentValueXOF: number;     // Valeur actuelle = prix_actuel × quantité
  gainXOF: number;             // Gain/perte en XOF vs prix d'entrée
  grossYieldPct: number;       // Rendement brut depuis acquisition (%)
  annualizedYieldPct: number;  // Rendement annualisé (%)
  holdingDays: number;         // Nombre de jours de détention
  holdingYears: number;        // En années (décimal)
}

/**
 * Calcule le rendement brut et annualisé d'une position ouverte.
 *
 * Gain = (prix_actuel - prix_entrée) × quantité
 * Rendement brut = (prix_actuel - prix_entrée) / prix_entrée × 100
 *
 * @param acquisitionPrice  Prix unitaire à l'achat (= prix d'entrée de position)
 * @param quantity          Nombre de titres
 * @param currentPrice      Prix unitaire actuel en cours
 * @param acquisitionDate   Date d'achat
 * @param referenceDate     Date de référence (default: aujourd'hui)
 */
export function computePositionYield(
  acquisitionPrice: number,
  quantity: number,
  currentPrice: number,
  acquisitionDate: Date,
  referenceDate: Date = new Date()
): PositionYield {
  const costXOF = acquisitionPrice * quantity;          // Coût d'entrée total
  const currentValueXOF = currentPrice * quantity;      // Valeur au cours actuel
  const gainXOF = currentValueXOF - costXOF;            // Gain = valeur actuelle - coût

  // Rendement brut = (cours_actuel - cours_entree) / cours_entree
  const grossYieldPct = acquisitionPrice > 0
    ? parseFloat(((currentPrice - acquisitionPrice) / acquisitionPrice * 100).toFixed(2))
    : 0;

  // Durée de détention
  const msPerDay = 24 * 60 * 60 * 1000;
  const holdingDays = Math.max(1,
    Math.floor((referenceDate.getTime() - acquisitionDate.getTime()) / msPerDay)
  );
  const holdingYears = holdingDays / 365.25;

  // Rendement annualisé = (1 + rendement_brut)^(1/années) - 1
  let annualizedYieldPct = 0;
  if (holdingYears > 0 && grossYieldPct > -100) {
    annualizedYieldPct = parseFloat(
      ((Math.pow(1 + grossYieldPct / 100, 1 / holdingYears) - 1) * 100).toFixed(2)
    );
  }

  return {
    currentValueXOF: parseFloat(currentValueXOF.toFixed(0)),
    gainXOF: parseFloat(gainXOF.toFixed(0)),
    grossYieldPct,
    annualizedYieldPct,
    holdingDays,
    holdingYears: parseFloat(holdingYears.toFixed(3)),
  };
}

// ─── RÉSUMÉ GLOBAL DU PORTEFEUILLE ───────────────────────────────────────

export interface PortfolioSummaryData {
  totalCostXOF: number;          // Valeur totale investie (prix entrée × qté)
  totalCurrentValueXOF: number;  // Valeur totale au cours actuel
  totalGainXOF: number;          // Gain/perte total en XOF
  totalGrossYieldPct: number;    // Rendement brut moyen pondéré (%)
  totalRealizedGainXOF: number;  // Gains réalisés (positions vendues)
  openPositionCount: number;
  soldPositionCount: number;
  progressionPct: number | null;
  estimatedMonthsToGoal: number | null;
}

export function computePortfolioSummary(
  openPositions: Array<{
    totalCostXOF: number;
    currentValueXOF: number;
  }>,
  soldPositions: Array<{
    realizedGainXOF: number | null;
  }>,
  config?: {
    targetAmountXOF: number;
    initialAmountXOF: number;
    monthlyContribXOF: number;
  }
): PortfolioSummaryData {
  const totalCostXOF = openPositions.reduce((s, p) => s + p.totalCostXOF, 0);
  const totalCurrentValueXOF = openPositions.reduce((s, p) => s + p.currentValueXOF, 0);
  const totalGainXOF = totalCurrentValueXOF - totalCostXOF;
  const totalGrossYieldPct = totalCostXOF > 0
    ? parseFloat(((totalGainXOF / totalCostXOF) * 100).toFixed(2))
    : 0;

  const totalRealizedGainXOF = soldPositions.reduce(
    (s, p) => s + (p.realizedGainXOF ?? 0), 0
  );

  let progressionPct: number | null = null;
  let estimatedMonthsToGoal: number | null = null;

  if (config) {
    const currentNetWorth = totalCurrentValueXOF + totalRealizedGainXOF + config.initialAmountXOF;
    progressionPct = parseFloat(
      Math.min(100, (currentNetWorth / config.targetAmountXOF) * 100).toFixed(1)
    );
    const remaining = config.targetAmountXOF - currentNetWorth;
    if (remaining > 0 && config.monthlyContribXOF > 0) {
      estimatedMonthsToGoal = Math.ceil(remaining / config.monthlyContribXOF);
    } else if (remaining <= 0) {
      estimatedMonthsToGoal = 0;
    }
  }

  return {
    totalCostXOF,
    totalCurrentValueXOF,
    totalGainXOF,
    totalGrossYieldPct,
    totalRealizedGainXOF,
    openPositionCount: openPositions.length,
    soldPositionCount: soldPositions.length,
    progressionPct,
    estimatedMonthsToGoal,
  };
}
