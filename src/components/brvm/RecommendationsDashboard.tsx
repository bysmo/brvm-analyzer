'use client';

import { useEffect, useState } from 'react';
import {
  TrendingUp, TrendingDown, Star, Award, AlertTriangle,
  CheckCircle2, XCircle, ArrowUpRight, ArrowDownRight, Minus,
  Loader2, RefreshCw, Lightbulb, Droplet, Activity,
} from 'lucide-react';

interface RecommendationItem {
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
  topReasons: string[];
}

interface RecommendationData {
  topBuys: RecommendationItem[];
  topSells: RecommendationItem[];
  bestOpportunities: RecommendationItem[];
  stats: {
    totalAnalyzed: number;
    achat: number;
    conserver: number;
    observer: number;
    vendre: number;
  };
  fetchedAt: string;
}

interface Props {
  onSelectStock: (ticker: string) => void;
}

function fmtNum(n: number, opts: Intl.NumberFormatOptions = {}): string {
  if (!n || isNaN(n)) return '—';
  return n.toLocaleString('fr-FR', { maximumFractionDigits: 2, ...opts });
}

export function RecommendationsDashboard({ onSelectStock }: Props) {
  const [data, setData] = useState<RecommendationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/brvm/recommendations');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      setData(d);
      setLoading(false);
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="brvm-card rounded-lg p-6">
          <div className="flex items-center gap-3 text-brvm-fg-muted">
            <Loader2 className="w-6 h-6 animate-spin text-brvm-accent" />
            <div>
              <div className="font-semibold text-brvm-fg">Analyse des actions BRVM en cours...</div>
              <div className="text-xs">Pré-analyse du Top 30 BRVM (cela peut prendre 1 à 2 minutes la première fois)</div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="shimmer h-64 rounded" />
            <div className="shimmer h-64 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="brvm-card rounded-lg p-6 border-l-4 border-brvm-danger">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-brvm-danger" />
          <div>
            <div className="font-semibold text-brvm-fg">Erreur de chargement</div>
            <div className="text-sm text-brvm-fg-muted">{error}</div>
          </div>
        </div>
        <button
          onClick={load}
          className="mt-4 px-4 py-2 bg-brvm-card border border-brvm-border hover:border-brvm-accent rounded-md flex items-center gap-2 text-sm text-brvm-fg transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Réessayer
        </button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-4">
      {/* En-tête + stats globales */}
      <div className="brvm-card rounded-lg p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-lg font-bold text-brvm-fg flex items-center gap-2">
              <Award className="w-5 h-5 text-brvm-accent" />
              Tableau de bord — Recommandations
            </h2>
            <p className="text-xs text-brvm-fg-muted mt-0.5">
              Analyse automatisée de {data.stats.totalAnalyzed} actions BRVM — Top 30 + plus échangées
            </p>
          </div>
          <div className="flex items-center gap-2">
            <RefreshButton onClick={load} />
            <div className="text-xs text-brvm-fg-dim">
              Mis à jour: {new Date(data.fetchedAt).toLocaleTimeString('fr-FR')}
            </div>
          </div>
        </div>

        {/* Répartition des verdicts */}
        <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-2">
          <StatPill label="ACHAT" value={data.stats.achat} color="#00D678" icon={<TrendingUp className="w-4 h-4" />} />
          <StatPill label="CONSERVER" value={data.stats.conserver} color="#7CFC00" icon={<CheckCircle2 className="w-4 h-4" />} />
          <StatPill label="OBSERVER" value={data.stats.observer} color="#FFA500" icon={<Activity className="w-4 h-4" />} />
          <StatPill label="VENDRE" value={data.stats.vendre} color="#FF4757" icon={<TrendingDown className="w-4 h-4" />} />
          <StatPill label="Total" value={data.stats.totalAnalyzed} color="#4DA3FF" icon={<Award className="w-4 h-4" />} />
        </div>
      </div>

      {/* Top 5 Achats + Top 5 Ventes en parallèle */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Achats */}
        <RecommendationsPanel
          title="Top 5 — Actions à ACHETER"
          subtitle="Score global le plus élevé + recommandation ACHAT"
          icon={<TrendingUp className="w-5 h-5" />}
          color="#00D678"
          items={data.topBuys}
          onSelectStock={onSelectStock}
          emptyMessage="Aucune action à acheter actuellement"
          mode="buy"
        />

        {/* Top Ventes */}
        <RecommendationsPanel
          title="Top 5 — Actions à VENDRE"
          subtitle="Score global le plus faible + recommandation VENDRE/OBSERVER"
          icon={<TrendingDown className="w-5 h-5" />}
          color="#FF4757"
          items={data.topSells}
          onSelectStock={onSelectStock}
          emptyMessage="Aucune action critique à vendre actuellement"
          mode="sell"
        />
      </div>

      {/* Opportunités PER bas + DPA élevé */}
      {data.bestOpportunities.length > 0 && (
        <RecommendationsPanel
          title="Opportunités — PER bas & rendement élevé"
          subtitle="Actions sous-cotées vs secteur avec PER < 20"
          icon={<Lightbulb className="w-5 h-5" />}
          color="#FFA500"
          items={data.bestOpportunities}
          onSelectStock={onSelectStock}
          emptyMessage="Aucune opportunité identifiée"
          mode="opportunity"
        />
      )}
    </div>
  );
}

