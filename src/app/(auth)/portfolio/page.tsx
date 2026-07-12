'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  TrendingUp, TrendingDown, Briefcase, Target, Plus, Settings,
  ArrowLeft, Loader2, Bell, DollarSign, BarChart2,
  AlertTriangle, CheckCircle2, Eye, RefreshCw,
  ArrowUpRight, ArrowDownRight, Calendar, Trash2, ShoppingBag,
  Search, ChevronDown, Info,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { BRVM_STOCKS, type StockMeta } from '@/lib/brvm/stocks';

// ── Types ────────────────────────────────────────────────────────────────────

interface PortfolioConfig {
  id: string;
  targetAmountXOF: number;
  initialAmountXOF: number;
  targetYears: number;
  yieldThresholdPct: number;
  monthlyContribXOF: number;
}

interface Position {
  id: string;
  ticker: string;
  name: string;
  acquisitionDate: string;
  acquisitionPrice: number;
  quantity: number;
  totalCostXOF: number;
  status: 'open' | 'sold';
  // Enriched (open positions)
  currentPrice: number | null;
  currentValueXOF: number | null;
  grossYieldPct: number | null;
  annualizedYieldPct: number | null;
  gainXOF: number | null;
  holdingDays: number | null;
  yieldThresholdReached?: boolean;
  priceAvailable?: boolean;
  // Sold positions
  saleDate?: string;
  salePrice?: number;
  saleTotalXOF?: number;
  realizedGainXOF?: number;
  notes?: string;
}

interface PortfolioSummary {
  totalCostXOF: number;
  totalCurrentValueXOF: number;
  totalGainXOF: number;
  totalGrossYieldPct: number;
  totalRealizedGainXOF: number;
  openPositionCount: number;
  soldPositionCount: number;
  progressionPct: number | null;
  estimatedMonthsToGoal: number | null;
}

// ── Formatters ───────────────────────────────────────────────────────────────

const fmtXOF = (n: number) => n.toLocaleString('fr-FR') + ' XOF';
const fmtPct = (n: number) => (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });

// ── Page principale ───────────────────────────────────────────────────────────

