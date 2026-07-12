'use client';

import { useEffect, useState } from 'react';
import {
  TrendingUp, TrendingDown, Droplet, Users, Activity, Award,
  RefreshCw, AlertTriangle, CheckCircle2, XCircle, MinusCircle,
  ArrowUpRight, ArrowDownRight, Globe, Building2,
} from 'lucide-react';
import { StockSelector } from './StockSelector';
import { ScoreGauge } from './ScoreGauge';
import { MiniLineChart } from './MiniLineChart';
import { DonutChart } from './DonutChart';
import { BarChart } from './BarChart';
import { SectorComparisonTable } from './SectorComparisonTable';

interface StockMeta {
  ticker: string;
  name: string;
  isin: string;
  country: string;
  countryName: string;
  sector: string;
  flag: string;
  inTopBRVM30: boolean;
}

interface QuoteData {
  price: number;
  variation: number;
  volumeTitres: number;
  volumeXOF: number;
  ouverture: number;
  plusHaut: number;
  plusBas: number;
  clotureVeille: number;
  valorisation: number;
  capitalEchange: number;
  lastUpdate: string;
}

interface DividendRow { year: number; amount: number; yield: number; }
interface HistoryRow { period: string; plusHaut: number; plusBas: number; variation: number; }

interface Shareholder {
  name: string;
  percentage: number;
  type: 'local' | 'etranger' | 'mixte' | 'inconnu';
}

interface FundamentalYear {
  year: number;
  chiffreAffaires: number;
  croissanceCA: number | null;
  resultatNet: number;
  croissanceRN: number | null;
  bnpa: number;
  per: number;
  dividende: number;
}

interface StockData {
  ticker: string;
  meta: StockMeta;
  quote: QuoteData;
  history: HistoryRow[];
  dividends: DividendRow[];
  shareholders: Shareholder[];
  company: {
    description: string;
    telephone: string;
    fax: string;
    adresse: string;
    dirigeants: string;
    nombreTitres: number;
    flottant: number;
    valorisation: number;
  };
  fundamentals: FundamentalYear[];
  fetchedAt: string;
}

interface LiquidityScore {
  score: number;
  level: string;
  color: string;
  reasons: string[];
  components: { volumeJour: number; volumeXOF: number; capitalEchange: number; topBRVM30: number };
  inTopBRVM30: boolean;
}

interface FundamentalsAnalysis {
  score: number;
  caCroissant: boolean;
  rnCroissant: boolean;
  divCroissant: boolean;
  caGrowth5ans: number;
  rnGrowth5ans: number;
  divGrowth5ans: number;
  details: string[];
}

interface DynamismAnalysis {
  score: number;
  bnpa: number;
  per: number;
  perSectoriel: number | null;
  perVsSecteur: 'sous-cote' | 'sur-cote' | 'neutre' | 'inconnu';
  perTrend5ans: 'decroissant' | 'croissant' | 'stable' | 'inconnu';
  perTrend5ansPct: number | null;
  perRiskLevel: 'FAIBLE' | 'MODERE' | 'ELEVE' | 'TRES_ELEVE' | 'INCONNU';
  dpa: number;
  dpaSectoriel: number | null;
  dpaVsSecteur: 'bon-achat' | 'mauvais-achat' | 'neutre' | 'inconnu';
  details: string[];
}

interface ShareholderAnalysis {
  pctLocal: number;
  pctEtranger: number;
  exportDevises: string;
  impactDividendes: string;
  details: string[];
}

interface Verdict {
  scoreGlobal: number;
  recommandation: string;
  couleur: string;
  justifications: string[];
}

interface Analysis {
  ticker: string;
  name: string;
  liquidity: LiquidityScore;
  fundamentals: FundamentalsAnalysis;
  dynamism: DynamismAnalysis;
  shareholders: ShareholderAnalysis;
  verdict: Verdict;
}

interface Props {
  stocks: StockMeta[];
  initialTicker?: string;
}

function fmtNum(n: number, opts: Intl.NumberFormatOptions = {}): string {
  if (!n || isNaN(n)) return '—';
  return n.toLocaleString('fr-FR', { maximumFractionDigits: 2, ...opts });
}

