'use client';

import { useState, useEffect } from 'react';
import { X, Plus, GitCompare } from 'lucide-react';
import { StockSelector, type StockListItem } from './StockSelector';

interface CompareResult {
  stock: {
    ticker: string;
    meta: {
      name: string;
      isin: string;
      country: string;
      countryName: string;
      sector: string;
      flag: string;
    };
    quote: {
      price: number;
      variation: number;
      volumeTitres: number;
      volumeXOF: number;
      valorisation: number;
      capitalEchange: number;
    };
    dividends: { year: number; amount: number; yield: number }[];
    shareholders: { name: string; percentage: number; type: string }[];
    fundamentals: {
      year: number;
      chiffreAffaires: number;
      resultatNet: number;
      bnpa: number;
      per: number;
      dividende: number;
    }[];
    company: {
      nombreTitres: number;
      flottant: number;
    };
  };
  analysis: {
    liquidity: { score: number; level: string; color: string };
    fundamentals: { score: number };
    dynamism: {
      score: number;
      per: number;
      perSectoriel: number | null;
      perVsSecteur: string;
      dpa: number;
      dpaSectoriel: number | null;
      dpaVsSecteur: string;
    };
    shareholders: { pctLocal: number; pctEtranger: number; exportDevises: string };
    verdict: { scoreGlobal: number; recommandation: string; couleur: string };
  };
}

interface Props {
  stocks: StockListItem[];
  open: boolean;
  onClose: () => void;
}