export default function PortfolioPage() {
  const router = useRouter();
  const { user, loading, isAuthenticated } = useAuth();

  const [activeTab, setActiveTab] = useState<'dashboard' | 'positions' | 'history' | 'config'>('dashboard');
  const [config, setConfig] = useState<PortfolioConfig | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [sectorDistribution, setSectorDistribution] = useState<Array<{ sector: string; pct: number; valueXOF: number }>>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showSellModal, setShowSellModal] = useState<Position | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<Position | null>(null);

  useEffect(() => {
    if (!loading && !isAuthenticated) router.push('/login?redirect=/portfolio');
  }, [loading, isAuthenticated, router]);

  const loadData = useCallback(async () => {
    try {
      const [posRes, summaryRes, configRes] = await Promise.all([
        fetch('/api/portfolio/positions'),
        fetch('/api/portfolio/summary'),
        fetch('/api/portfolio/config'),
      ]);
      if (posRes.ok) {
        const d = await posRes.json();
        setPositions(d.positions ?? []);
      }
      if (summaryRes.ok) {
        const d = await summaryRes.json();
        setSummary(d.summary ?? null);
        setSectorDistribution(d.sectorDistribution ?? []);
      }
      if (configRes.ok) {
        const d = await configRes.json();
        setConfig(d.config ?? null);
      }
    } catch (err) {
      console.error('[portfolio] Erreur chargement:', err);
    } finally {
      setPageLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) loadData();
  }, [isAuthenticated, loadData]);

  const handleRefresh = async () => { setRefreshing(true); await loadData(); };
  const handleDeletePosition = async (position: Position) => {
    try {
      await fetch(`/api/portfolio/positions/${position.id}`, { method: 'DELETE' });
      setShowDeleteConfirm(null);
      await loadData();
    } catch (err) { console.error('Erreur suppression:', err); }
  };

  if (loading || pageLoading) {
    return (
      <div className="min-h-screen bg-brvm-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-brvm-accent animate-spin" />
      </div>
    );
  }
  if (!user) return null;

  const openPositions = positions.filter(p => p.status === 'open');
  const soldPositions = positions.filter(p => p.status === 'sold');
  const alertPositions = openPositions.filter(p => p.yieldThresholdReached);

  return (
    <div className="min-h-screen bg-brvm-bg">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-brvm-bg/95 backdrop-blur-sm border-b border-brvm-border px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/" className="text-brvm-fg-muted hover:text-brvm-fg transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </a>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-brvm-accent/20 flex items-center justify-center">
                <Briefcase className="w-4 h-4 text-brvm-accent" />
              </div>
              <div>
                <div className="font-bold text-brvm-fg text-sm">Mon Portefeuille</div>
                <div className="text-xs text-brvm-fg-muted">
                  {openPositions.length} position{openPositions.length !== 1 ? 's' : ''} ouverte{openPositions.length !== 1 ? 's' : ''}
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {alertPositions.length > 0 && (
              <div className="flex items-center gap-1 px-2 py-1 bg-brvm-warning/10 border border-brvm-warning/30 rounded-full text-xs text-brvm-warning animate-pulse">
                <Bell className="w-3 h-3" />
                {alertPositions.length}
              </div>
            )}
            <button onClick={handleRefresh} disabled={refreshing}
              className="p-2 text-brvm-fg-muted hover:text-brvm-fg rounded-lg hover:bg-brvm-card transition-colors">
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-brvm-accent hover:bg-brvm-accent-soft text-brvm-bg text-xs font-bold rounded-lg transition-colors">
              <Plus className="w-3.5 h-3.5" />
              Ajouter
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-5xl mx-auto mt-3 flex gap-1">
          {[
            { id: 'dashboard', label: 'Tableau de bord', icon: BarChart2 },
            { id: 'positions', label: `Positions (${openPositions.length})`, icon: TrendingUp },
            { id: 'history', label: `Historique (${soldPositions.length})`, icon: Eye },
            { id: 'config', label: 'Configuration', icon: Settings },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-brvm-accent text-brvm-bg'
                  : 'text-brvm-fg-muted hover:text-brvm-fg hover:bg-brvm-card'
              }`}>
              <tab.icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {alertPositions.length > 0 && activeTab !== 'config' && (
          <div className="mb-4 p-3 bg-brvm-warning/10 border border-brvm-warning/30 rounded-lg flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-brvm-warning mt-0.5 shrink-0" />
            <div>
              <div className="text-xs font-bold text-brvm-warning">
                {alertPositions.length} alerte{alertPositions.length > 1 ? 's' : ''} — Seuil de rendement atteint
              </div>
              <div className="text-xs text-brvm-fg-muted mt-0.5">
                {alertPositions.map(p => `${p.ticker.toUpperCase()} (${p.grossYieldPct !== null ? fmtPct(p.grossYieldPct) : '—'})`).join(', ')}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'dashboard' && (
          <DashboardTab summary={summary} config={config} sectorDistribution={sectorDistribution} alertPositions={alertPositions} />
        )}
        {activeTab === 'positions' && (
          <PositionsTab positions={openPositions} config={config} onSell={setShowSellModal} onDelete={setShowDeleteConfirm} onAdd={() => setShowAddModal(true)} />
        )}
        {activeTab === 'history' && (
          <HistoryTab positions={soldPositions} onDelete={setShowDeleteConfirm} />
        )}
        {activeTab === 'config' && (
          <ConfigTab config={config} onSaved={loadData} />
        )}
      </div>

      {showAddModal && (
        <AddPositionModal onClose={() => setShowAddModal(false)} onSaved={async () => { setShowAddModal(false); await loadData(); }} />
      )}
      {showSellModal && (
        <SellPositionModal position={showSellModal} onClose={() => setShowSellModal(null)} onSaved={async () => { setShowSellModal(null); await loadData(); }} />
      )}
      {showDeleteConfirm && (
        <ConfirmDeleteModal position={showDeleteConfirm} onClose={() => setShowDeleteConfirm(null)} onConfirm={() => handleDeletePosition(showDeleteConfirm)} />
      )}
    </div>
  );
}

// ── Dashboard Tab ─────────────────────────────────────────────────────────────

function DashboardTab({ summary, config, sectorDistribution, alertPositions }: {
  summary: PortfolioSummary | null;
  config: PortfolioConfig | null;
  sectorDistribution: Array<{ sector: string; pct: number; valueXOF: number }>;
  alertPositions: Position[];
}) {
  if (!summary && !config) {
    return (
      <div className="text-center py-16">
        <Target className="w-12 h-12 text-brvm-fg-muted mx-auto mb-3" />
        <div className="text-brvm-fg-muted text-sm mb-4">Configurez votre objectif financier pour commencer</div>
        <div className="text-xs text-brvm-accent">→ Aller dans l'onglet Configuration</div>
      </div>
    );
  }

  const totalIsGain = (summary?.totalGainXOF ?? 0) >= 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Valeur actuelle" value={fmtXOF(summary?.totalCurrentValueXOF ?? 0)} icon={DollarSign} color="accent" />
        <KpiCard
          label="Gain / Perte latent"
          value={fmtXOF(summary?.totalGainXOF ?? 0)}
          sub={summary?.totalCostXOF ? fmtPct(summary.totalGrossYieldPct) : undefined}
          icon={totalIsGain ? TrendingUp : TrendingDown}
          color={totalIsGain ? 'up' : 'down'}
        />
        <KpiCard
          label="Gains réalisés"
          value={fmtXOF(summary?.totalRealizedGainXOF ?? 0)}
          icon={CheckCircle2}
          color={(summary?.totalRealizedGainXOF ?? 0) >= 0 ? 'up' : 'down'}
        />
        <KpiCard
          label="Positions ouvertes"
          value={String(summary?.openPositionCount ?? 0)}
          sub={`${summary?.soldPositionCount ?? 0} vendues`}
          icon={Briefcase}
          color="neutral"
        />
      </div>

      {/* Progression vers objectif */}
      {config && summary?.progressionPct !== null && summary?.progressionPct !== undefined && (
        <div className="brvm-card rounded-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-brvm-accent" />
              <span className="text-sm font-semibold text-brvm-fg">Objectif financier</span>
            </div>
            <span className="text-lg font-bold text-brvm-accent">{summary.progressionPct}%</span>
          </div>
          <div className="w-full bg-brvm-bg-soft rounded-full h-3 mb-2 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-brvm-accent to-brvm-accent-soft rounded-full transition-all duration-700"
              style={{ width: `${Math.min(100, summary.progressionPct)}%` }} />
          </div>
          <div className="flex items-center justify-between text-xs text-brvm-fg-muted">
            <span>{fmtXOF(config.initialAmountXOF)} initial</span>
            <span>Objectif : {fmtXOF(config.targetAmountXOF)}</span>
          </div>
          {summary.estimatedMonthsToGoal !== null && summary.estimatedMonthsToGoal > 0 && (
            <div className="mt-3 p-2 bg-brvm-card rounded text-xs text-brvm-fg-muted flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-brvm-accent" />
              Estimation : encore ~{summary.estimatedMonthsToGoal} mois
              ({Math.round(summary.estimatedMonthsToGoal / 12 * 10) / 10} ans)
              à {fmtXOF(config.monthlyContribXOF)}/mois
            </div>
          )}
        </div>
      )}

      {/* Paramètres financiers */}
      {config && (
        <div className="brvm-card rounded-lg p-4">
          <div className="text-xs font-semibold text-brvm-fg-muted uppercase tracking-wider mb-3">
            Paramètres financiers
          </div>
          <div className="grid grid-cols-3 gap-3">
            <InfoChip label="Durée cible" value={`${config.targetYears} an${config.targetYears > 1 ? 's' : ''}`} />
            <InfoChip label="Versement mensuel" value={fmtXOF(config.monthlyContribXOF)} color="accent" />
            <InfoChip
              label="Rendement requis"
              value={`${config.yieldThresholdPct.toFixed(2)}% / an`}
              color={config.yieldThresholdPct > 30 ? 'danger' : config.yieldThresholdPct > 15 ? 'warning' : 'up'}
            />
          </div>
          {config.yieldThresholdPct > 30 && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-brvm-down">
              <AlertTriangle className="w-3 h-3" />
              Rendement requis élevé — envisagez d'augmenter le versement mensuel ou la durée.
            </div>
          )}
        </div>
      )}

      {/* Distribution sectorielle */}
      {sectorDistribution.length > 0 && (
        <div className="brvm-card rounded-lg p-4">
          <div className="text-xs font-semibold text-brvm-fg-muted uppercase tracking-wider mb-3 flex items-center gap-2">
            <BarChart2 className="w-3.5 h-3.5" />
            Distribution sectorielle
          </div>
          <div className="space-y-2">
            {sectorDistribution.map(s => (
              <div key={s.sector} className="flex items-center gap-3">
                <div className="text-xs text-brvm-fg-muted w-28 truncate">{s.sector}</div>
                <div className="flex-1 bg-brvm-bg-soft rounded-full h-2 overflow-hidden">
                  <div className="h-full bg-brvm-accent rounded-full"
                    style={{ width: `${s.pct}%`, opacity: 0.5 + (s.pct / 100) * 0.5 }} />
                </div>
                <div className="text-xs font-mono text-brvm-fg w-10 text-right">{s.pct}%</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Positions Tab ─────────────────────────────────────────────────────────────

function PositionsTab({ positions, config, onSell, onDelete, onAdd }: {
  positions: Position[];
  config: PortfolioConfig | null;
  onSell: (p: Position) => void;
  onDelete: (p: Position) => void;
  onAdd: () => void;
}) {
  if (positions.length === 0) {
    return (
      <div className="text-center py-16">
        <ShoppingBag className="w-12 h-12 text-brvm-fg-muted mx-auto mb-3" />
        <div className="text-brvm-fg text-sm font-medium mb-1">Aucune position ouverte</div>
        <div className="text-brvm-fg-muted text-xs mb-4">Ajoutez votre première action pour commencer le suivi</div>
        <button onClick={onAdd}
          className="px-4 py-2 bg-brvm-accent hover:bg-brvm-accent-soft text-brvm-bg text-sm font-bold rounded-lg transition-colors">
          + Ajouter une position
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {positions.map(pos => (
        <PositionCard key={pos.id} position={pos} yieldThreshold={config?.yieldThresholdPct ?? null}
          onSell={onSell} onDelete={onDelete} />
      ))}
    </div>
  );
}

function PositionCard({ position: pos, yieldThreshold, onSell, onDelete }: {
  position: Position;
  yieldThreshold: number | null;
  onSell: (p: Position) => void;
  onDelete: (p: Position) => void;
}) {
  const priceAvailable = pos.priceAvailable !== false && pos.currentPrice !== null;
  const isGain = (pos.gainXOF ?? 0) >= 0;
  const grossYield = pos.grossYieldPct ?? 0;
  const thresholdReached = pos.yieldThresholdReached ?? false;

  const thresholdProgress = priceAvailable && yieldThreshold && yieldThreshold > 0
    ? Math.min(100, (Math.max(0, grossYield) / yieldThreshold) * 100)
    : null;

  return (
    <div className={`brvm-card rounded-lg p-4 border transition-colors ${
      thresholdReached ? 'border-brvm-warning/50 bg-brvm-warning/5' : 'border-brvm-border'
    }`}>
      {thresholdReached && (
        <div className="flex items-center gap-1.5 text-xs text-brvm-warning mb-2">
          <Bell className="w-3.5 h-3.5" />
          Seuil de rendement atteint — Envisagez de vendre
        </div>
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-brvm-fg text-sm">{pos.ticker.toUpperCase()}</span>
            {priceAvailable ? (
              <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${
                isGain ? 'bg-brvm-up/10 text-brvm-up' : 'bg-brvm-down/10 text-brvm-down'
              }`}>
                {fmtPct(grossYield)}
              </span>
            ) : (
              <span className="text-xs px-1.5 py-0.5 rounded bg-brvm-card text-brvm-fg-muted">
                Cours non disponible
              </span>
            )}
            {thresholdReached && (
              <span className="text-xs px-1.5 py-0.5 rounded font-bold bg-brvm-warning/10 text-brvm-warning">
                ALERTE
              </span>
            )}
          </div>
          <div className="text-xs text-brvm-fg-muted mt-0.5 truncate">{pos.name}</div>
        </div>

        <div className="text-right shrink-0">
          {priceAvailable ? (
            <>
              <div className={`text-sm font-bold ${isGain ? 'text-brvm-up' : 'text-brvm-down'}`}>
                {pos.gainXOF !== null ? (pos.gainXOF >= 0 ? '+' : '') + fmtXOF(pos.gainXOF) : '—'}
              </div>
              <div className="text-xs text-brvm-fg-muted">{pos.currentValueXOF !== null ? fmtXOF(pos.currentValueXOF) : '—'}</div>
            </>
          ) : (
            <div className="text-xs text-brvm-fg-muted italic">Pas de cotation</div>
          )}
        </div>
      </div>

      {/* Métriques de la position */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
        <MetricMini label="Prix d'entrée" value={fmtXOF(pos.acquisitionPrice)} />
        <MetricMini
          label="Cours actuel"
          value={priceAvailable && pos.currentPrice !== null ? fmtXOF(pos.currentPrice) : 'N/D'}
          highlight={priceAvailable ? (isGain ? 'up' : 'down') : undefined}
        />
        <MetricMini label="Quantité" value={`${pos.quantity} titre${pos.quantity > 1 ? 's' : ''}`} />
        <MetricMini
          label="Annualisé"
          value={priceAvailable && pos.annualizedYieldPct !== null ? `${fmtPct(pos.annualizedYieldPct)}/an` : 'N/D'}
          highlight={priceAvailable && pos.annualizedYieldPct !== null ? (pos.annualizedYieldPct >= 0 ? 'up' : 'down') : undefined}
        />
      </div>

      {/* Coût total d'entrée */}
      <div className="mt-1.5">
        <MetricMini label="Coût total d'entrée" value={fmtXOF(pos.totalCostXOF)} />
      </div>

      {/* Barre progression vers seuil */}
      {thresholdProgress !== null && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-brvm-fg-muted mb-1">
            <span>Progression vers seuil ({yieldThreshold?.toFixed(2)}%)</span>
            <span className={thresholdReached ? 'text-brvm-warning font-bold' : ''}>
              {thresholdProgress.toFixed(0)}%
            </span>
          </div>
          <div className="w-full bg-brvm-bg-soft rounded-full h-1.5 overflow-hidden">
            <div className={`h-full rounded-full transition-all ${thresholdReached ? 'bg-brvm-warning' : 'bg-brvm-accent'}`}
              style={{ width: `${thresholdProgress}%` }} />
          </div>
        </div>
      )}

      {!priceAvailable && (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-brvm-fg-muted bg-brvm-card rounded p-2">
          <Info className="w-3.5 h-3.5 shrink-0" />
          Aucune cotation en base pour {pos.ticker.toUpperCase()}. Le rendement sera affiché après le prochain rafraîchissement des données.
        </div>
      )}

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-brvm-border">
        <div className="text-xs text-brvm-fg-muted">
          <Calendar className="w-3 h-3 inline mr-1" />
          Depuis le {fmtDate(pos.acquisitionDate)}
          {pos.holdingDays && <span className="ml-1">({pos.holdingDays} j)</span>}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => onSell(pos)}
            className="px-2.5 py-1 bg-brvm-down/10 hover:bg-brvm-down/20 text-brvm-down text-xs font-medium rounded-md transition-colors flex items-center gap-1">
            <ArrowUpRight className="w-3 h-3" />
            Vendre
          </button>
          <button onClick={() => onDelete(pos)}
            className="p-1.5 text-brvm-fg-muted hover:text-brvm-down rounded-md transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── History Tab ───────────────────────────────────────────────────────────────