function fmtXOF(n: number): string {
  if (!n || isNaN(n)) return '—';
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)} Md`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)} k`;
  return n.toFixed(0);
}

export function StockDashboard({ stocks, initialTicker }: Props) {
  const [ticker, setTicker] = useState(initialTicker || 'BOAB.bj');
  const [state, setState] = useState<{
    data: { stock: StockData; analysis: Analysis } | null;
    loading: boolean;
    error: string | null;
  }>({ data: null, loading: true, error: null });

  useEffect(() => {
    const controller = new AbortController();
    
    async function load() {
      setState(prev => ({ ...prev, loading: true, error: null, data: null }));
      
      try {
        const res = await fetch(`/api/brvm/analyze/${encodeURIComponent(ticker)}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const d = await res.json();
        if (d.error) throw new Error(d.error);
        setState({ data: d, loading: false, error: null });
      } catch (e: any) {
        if (e.name === 'AbortError') return;
        setState(prev => ({ ...prev, loading: false, error: e.message }));
      }
    }
    
    load();
    
    return () => controller.abort();
  }, [ticker]);

  const handleRefresh = async () => {
    setState(prev => ({ ...prev, loading: true }));
    try {
      const res = await fetch(`/api/brvm/analyze/${encodeURIComponent(ticker)}?refresh=1`);
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      setState({ data: d, loading: false, error: null });
    } catch (e: any) {
      setState(prev => ({ ...prev, loading: false, error: e.message }));
    }
  };

  const { data, loading, error } = state;

  return (
    <div className="space-y-4">
      {/* Sélecteur */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[300px]">
          <StockSelector
            stocks={stocks}
            value={ticker}
            onChange={setTicker}
          />
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="px-4 py-2.5 bg-brvm-card border border-brvm-border hover:border-brvm-accent rounded-md flex items-center gap-2 text-sm text-brvm-fg-muted hover:text-brvm-fg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="space-y-4">
          <div className="brvm-card rounded-lg p-6 shimmer h-32" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="brvm-card rounded-lg p-4 shimmer h-48" />
            ))}
          </div>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="brvm-card rounded-lg p-6 border-l-4 border-brvm-danger">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-brvm-danger" />
            <div>
              <div className="font-semibold text-brvm-fg">Erreur de chargement</div>
              <div className="text-sm text-brvm-fg-muted">{error}</div>
            </div>
          </div>
        </div>
      )}

      {/* Dashboard */}
      {data && !loading && (
        <DashboardContent stock={data.stock} analysis={data.analysis} />
      )}
    </div>
  );
}

function DashboardContent({ stock, analysis }: { stock: StockData; analysis: Analysis }) {
  const q = stock.quote;
  const variationPositive = q.variation >= 0;
  
  return (
    <div className="space-y-4">
      {/* Header: prix + verdict */}
      <div className="brvm-card rounded-lg p-5">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex-1 min-w-[250px]">
            <div className="flex items-center gap-3 mb-1">
              <span className="text-3xl">{stock.meta.flag}</span>
              <div>
                <h1 className="text-xl font-bold text-brvm-fg">{stock.meta.name}</h1>
                <div className="flex items-center gap-2 text-xs text-brvm-fg-muted">
                  <span className="font-mono">{stock.meta.isin}</span>
                  <span>•</span>
                  <span className="font-mono">{stock.ticker}</span>
                  <span>•</span>
                  <span>{stock.meta.countryName}</span>
                  <span>•</span>
                  <span>{stock.meta.sector}</span>
                </div>
              </div>
            </div>
            <div className="flex items-baseline gap-3 mt-3">
              <span className="text-4xl font-bold font-mono text-brvm-fg">
                {fmtNum(q.price)} <span className="text-base text-brvm-fg-muted">XOF</span>
              </span>
              <span className={`flex items-center gap-1 text-lg font-mono ${variationPositive ? 'text-brvm-up' : 'text-brvm-down'}`}>
                {variationPositive ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                {variationPositive ? '+' : ''}{q.variation.toFixed(2)}%
              </span>
            </div>
            <div className="text-xs text-brvm-fg-dim mt-1">
              Dernière mise à jour: {new Date(q.lastUpdate).toLocaleString('fr-FR')}
              {stock.company.nombreTitres > 0 && (
                <> • {fmtNum(stock.company.nombreTitres)} titres • Flottant {stock.company.flottant.toFixed(2)}%</>
              )}
            </div>
          </div>
          
          {/* Verdict */}
          <div className="flex items-center gap-4 px-5 py-3 rounded-lg" style={{ backgroundColor: `${analysis.verdict.couleur}15`, border: `1px solid ${analysis.verdict.couleur}40` }}>
            <ScoreGauge score={analysis.verdict.scoreGlobal} label="Score Global" size="md" color={analysis.verdict.couleur} />
            <div>
              <div className="text-xs text-brvm-fg-muted uppercase tracking-wider">Recommandation</div>
              <div className="text-2xl font-bold" style={{ color: analysis.verdict.couleur }}>
                {analysis.verdict.recommandation}
              </div>
            </div>
          </div>
        </div>
        
        {/* Justifications */}
        {analysis.verdict.justifications.length > 0 && (
          <div className="mt-4 pt-4 border-t border-brvm-border">
            <div className="text-xs text-brvm-fg-muted uppercase tracking-wider mb-2">Justifications du verdict</div>
            <div className="flex flex-wrap gap-2">
              {analysis.verdict.justifications.map((j, i) => (
                <span
                  key={i}
                  className="text-xs px-2.5 py-1 bg-brvm-bg-soft rounded text-brvm-fg-muted border border-brvm-border leading-relaxed"
                  title={j}
                >
                  {j}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 4 cartes scores */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Liquidité */}
        <ScoreCard
          title="Liquidité"
          score={analysis.liquidity.score}
          color={analysis.liquidity.color}
          level={analysis.liquidity.level}
          icon={<Droplet className="w-5 h-5" />}
          reasons={analysis.liquidity.reasons}
          components={[
            { label: 'Vol. jour', value: analysis.liquidity.components.volumeJour, max: 25 },
            { label: 'Vol. XOF', value: analysis.liquidity.components.volumeXOF, max: 25 },
            { label: 'Capital échangé', value: analysis.liquidity.components.capitalEchange, max: 20 },
            { label: 'Top 30 BRVM', value: analysis.liquidity.components.topBRVM30, max: 30 },
          ]}
        />
        
        {/* Fondamentaux */}
        <ScoreCard
          title="Fondamentaux 5 ans"
          score={analysis.fundamentals.score}
          color={analysis.fundamentals.score >= 70 ? '#00D678' : analysis.fundamentals.score >= 50 ? '#7CFC00' : analysis.fundamentals.score >= 30 ? '#FFA500' : '#FF4757'}
          level={analysis.fundamentals.score >= 70 ? 'SOLIDE' : analysis.fundamentals.score >= 50 ? 'CORRECT' : analysis.fundamentals.score >= 30 ? 'FRAGILE' : 'DÉFAVORABLE'}
          icon={<Activity className="w-5 h-5" />}
          reasons={analysis.fundamentals.details}
          components={[
            { label: 'CA', value: analysis.fundamentals.caCroissant ? 35 : 5, max: 35 },
            { label: 'Résultat net', value: analysis.fundamentals.rnCroissant ? 35 : 5, max: 35 },
            { label: 'Dividendes', value: analysis.fundamentals.divCroissant ? 30 : 5, max: 30 },
          ]}
        />
        
        {/* Dynamisme */}
        <ScoreCard
          title="Dynamisme"
          score={analysis.dynamism.score}
          color={analysis.dynamism.score >= 70 ? '#00D678' : analysis.dynamism.score >= 50 ? '#7CFC00' : analysis.dynamism.score >= 30 ? '#FFA500' : '#FF4757'}
          level={analysis.dynamism.score >= 70 ? 'DYNAMIQUE' : analysis.dynamism.score >= 50 ? 'ACCEPTABLE' : analysis.dynamism.score >= 30 ? 'MOYEN' : 'FAIBLE'}
          icon={<TrendingUp className="w-5 h-5" />}
          reasons={analysis.dynamism.details}
          components={[
            { label: 'BNPA', value: analysis.dynamism.score >= 25 ? 25 : Math.round(analysis.dynamism.score / 4), max: 25 },
            { label: 'PER', value: analysis.dynamism.score >= 40 ? 40 : Math.round(analysis.dynamism.score / 2), max: 40 },
            { label: 'DPA', value: analysis.dynamism.score >= 35 ? 35 : Math.round(analysis.dynamism.score / 3), max: 35 },
          ]}
        />
        
        {/* Actionnaires */}
        <ScoreCard
          title="Actionnaires"
          score={Math.round(100 - analysis.shareholders.pctEtranger)}
          color={analysis.shareholders.pctEtranger >= 60 ? '#FF4757' : analysis.shareholders.pctEtranger >= 40 ? '#FFA500' : analysis.shareholders.pctEtranger >= 20 ? '#7CFC00' : '#00D678'}
          level={analysis.shareholders.exportDevises}
          icon={<Users className="w-5 h-5" />}
          reasons={analysis.shareholders.details}
          components={[
            { label: 'Locaux', value: analysis.shareholders.pctLocal, max: 100, color: '#00D678' },
            { label: 'Étrangers', value: analysis.shareholders.pctEtranger, max: 100, color: '#FF4757' },
          ]}
        />
      </div>

      {/* Cours & volumes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="brvm-card rounded-lg p-4 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-brvm-fg uppercase tracking-wider">Cours & Volumes</h3>
            <span className="text-xs text-brvm-fg-dim">Source: sikafinance.com</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Ouverture" value={fmtNum(q.ouverture)} />
            <Stat label="Plus haut" value={fmtNum(q.plusHaut)} positive />
            <Stat label="Plus bas" value={fmtNum(q.plusBas)} negative />
            <Stat label="Clôture veille" value={fmtNum(q.clotureVeille)} />
            <Stat label="Volume (titres)" value={fmtNum(q.volumeTitres)} />
            <Stat label="Volume (XOF)" value={fmtXOF(q.volumeXOF)} />
            <Stat label="Capital échangé" value={`${q.capitalEchange.toFixed(3)}%`} />
            <Stat label="Valorisation" value={fmtXOF(q.valorisation * 1_000_000)} suffix="XOF" />
          </div>
        </div>

        {/* Actionnaires donut */}
        <div className="brvm-card rounded-lg p-4">
          <h3 className="text-sm font-semibold text-brvm-fg uppercase tracking-wider mb-3">Structure actionnariale</h3>
          {stock.shareholders.length > 0 ? (
            <DonutChart
              data={stock.shareholders.map((sh, i) => ({
                name: sh.name,
                value: sh.percentage,
                color: sh.type === 'local' ? '#00D678' : sh.type === 'etranger' ? '#FF4757' : sh.type === 'mixte' ? '#FFA500' : '#5C6789',
              }))}
              centerValue={`${analysis.shareholders.pctLocal}%`}
              centerLabel="Local"
              size={150}
            />
          ) : (
            <div className="text-sm text-brvm-fg-muted py-8 text-center">Données indisponibles</div>
          )}
        </div>
      </div>

      {/* Fondamentaux 5 ans */}
      <div className="brvm-card rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-brvm-fg uppercase tracking-wider">Chiffres fondamentaux 5 ans (millions XOF)</h3>
          <div className="flex gap-2">
            <TrendBadge up={analysis.fundamentals.caCroissant} label="CA" />
            <TrendBadge up={analysis.fundamentals.rnCroissant} label="RN" />
            <TrendBadge up={analysis.fundamentals.divCroissant} label="Div" />
          </div>
        </div>
        
        {stock.fundamentals.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="brvm-table w-full text-right">
                <thead>
                  <tr className="border-b border-brvm-border">
                    <th className="text-left py-2 px-2">Indicateur</th>
                    {stock.fundamentals.map(f => (
                      <th key={f.year} className="py-2 px-2">{f.year}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <FundRow label="Chiffre d'affaires" data={stock.fundamentals.map(f => f.chiffreAffaires)} growthData={stock.fundamentals.map(f => f.croissanceCA)} />
                  <FundRow label="Résultat net" data={stock.fundamentals.map(f => f.resultatNet)} growthData={stock.fundamentals.map(f => f.croissanceRN)} />
                  <FundRow label="BNPA (XOF)" data={stock.fundamentals.map(f => f.bnpa)} />
                  <FundRow label="PER" data={stock.fundamentals.map(f => f.per)} />
                  <FundRow label="Dividende (XOF)" data={stock.fundamentals.map(f => f.dividende)} />
                </tbody>
              </table>
            </div>
            
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-brvm-fg-muted mb-2 uppercase tracking-wider">Évolution CA & RN</div>
                <MiniLineChart data={stock.fundamentals} series={['ca', 'rn']} height={180} />
              </div>
              <div>
                <div className="text-xs text-brvm-fg-muted mb-2 uppercase tracking-wider">Dividende & BNPA</div>
                <MiniLineChart data={stock.fundamentals} series={['div', 'bnpa']} height={180} />
              </div>
            </div>
          </>
        ) : (
          <div className="text-sm text-brvm-fg-muted py-8 text-center">Données fondamentales indisponibles</div>
        )}
      </div>

      {/* Comparaison sectorielle BNPA / PER / Dividende */}
      <SectorComparisonTable ticker={stock.ticker} sector={stock.meta.sector} />

      {/* Dynamisme: BNPA / PER / DPA */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <DynamismCard
          title="BNPA"
          subtitle="Bénéfice Net Par Action"
          value={analysis.dynamism.bnpa > 0 ? `${analysis.dynamism.bnpa.toFixed(2)} XOF` : '—'}
          hint="Résultat Net / Nombre d'actions"
          color="#B47CFF"
          icon={<Award className="w-5 h-5" />}
        />
        <PerDynamismCard
          per={analysis.dynamism.per}
          perSectoriel={analysis.dynamism.perSectoriel}
          perVsSecteur={analysis.dynamism.perVsSecteur}
          perTrend5ans={analysis.dynamism.perTrend5ans}
          perTrend5ansPct={analysis.dynamism.perTrend5ansPct}
          perRiskLevel={analysis.dynamism.perRiskLevel}
        />
        <DynamismCard
          title="DPA"
          subtitle="Rendement Dividende"
          value={analysis.dynamism.dpa > 0 ? `${analysis.dynamism.dpa.toFixed(2)}%` : '—'}
          hint={analysis.dynamism.dpaSectoriel ? `Secteur: ${analysis.dynamism.dpaSectoriel.toFixed(2)}%` : 'Pas de référence sectorielle'}
          status={analysis.dynamism.dpaVsSecteur}
          statusLabels={{ 'bon-achat': 'BON ACHAT ✓', 'mauvais-achat': 'MAUVAIS ACHAT ✗', 'neutre': 'NEUTRE', 'inconnu': 'N/A' }}
          color="#FFA500"
          icon={<Droplet className="w-5 h-5" />}
        />
      </div>

      {/* Dividendes historiques */}
      {stock.dividends.length > 0 && (
        <div className="brvm-card rounded-lg p-4">
          <h3 className="text-sm font-semibold text-brvm-fg uppercase tracking-wider mb-3">Dividendes distribués (5 dernières années)</h3>
          <div className="overflow-x-auto">
            <table className="brvm-table w-full text-right">
              <thead>
                <tr className="border-b border-brvm-border">
                  <th className="text-left py-2 px-2">Année</th>
                  {stock.dividends.map(d => (
                    <th key={d.year} className="py-2 px-2">{d.year}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-brvm-border/50">
                  <td className="py-2 px-2 text-left text-brvm-fg-muted">Montant (XOF)</td>
                  {stock.dividends.map(d => (
                    <td key={d.year} className="py-2 px-2 font-mono text-brvm-fg">{d.amount.toFixed(2)}</td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2 px-2 text-left text-brvm-fg-muted">Rendement (%)</td>
                  {stock.dividends.map(d => (
                    <td key={d.year} className="py-2 px-2 font-mono text-brvm-accent">{d.yield.toFixed(2)}%</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <div className="mt-2 text-xs text-brvm-fg-dim">
            Note: Le rendement est calculé sur la base du cours actuel ({fmtNum(q.price)} XOF).
          </div>
        </div>
      )}

      {/* Infos société */}
      <div className="brvm-card rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Building2 className="w-4 h-4 text-brvm-fg-muted" />
          <h3 className="text-sm font-semibold text-brvm-fg uppercase tracking-wider">Profil société</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-xs text-brvm-fg-muted uppercase tracking-wider mb-1">Description</div>
            <p className="text-brvm-fg leading-relaxed">{stock.company.description || 'Non disponible'}</p>
          </div>
          <div className="space-y-2">
            {stock.company.dirigeants && (
              <div>
                <div className="text-xs text-brvm-fg-muted uppercase tracking-wider">Dirigeants</div>
                <div className="text-brvm-fg">{stock.company.dirigeants}</div>
              </div>
            )}
            {stock.company.adresse && (
              <div>
                <div className="text-xs text-brvm-fg-muted uppercase tracking-wider">Adresse</div>
                <div className="text-brvm-fg">{stock.company.adresse}</div>
              </div>
            )}
            {stock.company.telephone && (
              <div>
                <div className="text-xs text-brvm-fg-muted uppercase tracking-wider">Téléphone</div>
                <div className="text-brvm-fg font-mono">{stock.company.telephone}</div>
              </div>
            )}
            {stock.company.nombreTitres > 0 && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-xs text-brvm-fg-muted uppercase tracking-wider">Titres</div>
                  <div className="text-brvm-fg font-mono">{fmtNum(stock.company.nombreTitres)}</div>
                </div>
                <div>
                  <div className="text-xs text-brvm-fg-muted uppercase tracking-wider">Flottant</div>
                  <div className="text-brvm-fg font-mono">{stock.company.flottant.toFixed(2)}%</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, suffix, positive, negative }: { label: string; value: string; suffix?: string; positive?: boolean; negative?: boolean }) {
  return (
    <div className="bg-brvm-bg-soft rounded p-2 border border-brvm-border">
      <div className="text-xs text-brvm-fg-muted uppercase tracking-wider">{label}</div>
      <div className={`font-mono text-base font-semibold ${positive ? 'text-brvm-up' : negative ? 'text-brvm-down' : 'text-brvm-fg'}`}>
        {value} {suffix && <span className="text-xs text-brvm-fg-muted">{suffix}</span>}
      </div>
    </div>
  );
}

function TrendBadge({ up, label }: { up: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono ${up ? 'badge-up' : 'badge-down'}`}>
      {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {label}
    </span>
  );
}

function FundRow({ label, data, growthData }: { label: string; data: number[]; growthData?: (number | null)[] }) {
  const isIncreasing = data.every((v, i) => i === 0 || v >= data[i - 1]);
  const isDecreasing = data.every((v, i) => i === 0 || v <= data[i - 1]);
  const colorClass = isIncreasing && !isDecreasing ? 'text-brvm-up' : isDecreasing && !isIncreasing ? 'text-brvm-down' : 'text-brvm-fg';
  
  return (
    <tr className="border-b border-brvm-border/30 hover:bg-brvm-card-hover/30">
      <td className="py-2 px-2 text-left text-brvm-fg-muted">{label}</td>
      {data.map((v, i) => (
        <td key={i} className={`py-2 px-2 font-mono ${colorClass}`}>
          {v > 0 ? fmtNum(v) : '—'}
          {growthData && growthData[i] != null && (
            <span className={`block text-xs ${growthData[i]! >= 0 ? 'text-brvm-up' : 'text-brvm-down'}`}>
              {growthData[i]! >= 0 ? '+' : ''}{growthData[i]!.toFixed(2)}%
            </span>
          )}
        </td>
      ))}
    </tr>
  );
}

function ScoreCard({ title, score, color, level, icon, reasons, components }: {
  title: string;
  score: number;
  color: string;
  level: string;
  icon: React.ReactNode;
  reasons: string[];
  components: { label: string; value: number; max: number; color?: string }[];
}) {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div className="brvm-card brvm-card-hover rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div style={{ color }}>{icon}</div>
          <h3 className="text-sm font-semibold text-brvm-fg uppercase tracking-wider">{title}</h3>
        </div>
        <span className="text-xs font-semibold px-2 py-0.5 rounded" style={{ backgroundColor: `${color}20`, color }}>
          {level}
        </span>
      </div>
      
      <div className="flex items-center gap-4">
        <ScoreGauge score={score} label="" size="md" color={color} showLabel={false} />
        <div className="flex-1 space-y-1">
          {components.map((c, i) => (
            <div key={i}>
              <div className="flex items-center justify-between text-xs">
                <span className="text-brvm-fg-muted">{c.label}</span>
                <span className="font-mono text-brvm-fg">{c.value}/{c.max}</span>
              </div>
              <div className="h-1 bg-brvm-bg-soft rounded overflow-hidden">
                <div
                  className="h-full rounded"
                  style={{
                    width: `${(c.value / c.max) * 100}%`,
                    backgroundColor: c.color || color,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <button
        onClick={() => setExpanded(e => !e)}
        className="mt-3 text-xs text-brvm-info hover:underline"
      >
        {expanded ? 'Masquer les détails' : `Voir ${reasons.length} détails`}
      </button>
      {expanded && (
        <ul className="mt-2 space-y-1 text-xs text-brvm-fg-muted">
          {reasons.map((r, i) => (
            <li key={i} className="flex items-start gap-1">
              <span className="text-brvm-fg-dim">•</span>
              <span>{r}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DynamismCard({ title, subtitle, value, hint, status, statusLabels, color, icon }: {
  title: string;
  subtitle: string;
  value: string;
  hint: string;
  status?: 'sous-cote' | 'sur-cote' | 'neutre' | 'inconnu' | 'bon-achat' | 'mauvais-achat';
  statusLabels?: Record<string, string>;
  color: string;
  icon: React.ReactNode;
}) {
  let statusColor = '#8B95B0';
  let statusIcon = <MinusCircle className="w-3 h-3" />;
  if (status === 'sous-cote' || status === 'bon-achat') {
    statusColor = '#00D678';
    statusIcon = <CheckCircle2 className="w-3 h-3" />;
  } else if (status === 'sur-cote' || status === 'mauvais-achat') {
    statusColor = '#FF4757';
    statusIcon = <XCircle className="w-3 h-3" />;
  }
  
  return (
    <div className="brvm-card rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div style={{ color }}>{icon}</div>
          <div>
            <div className="text-sm font-bold text-brvm-fg">{title}</div>
            <div className="text-xs text-brvm-fg-muted">{subtitle}</div>
          </div>
        </div>
        {status && statusLabels && (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold"
            style={{ backgroundColor: `${statusColor}20`, color: statusColor }}
          >
            {statusIcon}
            {statusLabels[status]}
          </span>
        )}
      </div>
      <div className="font-mono text-2xl font-bold" style={{ color }}>
        {value}
      </div>
      <div className="text-xs text-brvm-fg-muted mt-1">{hint}</div>
    </div>
  );
}

function PerDynamismCard({
  per,
  perSectoriel,
  perVsSecteur,
  perTrend5ans,
  perTrend5ansPct,
  perRiskLevel,
}: {
  per: number;
  perSectoriel: number | null;
  perVsSecteur: 'sous-cote' | 'sur-cote' | 'neutre' | 'inconnu';
  perTrend5ans: 'decroissant' | 'croissant' | 'stable' | 'inconnu';
  perTrend5ansPct: number | null;
  perRiskLevel: 'FAIBLE' | 'MODERE' | 'ELEVE' | 'TRES_ELEVE' | 'INCONNU';
}) {
  // Couleur et icône selon le niveau de risque
  const riskConfig: Record<string, { color: string; label: string; icon: React.ReactNode; bg: string }> = {
    'FAIBLE':     { color: '#00D678', label: 'Risque FAIBLE',     icon: <CheckCircle2 className="w-3 h-3" />, bg: 'rgba(0, 214, 120, 0.15)' },
    'MODERE':     { color: '#7CFC00', label: 'Risque MODERE',     icon: <MinusCircle className="w-3 h-3" />,   bg: 'rgba(124, 252, 0, 0.15)' },
    'ELEVE':      { color: '#FFA500', label: 'Risque ELEVE',      icon: <AlertTriangle className="w-3 h-3" />, bg: 'rgba(255, 165, 0, 0.15)' },
    'TRES_ELEVE': { color: '#FF4757', label: 'Risque TRES ELEVE', icon: <XCircle className="w-3 h-3" />,       bg: 'rgba(255, 71, 87, 0.15)' },
    'INCONNU':    { color: '#8B95B0', label: 'N/A',                icon: <MinusCircle className="w-3 h-3" />,   bg: 'rgba(139, 149, 176, 0.15)' },
  };
  const risk = riskConfig[perRiskLevel] || riskConfig.INCONNU;
  
  // Couleur selon la tendance
  const trendConfig: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
    'decroissant': { color: '#00D678', label: 'Décroissant', icon: <TrendingDown className="w-3 h-3" /> },
    'croissant':   { color: '#FF4757', label: 'Croissant',   icon: <TrendingUp className="w-3 h-3" /> },
    'stable':      { color: '#FFA500', label: 'Stable',      icon: <MinusCircle className="w-3 h-3" /> },
    'inconnu':     { color: '#5C6789', label: 'N/A',         icon: <MinusCircle className="w-3 h-3" /> },
  };
  const trend = trendConfig[perTrend5ans] || trendConfig.inconnu;
  
  // Couleur selon vs secteur
  const vsSecteurConfig: Record<string, { color: string; label: string }> = {
    'sous-cote': { color: '#00D678', label: 'Sous-cotée ✓' },
    'sur-cote':  { color: '#FF4757', label: 'Sur-cotée ✗' },
    'neutre':    { color: '#FFA500', label: 'Neutre' },
    'inconnu':   { color: '#5C6789', label: 'N/A' },
  };
  const vsSecteur = vsSecteurConfig[perVsSecteur] || vsSecteurConfig.inconnu;
  
  // Couleur principale de la valeur PER selon le risque
  const mainColor = risk.color;
  
  return (
    <div className="brvm-card rounded-lg p-4 border-l-4" style={{ borderLeftColor: risk.color }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div style={{ color: mainColor }}><TrendingUp className="w-5 h-5" /></div>
          <div>
            <div className="text-sm font-bold text-brvm-fg">PER</div>
            <div className="text-xs text-brvm-fg-muted">Price Earnings Ratio</div>
          </div>
        </div>
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold"
          style={{ backgroundColor: risk.bg, color: risk.color }}
        >
          {risk.icon}
          {risk.label}
        </span>
      </div>
      
      {/* Valeur principale */}
      <div className="font-mono text-2xl font-bold" style={{ color: mainColor }}>
        {per > 0 ? per.toFixed(2) : '—'}
      </div>
      <div className="text-xs text-brvm-fg-muted mt-0.5">
        {perSectoriel ? `Moyenne secteur: ${perSectoriel.toFixed(2)}` : 'Pas de référence sectorielle'}
      </div>
      
      {/* Badge vs secteur */}
      <div className="mt-2 flex items-center gap-1">
        <span
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium"
          style={{ backgroundColor: `${vsSecteur.color}20`, color: vsSecteur.color }}
        >
          {vsSecteur.label}
        </span>
      </div>
      
      {/* Tendance 5 ans */}
      <div className="mt-2 pt-2 border-t border-brvm-border">
        <div className="text-xs text-brvm-fg-muted uppercase tracking-wider mb-1">Tendance 5 ans</div>
        <div className="flex items-center justify-between">
          <span
            className="inline-flex items-center gap-1 text-xs font-semibold"
            style={{ color: trend.color }}
          >
            {trend.icon}
            {trend.label}
          </span>
          {perTrend5ansPct != null && (
            <span
              className="font-mono text-xs font-bold"
              style={{ color: trend.color }}
            >
              {perTrend5ansPct > 0 ? '+' : ''}{perTrend5ansPct.toFixed(0)}%
            </span>
          )}
        </div>
        {perTrend5ans === 'decroissant' && (
          <div className="text-xs text-brvm-up mt-1">✓ Bon signal: valorisation qui se rase</div>
        )}
        {perTrend5ans === 'croissant' && (perTrend5ansPct ?? 0) > 20 && (
          <div className="text-xs text-brvm-down mt-1">✗ Alerte: risque croissant, ne pas acheter</div>
        )}
      </div>
    </div>
  );
}
