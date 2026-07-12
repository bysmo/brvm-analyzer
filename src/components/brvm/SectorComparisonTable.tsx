'use client';

import { useEffect, useState, Fragment } from 'react';
import { Building2, TrendingUp, TrendingDown, Minus, Loader2, Star } from 'lucide-react';

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

interface SectorCompany {
  ticker: string;
  name: string;
  flag: string;
  country: string;
  isCurrent: boolean;
  fundamentals: FundamentalYear[];
}

interface SectorAverage {
  year: number;
  bnpa: number | null;
  per: number | null;
  dividende: number | null;
}

interface SectorComparisonData {
  sector: string;
  currentTicker: string;
  companies: SectorCompany[];
  years: number[];
  averages: SectorAverage[];
  fetchedAt: string;
}

interface Props {
  ticker: string;
  sector: string;
}

function fmtNum(n: number | null | undefined, decimals = 2): string {
  if (n == null || n === 0 || isNaN(n)) return '—';
  return n.toLocaleString('fr-FR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtInt(n: number | null | undefined): string {
  if (n == null || n === 0 || isNaN(n)) return '—';
  return Math.round(n).toLocaleString('fr-FR');
}

// Couleurs par indicateur
const INDICATOR_COLORS = {
  bnpa: '#B47CFF',
  per: '#4DA3FF',
  dividende: '#FFA500',
};

export function SectorComparisonTable({ ticker, sector }: Props) {
  const [data, setData] = useState<SectorComparisonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/brvm/sector-comparison/${encodeURIComponent(ticker)}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const d = await res.json();
        if (d.error) throw new Error(d.error);
        setData(d);
        setLoading(false);
      } catch (e: any) {
        if (e.name === 'AbortError') return;
        setError(e.message);
        setLoading(false);
      }
    }

    load();
    return () => controller.abort();
  }, [ticker]);

  if (loading) {
    return (
      <div className="brvm-card rounded-lg p-6 mt-4">
        <div className="flex items-center gap-3 text-brvm-fg-muted">
          <Loader2 className="w-5 h-5 animate-spin text-brvm-accent" />
          <div>
            <div className="font-semibold text-brvm-fg">Chargement de la comparaison sectorielle...</div>
            <div className="text-xs">Récupération des fondamentaux de toutes les actions du secteur "{sector}"</div>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <div className="shimmer h-8 rounded" />
          <div className="shimmer h-8 rounded" />
          <div className="shimmer h-8 rounded" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="brvm-card rounded-lg p-4 mt-4 border-l-4 border-brvm-warning">
        <div className="text-sm text-brvm-fg">
          ⚠ Comparaison sectorielle indisponible: <span className="text-brvm-fg-muted">{error}</span>
        </div>
      </div>
    );
  }

  if (!data || data.companies.length === 0) {
    return (
      <div className="brvm-card rounded-lg p-4 mt-4 text-sm text-brvm-fg-muted">
        Aucune donnée sectorielle disponible.
      </div>
    );
  }

  const { companies, years, averages } = data;

  // Trie les entreprises: current d'abord, puis par ordre alphabétique
  const sortedCompanies = [...companies].sort((a, b) => {
    if (a.isCurrent && !b.isCurrent) return -1;
    if (!a.isCurrent && b.isCurrent) return 1;
    return a.name.localeCompare(b.name);
  });

  // Helper: récupère la valeur d'un indicateur pour une entreprise et une année
  function getValue(company: SectorCompany, year: number, indicator: 'bnpa' | 'per' | 'dividende'): number | null {
    const f = company.fundamentals.find(f => f.year === year);
    if (!f) return null;
    if (indicator === 'bnpa') return f.bnpa > 0 ? f.bnpa : null;
    if (indicator === 'per') return f.per > 0 && f.per < 200 ? f.per : null;
    if (indicator === 'dividende') return f.dividende > 0 ? f.dividende : null;
    return null;
  }

  function getAverage(year: number, indicator: 'bnpa' | 'per' | 'dividende'): number | null {
    const a = averages.find(a => a.year === year);
    if (!a) return null;
    return a[indicator];
  }

  // Détermine la classe de couleur d'une cellule selon la valeur vs moyenne
  function cellColorClass(value: number | null, avg: number | null, indicator: 'bnpa' | 'per' | 'dividende'): string {
    if (value == null || avg == null || avg <= 0) return 'text-brvm-fg-dim';
    // Pour BNPA et Dividende: plus c'est haut, mieux c'est
    // Pour PER: plus c'est bas, mieux c'est
    const isAbove = value > avg;
    const isGood = indicator === 'per' ? !isAbove : isAbove;
    if (Math.abs(value - avg) / avg < 0.05) return 'text-brvm-fg';  // ~égal à la moyenne
    return isGood ? 'text-brvm-up' : 'text-brvm-down';
  }

  function cellBgClass(value: number | null, avg: number | null, indicator: 'bnpa' | 'per' | 'dividende'): string {
    if (value == null || avg == null || avg <= 0) return '';
    if (Math.abs(value - avg) / avg < 0.05) return '';
    const isAbove = value > avg;
    const isGood = indicator === 'per' ? !isAbove : isAbove;
    return isGood ? 'bg-brvm-up/8' : 'bg-brvm-down/8';
  }

  function formatValue(value: number | null, indicator: 'bnpa' | 'per' | 'dividende'): string {
    if (value == null) return '—';
    if (indicator === 'per') return fmtNum(value, 2);
    return fmtInt(value);
  }

  // Label année: n-5, n-4, ..., n
  function yearLabel(year: number, years: number[]): string {
    const idx = years.indexOf(year);
    const fromEnd = years.length - 1 - idx;
    if (fromEnd === 0) return `${year} (n)`;
    return `${year} (n-${fromEnd})`;
  }

  return (
    <div className="brvm-card rounded-lg p-4 mt-4">
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <Building2 className="w-4 h-4 text-brvm-info" />
        <h3 className="text-sm font-semibold text-brvm-fg uppercase tracking-wider">
          Comparaison sectorielle — {sector}
        </h3>
        <span className="text-xs text-brvm-fg-muted">·</span>
        <span className="text-xs text-brvm-fg-muted">{companies.length} entreprises</span>
      </div>
      <div className="text-xs text-brvm-fg-muted mb-3">
        Pour chaque année: BNPA (XOF), PER, Dividende (XOF) — comparés à la moyenne sectorielle
      </div>

      <div className="overflow-x-auto rounded border border-brvm-border">
        <table className="brvm-table w-full" style={{ minWidth: `${years.length * 210 + 240}px` }}>
          <thead>
            {/* Ligne 1: Entreprise + années */}
            <tr className="bg-brvm-bg-soft border-b border-brvm-border">
              <th
                rowSpan={2}
                className="text-left py-2 px-3 sticky left-0 bg-brvm-bg-soft z-20 min-w-[240px] align-bottom border-r border-brvm-border"
              >
                <div className="text-xs">Entreprise</div>
              </th>
              {years.map(y => (
                <th
                  key={y}
                  colSpan={3}
                  className="text-center py-2 px-1 min-w-[210px] border-l border-r border-brvm-border"
                  style={{ backgroundColor: 'rgba(77, 163, 255, 0.05)' }}
                >
                  <div className="font-mono text-sm text-brvm-fg">{yearLabel(y, years)}</div>
                </th>
              ))}
            </tr>
            {/* Ligne 2: sous-colonnes BNPA / PER / DIV */}
            <tr className="bg-brvm-bg-soft border-b-2 border-brvm-accent">
              {years.map(y => (
                <Fragment key={`subhead-${y}`}>
                  <th
                    className="text-right py-1.5 px-2 text-xs font-semibold border-l border-brvm-border"
                    style={{ color: INDICATOR_COLORS.bnpa, backgroundColor: 'rgba(180, 124, 255, 0.05)', minWidth: '60px' }}
                  >
                    BNPA
                  </th>
                  <th
                    className="text-right py-1.5 px-2 text-xs font-semibold"
                    style={{ color: INDICATOR_COLORS.per, backgroundColor: 'rgba(77, 163, 255, 0.05)', minWidth: '60px' }}
                  >
                    PER
                  </th>
                  <th
                    className="text-right py-1.5 px-2 text-xs font-semibold border-r border-brvm-border"
                    style={{ color: INDICATOR_COLORS.dividende, backgroundColor: 'rgba(255, 165, 0, 0.05)', minWidth: '60px' }}
                  >
                    DIV
                  </th>
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Ligne 3: Moyennes sectorielles */}
            <tr className="border-b-2 border-brvm-accent bg-brvm-accent/10 font-bold">
              <td className="py-2 px-3 sticky left-0 z-10 bg-brvm-accent/10 border-r border-brvm-border">
                <div className="flex items-center gap-1.5">
                  <Minus className="w-3 h-3 text-brvm-accent" />
                  <span className="text-sm text-brvm-accent uppercase tracking-wider">
                    Moyenne secteur
                  </span>
                </div>
              </td>
              {years.map(y => {
                const avgBnpa = getAverage(y, 'bnpa');
                const avgPer = getAverage(y, 'per');
                const avgDiv = getAverage(y, 'dividende');
                return (
                  <Fragment key={`avg-${y}`}>
                    <td
                      className="py-2 px-2 text-right font-mono text-sm border-l border-brvm-border"
                      style={{ color: INDICATOR_COLORS.bnpa, backgroundColor: 'rgba(180, 124, 255, 0.08)' }}
                    >
                      {formatValue(avgBnpa, 'bnpa')}
                    </td>
                    <td
                      className="py-2 px-2 text-right font-mono text-sm"
                      style={{ color: INDICATOR_COLORS.per, backgroundColor: 'rgba(77, 163, 255, 0.08)' }}
                    >
                      {formatValue(avgPer, 'per')}
                    </td>
                    <td
                      className="py-2 px-2 text-right font-mono text-sm border-r border-brvm-border"
                      style={{ color: INDICATOR_COLORS.dividende, backgroundColor: 'rgba(255, 165, 0, 0.08)' }}
                    >
                      {formatValue(avgDiv, 'dividende')}
                    </td>
                  </Fragment>
                );
              })}
            </tr>

            {/* Lignes 4+: Liste des entreprises */}
            {sortedCompanies.map(c => (
              <tr
                key={c.ticker}
                className={`border-b border-brvm-border/30 ${c.isCurrent ? 'bg-brvm-accent/5' : 'hover:bg-brvm-card-hover/30'}`}
              >
                <td
                  className={`py-2 px-3 sticky left-0 z-10 border-r border-brvm-border ${
                    c.isCurrent ? 'bg-brvm-accent/10' : 'bg-inherit'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">{c.flag}</span>
                    <div className="min-w-0">
                      <div className={`text-sm truncate ${c.isCurrent ? 'font-bold text-brvm-accent' : 'font-medium text-brvm-fg'}`}>
                        {c.name}
                        {c.isCurrent && <span className="ml-1.5 text-xs text-brvm-accent">(cette action)</span>}
                      </div>
                      <div className="text-xs text-brvm-fg-muted font-mono">{c.ticker}</div>
                    </div>
                  </div>
                </td>
                {years.map(y => {
                  const vBnpa = getValue(c, y, 'bnpa');
                  const vPer = getValue(c, y, 'per');
                  const vDiv = getValue(c, y, 'dividende');
                  const avgBnpa = getAverage(y, 'bnpa');
                  const avgPer = getAverage(y, 'per');
                  const avgDiv = getAverage(y, 'dividende');
                  return (
                    <Fragment key={`${c.ticker}-${y}`}>
                      <td
                        className={`py-2 px-2 text-right font-mono text-sm border-l border-brvm-border ${cellColorClass(vBnpa, avgBnpa, 'bnpa')} ${cellBgClass(vBnpa, avgBnpa, 'bnpa')}`}
                      >
                        {formatValue(vBnpa, 'bnpa')}
                      </td>
                      <td
                        className={`py-2 px-2 text-right font-mono text-sm ${cellColorClass(vPer, avgPer, 'per')} ${cellBgClass(vPer, avgPer, 'per')}`}
                      >
                        {formatValue(vPer, 'per')}
                      </td>
                      <td
                        className={`py-2 px-2 text-right font-mono text-sm border-r border-brvm-border ${cellColorClass(vDiv, avgDiv, 'dividende')} ${cellBgClass(vDiv, avgDiv, 'dividende')}`}
                      >
                        {formatValue(vDiv, 'dividende')}
                      </td>
                    </Fragment>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Légende */}
      <div className="mt-3 flex items-center gap-4 flex-wrap text-xs">
        <div className="flex items-center gap-1 text-brvm-fg-muted">
          <span className="inline-block w-2 h-2 rounded-sm bg-brvm-up/40"></span>
          <span>= favorable vs moyenne (BNPA↑, PER↓, DIV↑)</span>
        </div>
        <div className="flex items-center gap-1 text-brvm-fg-muted">
          <span className="inline-block w-2 h-2 rounded-sm bg-brvm-down/40"></span>
          <span>= défavorable vs moyenne</span>
        </div>
        <div className="flex items-center gap-1 text-brvm-fg-muted">
          <span className="font-bold" style={{ color: INDICATOR_COLORS.bnpa }}>BNPA</span>
          <span>= Bénéfice Net Par Action (XOF)</span>
        </div>
        <div className="flex items-center gap-1 text-brvm-fg-muted">
          <span className="font-bold" style={{ color: INDICATOR_COLORS.per }}>PER</span>
          <span>= Price Earnings Ratio</span>
        </div>
        <div className="flex items-center gap-1 text-brvm-fg-muted">
          <span className="font-bold" style={{ color: INDICATOR_COLORS.dividende }}>DIV</span>
          <span>= Dividende par action (XOF)</span>
        </div>
      </div>

      {/* Note explicative */}
      <div className="mt-2 text-xs text-brvm-fg-dim italic border-t border-brvm-border pt-2">
        💡 Lecture: une valeur <span className="text-brvm-up">verte</span> signifie que l'indicateur est meilleur que la moyenne sectorielle (BNPA↑, PER↓, DIV↑).
        La ligne <span className="text-brvm-accent font-semibold">Moyenne secteur</span> en haut permet de comparer chaque entreprise au benchmark de son secteur pour chaque année.
      </div>
    </div>
  );
}