function HistoryTab({ positions, onDelete }: { positions: Position[]; onDelete: (p: Position) => void }) {
  if (positions.length === 0) {
    return (
      <div className="text-center py-16">
        <Eye className="w-12 h-12 text-brvm-fg-muted mx-auto mb-3" />
        <div className="text-brvm-fg-muted text-sm">Aucune position vendue pour l'instant</div>
      </div>
    );
  }

  const totalRealized = positions.reduce((s, p) => s + (p.realizedGainXOF ?? 0), 0);

  return (
    <div className="space-y-3">
      <div className={`brvm-card rounded-lg p-4 flex items-center gap-3 ${totalRealized >= 0 ? 'border-brvm-up/30' : 'border-brvm-down/30'} border`}>
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${totalRealized >= 0 ? 'bg-brvm-up/10' : 'bg-brvm-down/10'}`}>
          {totalRealized >= 0 ? <ArrowUpRight className="w-5 h-5 text-brvm-up" /> : <ArrowDownRight className="w-5 h-5 text-brvm-down" />}
        </div>
        <div>
          <div className="text-xs text-brvm-fg-muted">Total gains réalisés</div>
          <div className={`text-lg font-bold ${totalRealized >= 0 ? 'text-brvm-up' : 'text-brvm-down'}`}>
            {fmtXOF(totalRealized)}
          </div>
        </div>
      </div>

      {positions.map(pos => {
        const realizedGain = pos.realizedGainXOF ?? 0;
        const isGain = realizedGain >= 0;
        const gainPct = pos.totalCostXOF > 0
          ? parseFloat(((realizedGain / pos.totalCostXOF) * 100).toFixed(2))
          : 0;
        return (
          <div key={pos.id} className="brvm-card rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-brvm-fg text-sm">{pos.ticker.toUpperCase()}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${isGain ? 'bg-brvm-up/10 text-brvm-up' : 'bg-brvm-down/10 text-brvm-down'}`}>
                    {fmtPct(gainPct)}
                  </span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-brvm-card text-brvm-fg-muted">VENDU</span>
                </div>
                <div className="text-xs text-brvm-fg-muted mt-0.5">{pos.name}</div>
              </div>
              <div className="text-right">
                <div className={`text-sm font-bold ${isGain ? 'text-brvm-up' : 'text-brvm-down'}`}>
                  {(realizedGain >= 0 ? '+' : '') + fmtXOF(realizedGain)}
                </div>
                <div className="text-xs text-brvm-fg-muted">{fmtXOF(pos.saleTotalXOF ?? 0)}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <MetricMini label="Achat" value={`${fmtXOF(pos.acquisitionPrice)} × ${pos.quantity}`} />
              <MetricMini label="Vente" value={`${fmtXOF(pos.salePrice ?? 0)} le ${pos.saleDate ? fmtDate(pos.saleDate) : '—'}`} />
            </div>
            <div className="flex justify-between items-center mt-2 text-xs text-brvm-fg-muted">
              <span>Acquis le {fmtDate(pos.acquisitionDate)}</span>
              <button onClick={() => onDelete(pos)} className="p-1 hover:text-brvm-down rounded transition-colors">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Config Tab — l'utilisateur saisit le versement mensuel ────────────────────

function ConfigTab({ config, onSaved }: { config: PortfolioConfig | null; onSaved: () => void }) {
  const [targetAmount, setTargetAmount] = useState(String(config?.targetAmountXOF ?? ''));
  const [initialAmount, setInitialAmount] = useState(String(config?.initialAmountXOF ?? ''));
  const [targetYears, setTargetYears] = useState(String(config?.targetYears ?? ''));
  const [monthlyContrib, setMonthlyContrib] = useState(String(config?.monthlyContribXOF ?? ''));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  // Prévisualisation du rendement requis en temps réel (approximation linéaire)
  const previewYield = (() => {
    const target = parseFloat(targetAmount);
    const initial = parseFloat(initialAmount) || 0;
    const years = parseInt(targetYears);
    const monthly = parseFloat(monthlyContrib);

    if (!target || target <= 0 || !years || years < 1 || !monthly || monthly <= 0) return null;

    const months = years * 12;
    const pureSavings = initial + monthly * months;
    if (pureSavings >= target) return { pct: 0, feasible: true, message: 'Votre épargne seule suffit à atteindre l\'objectif !' };

    // Estimation rapide via bisection (JS client-side)
    let low = 0, high = 2, mid = 0.1;
    for (let i = 0; i < 150; i++) {
      mid = (low + high) / 2;
      const r = mid / 12;
      const fv = r === 0 ? initial + monthly * months : initial * Math.pow(1 + r, months) + monthly * (Math.pow(1 + r, months) - 1) / r;
      if (Math.abs(fv - target) < 100) break;
      if (fv < target) low = mid;
      else high = mid;
    }
    const pct = parseFloat((mid * 100).toFixed(2));
    return {
      pct,
      feasible: pct <= 50,
      message: pct > 50 ? `Taux irréaliste (${pct.toFixed(1)}%/an) — augmentez le versement mensuel.` : null,
    };
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/portfolio/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetAmountXOF: parseFloat(targetAmount),
          initialAmountXOF: parseFloat(initialAmount) || 0,
          targetYears: parseInt(targetYears),
          monthlyContribXOF: parseFloat(monthlyContrib),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Erreur lors de la sauvegarde'); return; }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      onSaved();
    } catch { setError('Erreur réseau'); }
    finally { setSaving(false); }
  };

  return (
    <div className="max-w-lg mx-auto">
      <div className="brvm-card rounded-lg p-6">
        <div className="flex items-center gap-2 mb-5">
          <Target className="w-5 h-5 text-brvm-accent" />
          <h2 className="font-bold text-brvm-fg">Objectif financier</h2>
        </div>

        {/* Config actuelle */}
        {config && (
          <div className="mb-5 p-3 bg-brvm-accent/10 border border-brvm-accent/30 rounded-lg">
            <div className="text-xs font-semibold text-brvm-accent mb-2">Configuration actuelle</div>
            <div className="grid grid-cols-2 gap-2">
              <InfoChip label="Versement mensuel" value={fmtXOF(config.monthlyContribXOF)} color="accent" />
              <InfoChip
                label="Rendement requis (calculé)"
                value={`${config.yieldThresholdPct.toFixed(2)}%/an`}
                color={config.yieldThresholdPct > 30 ? 'danger' : config.yieldThresholdPct > 15 ? 'warning' : 'up'}
              />
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField id="targetAmount" label="Montant cible à atteindre (XOF)" type="number"
            value={targetAmount} onChange={setTargetAmount} placeholder="Ex: 10 000 000" min="1" />
          <FormField id="initialAmount" label="Capital de départ (XOF)" type="number"
            value={initialAmount} onChange={setInitialAmount} placeholder="Ex: 500 000 (0 si aucun)" min="0" />
          <FormField id="targetYears" label="Durée cible (années)" type="number"
            value={targetYears} onChange={setTargetYears} placeholder="Ex: 5" min="1" max="50" />

          {/* Versement mensuel — saisi par l'utilisateur */}
          <div>
            <label htmlFor="monthlyContrib" className="block text-xs text-brvm-fg-muted mb-1">
              Votre versement mensuel (XOF)
              <span className="ml-1 text-brvm-accent font-medium">— vous décidez du montant</span>
            </label>
            <input
              id="monthlyContrib"
              type="number"
              value={monthlyContrib}
              onChange={e => setMonthlyContrib(e.target.value)}
              placeholder="Ex: 150 000"
              min="1"
              className="w-full bg-brvm-bg-soft border border-brvm-accent/50 rounded-lg px-3 py-2 text-sm text-brvm-fg placeholder-brvm-fg-muted focus:outline-none focus:border-brvm-accent transition-colors"
            />
          </div>

          {/* Prévisualisation du rendement requis */}
          {previewYield !== null && (
            <div className={`p-3 rounded-lg border text-xs space-y-1 ${
              !previewYield.feasible
                ? 'bg-brvm-down/10 border-brvm-down/30'
                : previewYield.pct > 15
                  ? 'bg-brvm-warning/10 border-brvm-warning/30'
                  : 'bg-brvm-up/10 border-brvm-up/20'
            }`}>
              <div className="font-semibold text-brvm-fg-muted mb-1">Rendement annuel requis calculé par l'app</div>
              <div className="flex items-center justify-between">
                <span className="text-brvm-fg-muted">Taux nécessaire pour atteindre l'objectif</span>
                <span className={`text-xl font-bold ${
                  !previewYield.feasible ? 'text-brvm-down' :
                  previewYield.pct > 15 ? 'text-brvm-warning' : 'text-brvm-up'
                }`}>
                  {previewYield.pct === 0 ? '0%' : `${previewYield.pct.toFixed(2)}%/an`}
                </span>
              </div>
              {previewYield.message && (
                <div className={`flex items-center gap-1 ${!previewYield.feasible ? 'text-brvm-down' : 'text-brvm-up'}`}>
                  {!previewYield.feasible
                    ? <AlertTriangle className="w-3 h-3 shrink-0" />
                    : <CheckCircle2 className="w-3 h-3 shrink-0" />}
                  {previewYield.message}
                </div>
              )}
              <div className="text-brvm-fg-muted mt-1">
                Ce taux sera utilisé comme seuil d'alerte pour vos positions.
              </div>
            </div>
          )}

          {error && (
            <div className="p-2 bg-brvm-down/10 border border-brvm-down/30 rounded text-xs text-brvm-down">{error}</div>
          )}

          <button type="submit" disabled={saving || (previewYield !== null && !previewYield.feasible)}
            className="w-full py-2.5 bg-brvm-accent hover:bg-brvm-accent-soft disabled:opacity-50 text-brvm-bg font-bold text-sm rounded-lg transition-colors flex items-center justify-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle2 className="w-4 h-4" /> : <Settings className="w-4 h-4" />}
            {saving ? 'Calcul en cours...' : saved ? 'Sauvegardé !' : 'Sauvegarder la configuration'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Modal : Ajouter position (avec sélecteur ticker recherchable) ─────────────

function AddPositionModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [selectedStock, setSelectedStock] = useState<StockMeta | null>(null);
  const [tickerSearch, setTickerSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [acqDate, setAcqDate] = useState(new Date().toISOString().slice(0, 10));
  const [acqPrice, setAcqPrice] = useState('');
  const [qty, setQty] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filtrage des actions BRVM selon la saisie
  const filteredStocks = tickerSearch.length >= 1
    ? BRVM_STOCKS.filter(s =>
        s.ticker.toLowerCase().includes(tickerSearch.toLowerCase()) ||
        s.name.toLowerCase().includes(tickerSearch.toLowerCase()) ||
        s.country.toLowerCase().includes(tickerSearch.toLowerCase()) ||
        s.sector.toLowerCase().includes(tickerSearch.toLowerCase())
      ).slice(0, 10)
    : BRVM_STOCKS.slice(0, 10);

  // Fermer le dropdown en cliquant ailleurs
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectStock = (stock: StockMeta) => {
    setSelectedStock(stock);
    setTickerSearch(stock.ticker);
    setShowDropdown(false);
  };

  const totalCost = (parseFloat(acqPrice) || 0) * (parseInt(qty) || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStock) { setError('Veuillez sélectionner une action dans la liste.'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/portfolio/positions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker: selectedStock.ticker,
          acquisitionDate: acqDate,
          acquisitionPrice: parseFloat(acqPrice),
          quantity: parseInt(qty),
          notes: notes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Erreur'); return; }
      onSaved();
    } catch { setError('Erreur réseau'); }
    finally { setSaving(false); }
  };

  return (
    <Modal title="Nouvelle position" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Sélecteur ticker avec recherche */}
        <div ref={dropdownRef} className="relative">
          <label className="block text-xs text-brvm-fg-muted mb-1">
            Action BRVM <span className="text-brvm-fg-muted">(recherche par nom, ticker, pays, secteur)</span>
          </label>
          <div className={`relative flex items-center border rounded-lg transition-colors ${
            showDropdown ? 'border-brvm-accent' : 'border-brvm-border'
          } bg-brvm-bg-soft`}>
            <Search className="w-4 h-4 text-brvm-fg-muted ml-3 shrink-0" />
            <input
              type="text"
              value={tickerSearch}
              onChange={e => { setTickerSearch(e.target.value); setShowDropdown(true); setSelectedStock(null); }}
              onFocus={() => setShowDropdown(true)}
              placeholder="Rechercher une action (ex: BOA, Banque, Sénégal...)"
              className="w-full bg-transparent px-3 py-2.5 text-sm text-brvm-fg placeholder-brvm-fg-muted focus:outline-none"
              autoComplete="off"
            />
            <ChevronDown className={`w-4 h-4 text-brvm-fg-muted mr-3 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
          </div>

          {/* Dropdown résultats */}
          {showDropdown && (
            <div className="absolute z-50 w-full mt-1 bg-brvm-card border border-brvm-border rounded-lg shadow-2xl overflow-hidden max-h-64 overflow-y-auto">
              {filteredStocks.length === 0 ? (
                <div className="px-4 py-3 text-xs text-brvm-fg-muted text-center">
                  Aucune action trouvée pour "{tickerSearch}"
                </div>
              ) : (
                filteredStocks.map(stock => (
                  <button
                    key={stock.ticker}
                    type="button"
                    onClick={() => selectStock(stock)}
                    className="w-full text-left px-4 py-2.5 hover:bg-brvm-bg-soft transition-colors flex items-center gap-3"
                  >
                    <span className="text-lg">{stock.flag}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-brvm-accent font-mono">{stock.ticker.toUpperCase()}</span>
                        <span className="text-xs bg-brvm-bg-soft text-brvm-fg-muted px-1.5 py-0.5 rounded">{stock.sector}</span>
                      </div>
                      <div className="text-xs text-brvm-fg truncate mt-0.5">{stock.name}</div>
                    </div>
                    <span className="text-xs text-brvm-fg-muted shrink-0">{stock.countryName}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Aperçu de l'action sélectionnée */}
        {selectedStock && (
          <div className="flex items-center gap-3 p-3 bg-brvm-accent/10 border border-brvm-accent/30 rounded-lg">
            <span className="text-2xl">{selectedStock.flag}</span>
            <div>
              <div className="text-xs font-bold text-brvm-accent">{selectedStock.ticker.toUpperCase()}</div>
              <div className="text-xs text-brvm-fg font-medium">{selectedStock.name}</div>
              <div className="text-xs text-brvm-fg-muted">{selectedStock.sector} • {selectedStock.countryName}</div>
            </div>
          </div>
        )}

        <FormField id="add-date" label="Date d'acquisition" type="date" value={acqDate} onChange={setAcqDate} />
        <FormField id="add-price" label="Prix unitaire à l'achat (XOF)" type="number"
          value={acqPrice} onChange={setAcqPrice} placeholder="Ex: 5 000" min="0" />
        <FormField id="add-qty" label="Quantité (nombre de titres)" type="number"
          value={qty} onChange={setQty} placeholder="Ex: 100" min="1" />

        {totalCost > 0 && (
          <div className="p-2 bg-brvm-card rounded text-xs text-brvm-fg-muted text-center">
            Coût total : <span className="text-brvm-accent font-bold">{fmtXOF(totalCost)}</span>
          </div>
        )}

        <FormField id="add-notes" label="Notes (optionnel)" value={notes} onChange={setNotes}
          placeholder="Ex: achat long terme..." />

        {error && <div className="text-xs text-brvm-down p-2 bg-brvm-down/10 rounded">{error}</div>}

        <button type="submit" disabled={saving || !selectedStock}
          className="w-full py-2.5 bg-brvm-accent hover:bg-brvm-accent-soft disabled:opacity-50 text-brvm-bg font-bold text-sm rounded-lg transition-colors flex items-center justify-center gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          {saving ? 'Enregistrement...' : 'Ajouter la position'}
        </button>
      </form>
    </Modal>
  );
}

// ── Modal : Vendre une position ───────────────────────────────────────────────

function SellPositionModal({ position, onClose, onSaved }: { position: Position; onClose: () => void; onSaved: () => void }) {
  const [saleDate, setSaleDate] = useState(new Date().toISOString().slice(0, 10));
  const [salePrice, setSalePrice] = useState(
    String(position.currentPrice ?? position.acquisitionPrice)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const salePriceNum = parseFloat(salePrice) || 0;
  const saleTotal = salePriceNum * position.quantity;
  const gain = saleTotal - position.totalCostXOF;
  const gainPct = position.totalCostXOF > 0 ? (gain / position.totalCostXOF) * 100 : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/portfolio/positions/${position.id}/sell`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ saleDate, salePrice: salePriceNum }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Erreur'); return; }
      onSaved();
    } catch { setError('Erreur réseau'); }
    finally { setSaving(false); }
  };

  return (
    <Modal title={`Vendre ${position.ticker.toUpperCase()}`} onClose={onClose}>
      <div className="mb-4 p-3 bg-brvm-card rounded-lg text-xs space-y-1">
        <div className="text-brvm-fg font-medium">{position.name}</div>
        <div className="flex justify-between text-brvm-fg-muted">
          <span>Prix d'entrée</span>
          <span className="font-medium text-brvm-fg">{fmtXOF(position.acquisitionPrice)}</span>
        </div>
        {position.currentPrice && (
          <div className="flex justify-between text-brvm-fg-muted">
            <span>Cours actuel</span>
            <span className="font-medium text-brvm-accent">{fmtXOF(position.currentPrice)}</span>
          </div>
        )}
        <div className="flex justify-between text-brvm-fg-muted">
          <span>Quantité</span>
          <span className="font-medium text-brvm-fg">{position.quantity} titre{position.quantity > 1 ? 's' : ''}</span>
        </div>
        <div className="flex justify-between text-brvm-fg-muted">
          <span>Coût total d'entrée</span>
          <span className="font-medium text-brvm-fg">{fmtXOF(position.totalCostXOF)}</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField id="sell-date" label="Date de vente" type="date" value={saleDate} onChange={setSaleDate} />
        <FormField id="sell-price" label="Prix de vente unitaire (XOF)" type="number"
          value={salePrice} onChange={setSalePrice} placeholder="Ex: 5 500" min="0" />

        {saleTotal > 0 && (
          <div className={`p-3 rounded-lg text-xs space-y-1 ${gain >= 0 ? 'bg-brvm-up/10 border border-brvm-up/20' : 'bg-brvm-down/10 border border-brvm-down/20'}`}>
            <div className="flex justify-between">
              <span className="text-brvm-fg-muted">Montant de vente</span>
              <span className="text-brvm-fg font-medium">{fmtXOF(saleTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-brvm-fg-muted">Gain / Perte réalisé</span>
              <span className={`font-bold ${gain >= 0 ? 'text-brvm-up' : 'text-brvm-down'}`}>
                {gain >= 0 ? '+' : ''}{fmtXOF(gain)} ({fmtPct(gainPct)})
              </span>
            </div>
          </div>
        )}

        {error && <div className="text-xs text-brvm-down p-2 bg-brvm-down/10 rounded">{error}</div>}

        <button type="submit" disabled={saving}
          className="w-full py-2.5 bg-brvm-down/80 hover:bg-brvm-down disabled:opacity-50 text-white font-bold text-sm rounded-lg transition-colors flex items-center justify-center gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUpRight className="w-4 h-4" />}
          {saving ? 'Enregistrement...' : 'Confirmer la vente'}
        </button>
      </form>
    </Modal>
  );
}

// ── Modal : Confirmer suppression ─────────────────────────────────────────────

function ConfirmDeleteModal({ position, onClose, onConfirm }: {
  position: Position; onClose: () => void; onConfirm: () => void;
}) {
  return (
    <Modal title="Supprimer la position" onClose={onClose}>
      <p className="text-sm text-brvm-fg-muted mb-4">
        Supprimer <strong className="text-brvm-fg">{position.ticker.toUpperCase()}</strong> ({position.name}) ?
        Cette action est irréversible.
      </p>
      <div className="flex gap-2">
        <button onClick={onClose}
          className="flex-1 py-2 text-sm text-brvm-fg-muted border border-brvm-border rounded-lg hover:bg-brvm-card transition-colors">
          Annuler
        </button>
        <button onClick={onConfirm}
          className="flex-1 py-2 text-sm font-bold text-white bg-brvm-down hover:bg-brvm-down/80 rounded-lg transition-colors">
          Supprimer
        </button>
      </div>
    </Modal>
  );
}

// ── Primitives UI ─────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-brvm-card border border-brvm-border rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-brvm-fg">{title}</h3>
          <button onClick={onClose} className="text-brvm-fg-muted hover:text-brvm-fg text-xl leading-none">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function KpiCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string; sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  color: 'accent' | 'up' | 'down' | 'warning' | 'neutral';
}) {
  const colors: Record<string, string> = {
    accent: 'text-brvm-accent', up: 'text-brvm-up', down: 'text-brvm-down',
    warning: 'text-brvm-warning', neutral: 'text-brvm-fg',
  };
  return (
    <div className="brvm-card rounded-lg p-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className={`w-3.5 h-3.5 ${colors[color]}`} />
        <span className="text-xs text-brvm-fg-muted">{label}</span>
      </div>
      <div className={`text-base font-bold ${colors[color]}`}>{value}</div>
      {sub && <div className="text-xs text-brvm-fg-muted mt-0.5">{sub}</div>}
    </div>
  );
}

function MetricMini({ label, value, highlight }: { label: string; value: string; highlight?: 'up' | 'down' }) {
  const color = highlight === 'up' ? 'text-brvm-up' : highlight === 'down' ? 'text-brvm-down' : 'text-brvm-fg';
  return (
    <div className="bg-brvm-bg-soft rounded p-2">
      <div className="text-xs text-brvm-fg-muted">{label}</div>
      <div className={`text-xs font-medium mt-0.5 ${color}`}>{value}</div>
    </div>
  );
}

function InfoChip({ label, value, color }: {
  label: string; value: string;
  color?: 'accent' | 'warning' | 'up' | 'danger';
}) {
  const c = color === 'accent' ? 'text-brvm-accent'
    : color === 'warning' ? 'text-brvm-warning'
    : color === 'up' ? 'text-brvm-up'
    : color === 'danger' ? 'text-brvm-down'
    : 'text-brvm-fg';
  return (
    <div className="bg-brvm-bg-soft rounded p-2 text-center">
      <div className="text-xs text-brvm-fg-muted">{label}</div>
      <div className={`text-sm font-bold mt-0.5 ${c}`}>{value}</div>
    </div>
  );
}

function FormField({ id, label, value, onChange, type = 'text', placeholder, min, max }: {
  id: string; label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; min?: string; max?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs text-brvm-fg-muted mb-1">{label}</label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        min={min}
        max={max}
        className="w-full bg-brvm-bg-soft border border-brvm-border rounded-lg px-3 py-2 text-sm text-brvm-fg placeholder-brvm-fg-muted focus:outline-none focus:border-brvm-accent transition-colors"
      />
    </div>
  );
}