export function CompareModal({ stocks, open, onClose }: Props) {
  const [selected, setSelected] = useState<string[]>(['BOAB.bj', 'SNTS.sn']);
  const [results, setResults] = useState<CompareResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newTicker, setNewTicker] = useState('');

  useEffect(() => {
    if (!open || selected.length === 0) return;
    
    const controller = new AbortController();
    
    async function load() {
      setLoading(true);
      try {
        const res = await fetch('/api/brvm/compare', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tickers: selected }),
          signal: controller.signal,
        });
        const d = await res.json();
        if (d.results) setResults(d.results);
        setLoading(false);
      } catch (e: any) {
        if (e.name === 'AbortError') return;
        setLoading(false);
      }
    }
    
    load();
    
    return () => controller.abort();
  }, [open, selected.join(',')]);

  if (!open) return null;

  const handleAdd = (ticker: string) => {
    if (selected.length >= 4) return;
    if (!selected.includes(ticker)) {
      setSelected([...selected, ticker]);
    }
    setAdding(false);
    setNewTicker('');
  };

  const handleRemove = (ticker: string) => {
    setSelected(selected.filter(t => t !== ticker));
  };

  // Trouve la meilleure valeur pour chaque critère
  const bestLiquidity = Math.max(...results.map(r => r.analysis.liquidity.score || 0));
  const bestFundamentals = Math.max(...results.map(r => r.analysis.fundamentals.score || 0));
  const bestDynamism = Math.max(...results.map(r => r.analysis.dynamism.score || 0));
  const bestVerdict = Math.max(...results.map(r => r.analysis.verdict.scoreGlobal || 0));
  const lowestPer = Math.min(...results.map(r => r.analysis.dynamism.per > 0 ? r.analysis.dynamism.per : Infinity));
  const highestDpa = Math.max(...results.map(r => r.analysis.dynamism.dpa || 0));

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-brvm-card border border-brvm-border rounded-lg w-full max-w-7xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-brvm-border">
          <div className="flex items-center gap-2">
            <GitCompare className="w-5 h-5 text-brvm-accent" />
            <h2 className="font-bold text-brvm-fg">Comparaison d'actions</h2>
            <span className="text-xs text-brvm-fg-muted">({selected.length}/4)</span>
          </div>
          <button onClick={onClose} className="text-brvm-fg-muted hover:text-brvm-fg">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-4 border-b border-brvm-border flex items-center gap-2 flex-wrap">
          {selected.map(t => {
            const meta = stocks.find(s => s.ticker === t);
            return (
              <div key={t} className="flex items-center gap-2 px-3 py-1.5 bg-brvm-bg-soft border border-brvm-border rounded">
                <span>{meta?.flag}</span>
                <span className="text-sm font-semibold text-brvm-fg">{meta?.name || t}</span>
                <button onClick={() => handleRemove(t)} className="text-brvm-fg-muted hover:text-brvm-danger">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
          {selected.length < 4 && (
            <>
              {adding ? (
                <div className="w-64">
                  <StockSelector
                    stocks={stocks}
                    value={newTicker}
                    onChange={handleAdd}
                  />
                </div>
              ) : (
                <button
                  onClick={() => setAdding(true)}
                  className="flex items-center gap-1 px-3 py-1.5 border border-dashed border-brvm-border-soft text-brvm-fg-muted hover:text-brvm-fg hover:border-brvm-accent rounded text-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Ajouter
                </button>
              )}
            </>
          )}
        </div>
        
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="space-y-3">
              <div className="shimmer h-12 rounded" />
              <div className="shimmer h-32 rounded" />
              <div className="shimmer h-32 rounded" />
            </div>
          ) : results.length === 0 ? (
            <div className="text-center py-12 text-brvm-fg-muted">
              Sélectionnez au moins 2 actions à comparer
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="brvm-table w-full">
                <thead>
                  <tr className="border-b border-brvm-border">
                    <th className="text-left py-3 px-3 text-brvm-fg-muted">Critère</th>
                    {results.map(r => (
                      <th key={r.stock.ticker} className="py-3 px-3 text-brvm-fg text-center min-w-[180px]">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-2xl">{r.stock.meta.flag}</span>
                          <span className="font-bold text-sm">{r.stock.meta.name}</span>
                          <span className="font-mono text-xs text-brvm-fg-muted">{r.stock.ticker}</span>
                          <span className="text-xs text-brvm-fg-muted">{r.stock.meta.sector}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <CompareRow label="Cours actuel" values={results.map(r => ({ v: `${r.stock.quote.price.toLocaleString('fr-FR')} XOF`, highlight: false }))} />
                  <CompareRow label="Variation jour" values={results.map(r => ({ v: `${r.stock.quote.variation >= 0 ? '+' : ''}${r.stock.quote.variation.toFixed(2)}%`, highlight: r.stock.quote.variation > 0, color: r.stock.quote.variation >= 0 ? '#00D678' : '#FF4757' }))} />
                  <CompareRow label="Volume titres" values={results.map(r => ({ v: r.stock.quote.volumeTitres.toLocaleString('fr-FR'), highlight: r.stock.quote.volumeTitres === Math.max(...results.map(r => r.stock.quote.volumeTitres)) }))} />
                  <CompareRow label="Volume XOF" values={results.map(r => ({ v: r.stock.quote.volumeXOF >= 1_000_000 ? `${(r.stock.quote.volumeXOF / 1_000_000).toFixed(1)} M` : r.stock.quote.volumeXOF.toLocaleString('fr-FR'), highlight: r.stock.quote.volumeXOF === Math.max(...results.map(r => r.stock.quote.volumeXOF)) }))} />
                  
                  <tr className="border-b border-brvm-border/30 bg-brvm-bg-soft/30">
                    <td colSpan={results.length + 1} className="py-2 px-3 text-xs text-brvm-fg-muted uppercase tracking-wider font-semibold">Scores d'analyse</td>
                  </tr>
                  
                  <CompareRow label="Score Liquidité" values={results.map(r => ({ v: `${r.analysis.liquidity.score}/100`, highlight: r.analysis.liquidity.score === bestLiquidity, color: r.analysis.liquidity.color }))} />
                  <CompareRow label="Niveau Liquidité" values={results.map(r => ({ v: r.analysis.liquidity.level, highlight: r.analysis.liquidity.score === bestLiquidity, color: r.analysis.liquidity.color }))} />
                  <CompareRow label="Score Fondamentaux" values={results.map(r => ({ v: `${r.analysis.fundamentals.score}/100`, highlight: r.analysis.fundamentals.score === bestFundamentals, color: r.analysis.fundamentals.score >= 70 ? '#00D678' : r.analysis.fundamentals.score >= 50 ? '#7CFC00' : '#FFA500' }))} />
                  <CompareRow label="Score Dynamisme" values={results.map(r => ({ v: `${r.analysis.dynamism.score}/100`, highlight: r.analysis.dynamism.score === bestDynamism, color: r.analysis.dynamism.score >= 70 ? '#00D678' : r.analysis.dynamism.score >= 50 ? '#7CFC00' : '#FFA500' }))} />
                  
                  <tr className="border-b border-brvm-border/30 bg-brvm-bg-soft/30">
                    <td colSpan={results.length + 1} className="py-2 px-3 text-xs text-brvm-fg-muted uppercase tracking-wider font-semibold">Dynamisme</td>
                  </tr>
                  
                  <CompareRow label="PER" values={results.map(r => ({ v: r.analysis.dynamism.per > 0 ? r.analysis.dynamism.per.toFixed(2) : '—', highlight: r.analysis.dynamism.per > 0 && r.analysis.dynamism.per === lowestPer, color: r.analysis.dynamism.perVsSecteur === 'sous-cote' ? '#00D678' : r.analysis.dynamism.perVsSecteur === 'sur-cote' ? '#FF4757' : '#8B95B0' }))} />
                  <CompareRow label="PER vs secteur" values={results.map(r => ({ v: r.analysis.dynamism.perVsSecteur === 'sous-cote' ? '✓ Sous-cotée' : r.analysis.dynamism.perVsSecteur === 'sur-cote' ? '✗ Sur-cotée' : r.analysis.dynamism.perVsSecteur === 'neutre' ? 'Neutre' : 'N/A', highlight: r.analysis.dynamism.perVsSecteur === 'sous-cote', color: r.analysis.dynamism.perVsSecteur === 'sous-cote' ? '#00D678' : r.analysis.dynamism.perVsSecteur === 'sur-cote' ? '#FF4757' : '#8B95B0' }))} />
                  <CompareRow label="DPA (rendement)" values={results.map(r => ({ v: r.analysis.dynamism.dpa > 0 ? `${r.analysis.dynamism.dpa.toFixed(2)}%` : '—', highlight: r.analysis.dynamism.dpa === highestDpa && r.analysis.dynamism.dpa > 0, color: r.analysis.dynamism.dpaVsSecteur === 'bon-achat' ? '#00D678' : r.analysis.dynamism.dpaVsSecteur === 'mauvais-achat' ? '#FF4757' : '#8B95B0' }))} />
                  <CompareRow label="DPA vs secteur" values={results.map(r => ({ v: r.analysis.dynamism.dpaVsSecteur === 'bon-achat' ? '✓ Bon achat' : r.analysis.dynamism.dpaVsSecteur === 'mauvais-achat' ? '✗ Mauvais' : r.analysis.dynamism.dpaVsSecteur === 'neutre' ? 'Neutre' : 'N/A', highlight: r.analysis.dynamism.dpaVsSecteur === 'bon-achat', color: r.analysis.dynamism.dpaVsSecteur === 'bon-achat' ? '#00D678' : r.analysis.dynamism.dpaVsSecteur === 'mauvais-achat' ? '#FF4757' : '#8B95B0' }))} />
                  
                  <tr className="border-b border-brvm-border/30 bg-brvm-bg-soft/30">
                    <td colSpan={results.length + 1} className="py-2 px-3 text-xs text-brvm-fg-muted uppercase tracking-wider font-semibold">Actionnaires</td>
                  </tr>
                  
                  <CompareRow label="% Locaux" values={results.map(r => ({ v: `${r.analysis.shareholders.pctLocal}%`, highlight: r.analysis.shareholders.pctLocal === Math.max(...results.map(r => r.analysis.shareholders.pctLocal)), color: '#00D678' }))} />
                  <CompareRow label="% Étrangers" values={results.map(r => ({ v: `${r.analysis.shareholders.pctEtranger}%`, highlight: r.analysis.shareholders.pctEtranger === Math.min(...results.map(r => r.analysis.shareholders.pctEtranger)), color: r.analysis.shareholders.pctEtranger >= 50 ? '#FF4757' : '#FFA500' }))} />
                  <CompareRow label="Export devises" values={results.map(r => ({ v: r.analysis.shareholders.exportDevises, highlight: r.analysis.shareholders.pctEtranger === Math.min(...results.map(r => r.analysis.shareholders.pctEtranger)), color: r.analysis.shareholders.exportDevises === 'FAIBLE' ? '#00D678' : r.analysis.shareholders.exportDevises === 'TRES FORT' ? '#FF4757' : '#FFA500' }))} />
                  
                  {results[0]?.stock.fundamentals && results[0].stock.fundamentals.length > 0 && (
                    <>
                      <tr className="border-b border-brvm-border/30 bg-brvm-bg-soft/30">
                        <td colSpan={results.length + 1} className="py-2 px-3 text-xs text-brvm-fg-muted uppercase tracking-wider font-semibold">Dernier exercice</td>
                      </tr>
                      <CompareRow label="Chiffre d'affaires" values={results.map(r => {
                        const f = r.stock.fundamentals[r.stock.fundamentals.length - 1];
                        return { v: f ? `${f.chiffreAffaires.toLocaleString('fr-FR')} M` : '—', highlight: false };
                      })} />
                      <CompareRow label="Résultat net" values={results.map(r => {
                        const f = r.stock.fundamentals[r.stock.fundamentals.length - 1];
                        return { v: f ? `${f.resultatNet.toLocaleString('fr-FR')} M` : '—', highlight: false };
                      })} />
                      <CompareRow label="BNPA" values={results.map(r => {
                        const f = r.stock.fundamentals[r.stock.fundamentals.length - 1];
                        return { v: f ? `${f.bnpa.toFixed(2)} XOF` : '—', highlight: false };
                      })} />
                      <CompareRow label="Dividende" values={results.map(r => {
                        const f = r.stock.fundamentals[r.stock.fundamentals.length - 1];
                        return { v: f ? `${f.dividende.toFixed(0)} XOF` : '—', highlight: f && f.dividende === Math.max(...results.map(r => r.stock.fundamentals[r.stock.fundamentals.length - 1]?.dividende || 0)) };
                      })} />
                    </>
                  )}
                  
                  <tr className="border-t-2 border-brvm-border bg-brvm-bg-soft/50">
                    <td className="py-4 px-3 font-bold text-brvm-fg uppercase text-sm tracking-wider">Verdict Global</td>
                    {results.map(r => (
                      <td key={r.stock.ticker} className="py-4 px-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <div className="text-3xl font-bold font-mono" style={{ color: r.analysis.verdict.couleur }}>
                            {r.analysis.verdict.scoreGlobal}
                          </div>
                          <div className="text-sm font-bold" style={{ color: r.analysis.verdict.couleur }}>
                            {r.analysis.verdict.recommandation}
                          </div>
                          {r.analysis.verdict.scoreGlobal === bestVerdict && (
                            <span className="text-xs px-2 py-0.5 rounded bg-brvm-accent/20 text-brvm-accent border border-brvm-accent/30">
                              ⭐ MEILLEURE
                            </span>
                          )}
                        </div>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CompareRow({ label, values }: { label: string; values: { v: string; highlight?: boolean; color?: string }[] }) {
  return (
    <tr className="border-b border-brvm-border/30 hover:bg-brvm-card-hover/30">
      <td className="py-2 px-3 text-brvm-fg-muted text-sm">{label}</td>
      {values.map((v, i) => (
        <td key={i} className="py-2 px-3 text-center">
          <span
            className={`font-mono text-sm ${v.highlight ? 'font-bold' : ''} ${v.highlight ? 'px-2 py-0.5 rounded' : ''}`}
            style={v.highlight ? {
              color: v.color || '#00D678',
              backgroundColor: v.color ? `${v.color}15` : 'rgba(0, 214, 120, 0.15)',
            } : { color: v.color || '#E8EEF7' }}
          >
            {v.v}
          </span>
        </td>
      ))}
    </tr>
  );
}