function RefreshButton({ onClick }: { onClick: () => void }) {
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    setLoading(true);
    await onClick();
    setLoading(false);
  };

  return (
    <button
      onClick={handle}
      disabled={loading}
      className="px-3 py-1.5 bg-brvm-card border border-brvm-border hover:border-brvm-accent rounded-md flex items-center gap-1.5 text-xs text-brvm-fg-muted hover:text-brvm-fg transition-colors disabled:opacity-50"
    >
      <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
      Actualiser
    </button>
  );
}

function StatPill({ label, value, color, icon }: { label: string; value: number; color: string; icon: React.ReactNode }) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded border"
      style={{ backgroundColor: `${color}10`, borderColor: `${color}40` }}
    >
      <div style={{ color }}>{icon}</div>
      <div>
        <div className="text-xs text-brvm-fg-muted uppercase tracking-wider">{label}</div>
        <div className="font-mono font-bold text-lg" style={{ color }}>{value}</div>
      </div>
    </div>
  );
}

interface PanelProps {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  color: string;
  items: RecommendationItem[];
  onSelectStock: (ticker: string) => void;
  emptyMessage: string;
  mode: 'buy' | 'sell' | 'opportunity';
}

function RecommendationsPanel({ title, subtitle, icon, color, items, onSelectStock, emptyMessage, mode }: PanelProps) {
  return (
    <div className="brvm-card rounded-lg p-4 border-l-4" style={{ borderLeftColor: color }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div style={{ color }}>{icon}</div>
          <div>
            <h3 className="text-sm font-bold text-brvm-fg uppercase tracking-wider">{title}</h3>
            <div className="text-xs text-brvm-fg-muted">{subtitle}</div>
          </div>
        </div>
        <span className="text-xs text-brvm-fg-dim">{items.length} action{items.length > 1 ? 's' : ''}</span>
      </div>

      {items.length === 0 ? (
        <div className="text-sm text-brvm-fg-muted py-8 text-center">{emptyMessage}</div>
      ) : (
        <div className="space-y-2">
          {items.map((item, idx) => (
            <RecommendationCard
              key={item.ticker}
              item={item}
              rank={idx + 1}
              mode={mode}
              onSelectStock={onSelectStock}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface CardProps {
  item: RecommendationItem;
  rank: number;
  mode: 'buy' | 'sell' | 'opportunity';
  onSelectStock: (ticker: string) => void;
}

function RecommendationCard({ item, rank, mode, onSelectStock }: CardProps) {
  const isBuy = mode === 'buy';
  const isSell = mode === 'sell';
  const rankColor = isBuy ? '#00D678' : isSell ? '#FF4757' : '#FFA500';

  return (
    <div
      onClick={() => onSelectStock(item.ticker)}
      className="bg-brvm-bg-soft hover:bg-brvm-card-hover border border-brvm-border hover:border-brvm-border-soft rounded-lg p-3 cursor-pointer transition-all"
    >
      <div className="flex items-start gap-3">
        {/* Rang */}
        <div
          className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm font-mono"
          style={{ backgroundColor: `${rankColor}20`, color: rankColor, border: `1px solid ${rankColor}40` }}
        >
          {rank}
        </div>

        {/* Info entreprise */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-base">{item.flag}</span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-brvm-fg truncate">{item.name}</div>
              <div className="text-xs text-brvm-fg-muted font-mono">{item.ticker} • {item.sector}</div>
            </div>
            {/* Recommandation badge */}
            <span
              className="text-xs font-bold px-2 py-0.5 rounded flex-shrink-0"
              style={{
                backgroundColor: `${item.verdictColor}20`,
                color: item.verdictColor,
                border: `1px solid ${item.verdictColor}40`,
              }}
            >
              {item.recommandation}
            </span>
            {/* Score */}
            <div
              className="flex-shrink-0 font-mono text-lg font-bold"
              style={{ color: item.verdictColor }}
            >
              {item.verdictScore}
            </div>
          </div>

          {/* Métriques clés */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2 text-xs">
            <Metric
              label="Cours"
              value={`${fmtNum(item.price)} XOF`}
              sub={
                <span className={item.variation >= 0 ? 'text-brvm-up' : 'text-brvm-down'}>
                  {item.variation >= 0 ? '+' : ''}{item.variation.toFixed(2)}%
                </span>
              }
            />
            <Metric
              label="PER"
              value={item.per > 0 ? item.per.toFixed(2) : '—'}
              sub={
                <span style={{
                  color: item.perRiskLevel === 'FAIBLE' ? '#00D678'
                       : item.perRiskLevel === 'MODERE' ? '#7CFC00'
                       : item.perRiskLevel === 'ELEVE' ? '#FFA500'
                       : item.perRiskLevel === 'TRES_ELEVE' ? '#FF4757'
                       : '#8B95B0'
                }}>
                  {item.perRiskLevel === 'INCONNU' ? '—' : item.perRiskLevel}
                </span>
              }
            />
            <Metric
              label="DPA"
              value={item.dpa > 0 ? `${item.dpa.toFixed(2)}%` : '—'}
              sub={
                <span className={item.dpa > 5 ? 'text-brvm-up' : item.dpa > 0 ? 'text-brvm-fg-muted' : 'text-brvm-fg-dim'}>
                  {item.dpa > 5 ? 'Élevé' : item.dpa > 0 ? 'Modéré' : '—'}
                </span>
              }
            />
            <Metric
              label="Liquidité"
              value={`${item.liquidityScore}/100`}
              sub={
                <span style={{ color: getLiquidityColor(item.liquidityLevel) }}>
                  {item.liquidityLevel}
                </span>
              }
            />
          </div>

          {/* Top raisons */}
          {item.topReasons.length > 0 && (
            <div className="mt-2 pt-2 border-t border-brvm-border/50">
              <ul className="space-y-0.5">
                {item.topReasons.map((r, i) => (
                  <li key={i} className="text-xs text-brvm-fg-muted flex items-start gap-1">
                    <span className="text-brvm-fg-dim flex-shrink-0">›</span>
                    <span className="leading-tight">{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Scores détaillés (barres) */}
          <div className="mt-2 grid grid-cols-3 gap-2">
            <ScoreBar label="Fondamentaux" value={item.fundamentalsScore} color="#00D678" />
            <ScoreBar label="Dynamisme" value={item.dynamismScore} color="#4DA3FF" />
            <ScoreBar label="Liquidité" value={item.liquidityScore} color="#B47CFF" />
          </div>

          {/* CTA */}
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-brvm-fg-dim">
              Actionnaires étrangers: {item.pctEtranger}%
            </span>
            <span className="text-xs text-brvm-info hover:underline">
              Analyser en détail →
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: React.ReactNode }) {
  return (
    <div className="bg-brvm-card rounded p-1.5 border border-brvm-border/50">
      <div className="text-[10px] text-brvm-fg-dim uppercase tracking-wider">{label}</div>
      <div className="font-mono text-sm font-bold text-brvm-fg">{value}</div>
      {sub && <div className="text-[10px] mt-0.5">{sub}</div>}
    </div>
  );
}

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[10px] mb-0.5">
        <span className="text-brvm-fg-dim uppercase tracking-wider">{label}</span>
        <span className="font-mono font-bold" style={{ color }}>{value}</span>
      </div>
      <div className="h-1 bg-brvm-bg-soft rounded overflow-hidden">
        <div
          className="h-full rounded transition-all duration-500"
          style={{ width: `${value}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function getLiquidityColor(level: string): string {
  switch (level) {
    case 'TRES LIQUIDE': return '#00D678';
    case 'LIQUIDE': return '#7CFC00';
    case 'PEU LIQUIDE': return '#FFA500';
    case 'ILLIQUIDE': return '#FF4757';
    default: return '#8B95B0';
  }
}
