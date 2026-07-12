// Types pour les données boursières BRVM

export interface QuoteData {
  ticker: string;
  name: string;
  isin: string;
  price: number;
  variation: number;        // % du jour
  volumeTitres: number;
  volumeXOF: number;
  ouverture: number;
  plusHaut: number;
  plusBas: number;
  clotureVeille: number;
  beta1an: number;
  rsi: number;
  capitalEchange: number;   // %
  valorisation: number;     // MXOF
  lastUpdate: string;
}

export interface HistoryRow {
  period: string;          // "1 semaine", "1 mois", "1er janvier", "1 an", "3 ans", "5 ans"
  plusHaut: number;
  plusBas: number;
  variation: number;       // %
}

export interface DividendRow {
  year: number;
  amount: number;
  yield: number;           // %
}

export interface Shareholder {
  name: string;
  percentage: number;
  isLocal: boolean | null; // null si indéterminé
  type: 'local' | 'etranger' | 'mixte' | 'inconnu';
}

export interface CompanyInfo {
  description: string;
  telephone: string;
  fax: string;
  adresse: string;
  dirigeants: string;
  nombreTitres: number;
  flottant: number;        // %
  valorisation: number;    // MFCFA
}

export interface FundamentalYear {
  year: number;
  chiffreAffaires: number;
  croissanceCA: number | null;
  resultatNet: number;
  croissanceRN: number | null;
  bnpa: number;
  per: number;
  dividende: number;
}

export interface StockData {
  ticker: string;
  meta: {
    name: string;
    isin: string;
    country: string;
    countryName: string;
    sector: string;
    flag: string;
  };
  quote: QuoteData;
  history: HistoryRow[];
  dividends: DividendRow[];
  shareholders: Shareholder[];
  company: CompanyInfo;
  fundamentals: FundamentalYear[];
  sentiment?: {
    achat: number;
    vente: number;
    conserver: number;
  };
  fetchedAt: string;
}

// === Scores et analyses ===

export interface LiquidityScore {
  score: number;            // 0-100
  level: 'TRES LIQUIDE' | 'LIQUIDE' | 'PEU LIQUIDE' | 'ILLIQUIDE';
  color: string;
  reasons: string[];
  components: {
    volumeJour: number;     // 0-25
    volumeXOF: number;      // 0-25
    capitalEchange: number; // 0-20
    topBRVM30: number;      // 0-30 (booléen: 0 ou 30)
  };
  inTopBRVM30: boolean;
}

export interface FundamentalsAnalysis {
  score: number;            // 0-100
  caCroissant: boolean;
  rnCroissant: boolean;
  divCroissant: boolean;
  caGrowth5ans: number;     // % total
  rnGrowth5ans: number;     // % total
  divGrowth5ans: number;    // % total
  details: string[];
}

export interface DynamismAnalysis {
  score: number;            // 0-100
  bnpa: number;
  per: number;
  perSectoriel: number | null;
  perVsSecteur: 'sous-cote' | 'sur-cote' | 'neutre' | 'inconnu';
  perTrend5ans: 'decroissant' | 'croissant' | 'stable' | 'inconnu';  // décroissant = bien
  perTrend5ansPct: number | null;  // % de variation du PER sur 5 ans (négatif = décroissant = bon)
  perRiskLevel: 'FAIBLE' | 'MODERE' | 'ELEVE' | 'TRES_ELEVE' | 'INCONNU';  // niveau de risque lié au PER
  dpa: number;              // % rendement
  dpaSectoriel: number | null;
  dpaVsSecteur: 'bon-achat' | 'mauvais-achat' | 'neutre' | 'inconnu';
  details: string[];
}

export interface ShareholderAnalysis {
  pctLocal: number;
  pctEtranger: number;
  exportDevises: 'FAIBLE' | 'MODERE' | 'FORT' | 'TRES FORT';
  impactDividendes: string;
  details: string[];
}

export interface Verdict {
  scoreGlobal: number;      // 0-100
  recommandation: 'ACHAT' | 'CONSERVER' | 'VENDRE' | 'OBSERVER';
  couleur: string;
  justifications: string[];
}

export interface StockAnalysis {
  ticker: string;
  name: string;
  liquidity: LiquidityScore;
  fundamentals: FundamentalsAnalysis;
  dynamism: DynamismAnalysis;
  shareholders: ShareholderAnalysis;
  verdict: Verdict;
}
