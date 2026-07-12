'use client';

import { useEffect, useState, useMemo } from 'react';
import { Star, ArrowUpRight, ArrowDownRight, Minus, Search } from 'lucide-react';

interface RankingRow {
  ticker: string;
  name: string;
  sector: string;
  country: string;
  countryName: string;
  flag: string;
  price: number;
  variation: number;
  ouverture: number;
  plusHaut: number;
  plusBas: number;
  volumeTitres: number;
  volumeXOF: number;
  inTopBRVM30: boolean;
}

interface Props {
  rows: RankingRow[];
  onSelectStock: (ticker: string) => void;
}

type SortKey = 'volumeTitres' | 'volumeXOF' | 'variation' | 'price' | 'name' | 'top30';

export function RankingsTable({ rows, onSelectStock }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('volumeXOF');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [filterTop30, setFilterTop30] = useState(false);
  const [query, setQuery] = useState('');

  const sorted = useMemo(() => {
    let r = rows.slice();
    if (filterTop30) r = r.filter(r => r.inTopBRVM30);
    const q = query.toLowerCase().trim();
    if (q) {
      r = r.filter(r =>
        r.name.toLowerCase().includes(q) ||
        r.ticker.toLowerCase().includes(q) ||
        r.sector.toLowerCase().includes(q) ||
        r.countryName.toLowerCase().includes(q)
      );
    }
    r.sort((a, b) => {
      let av: number | string, bv: number | string;
      if (sortKey === 'name') {
        av = a.name; bv = b.name;
        return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
      }
      if (sortKey === 'top30') {
        av = a.inTopBRVM30 ? 1 : 0;
        bv = b.inTopBRVM30 ? 1 : 0;
      } else {
        av = a[sortKey];
        bv = b[sortKey];
      }
      return sortDir === 'asc' ? Number(av) - Number(bv) : Number(bv) - Number(av);
    });
    return r;
  }, [rows, sortKey, sortDir, filterTop30, query]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  return (
    <div className="brvm-card rounded-lg overflow-hidden">
      {/* Header / filtres */}
      <div className="p-4 border-b border-brvm-border flex items-center gap-3 flex-wrap">
        <h2 className="text-sm font-semibold text-brvm-fg uppercase tracking-wider flex-1">
          Palmarès BRVM — {rows.length} actions cotées
        </h2>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-brvm-fg-dim" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Filtrer..."
            className="pl-8 pr-3 py-1.5 bg-brvm-bg-soft border border-brvm-border rounded text-sm text-brvm-fg placeholder-brvm-fg-dim focus:outline-none focus:border-brvm-accent w-48"
          />
        </div>
        <button
          onClick={() => setFilterTop30(f => !f)}
          className={`px-3 py-1.5 text-xs rounded border transition-colors ${
            filterTop30
              ? 'bg-brvm-accent/20 border-brvm-accent text-brvm-accent'
              : 'bg-transparent border-brvm-border text-brvm-fg-muted hover:text-brvm-fg'
          }`}
        >
          <Star className={`w-3 h-3 inline mr-1 ${filterTop30 ? 'fill-brvm-accent' : ''}`} />
          Top 30 BRVM
        </button>
      </div>
      
      {/* Table */}
      <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
        <table className="brvm-table w-full">
          <thead className="sticky top-0 bg-brvm-card z-10">
            <tr className="border-b border-brvm-border">
              <th className="text-left py-2 px-3 cursor-pointer hover:text-brvm-fg" onClick={() => toggleSort('name')}>
                Valeur {sortKey === 'name' && (sortDir === 'asc' ? '↑' : '↓')}
              </th>
              <th className="text-left py-2 px-2 hidden md:table-cell">Secteur</th>
              <th className="text-right py-2 px-3 cursor-pointer hover:text-brvm-fg" onClick={() => toggleSort('price')}>
                Cours {sortKey === 'price' && (sortDir === 'asc' ? '↑' : '↓')}
              </th>
              <th className="text-right py-2 px-3 cursor-pointer hover:text-brvm-fg" onClick={() => toggleSort('variation')}>
                Var. {sortKey === 'variation' && (sortDir === 'asc' ? '↑' : '↓')}
              </th>
              <th className="text-right py-2 px-3 cursor-pointer hover:text-brvm-fg" onClick={() => toggleSort('volumeTitres')}>
                Vol. titres {sortKey === 'volumeTitres' && (sortDir === 'asc' ? '↑' : '↓')}
              </th>
              <th className="text-right py-2 px-3 cursor-pointer hover:text-brvm-fg" onClick={() => toggleSort('volumeXOF')}>
                Vol. XOF {sortKey === 'volumeXOF' && (sortDir === 'asc' ? '↑' : '↓')}
              </th>
              <th className="text-center py-2 px-3 cursor-pointer hover:text-brvm-fg" onClick={() => toggleSort('top30')}>
                Top 30 {sortKey === 'top30' && (sortDir === 'asc' ? '↑' : '↓')}
              </th>
              <th className="text-center py-2 px-3"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr
                key={r.ticker}
                onClick={() => onSelectStock(r.ticker)}
                className="border-b border-brvm-border/30 hover:bg-brvm-card-hover cursor-pointer transition-colors"
              >
                <td className="py-2 px-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-brvm-fg-dim font-mono w-6">{i + 1}</span>
                    <span className="text-base">{r.flag}</span>
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-brvm-fg truncate">{r.name}</div>
                      <div className="text-xs text-brvm-fg-muted font-mono">{r.ticker}</div>
                    </div>
                  </div>
                </td>
                <td className="py-2 px-2 hidden md:table-cell">
                  <span className="text-xs text-brvm-fg-muted">{r.sector}</span>
                </td>
                <td className="py-2 px-3 text-right font-mono text-brvm-fg">
                  {r.price.toLocaleString('fr-FR')}
                </td>
                <td className="py-2 px-3 text-right">
                  <span className={`inline-flex items-center gap-0.5 font-mono text-xs px-1.5 py-0.5 rounded ${
                    r.variation > 0 ? 'badge-up' : r.variation < 0 ? 'badge-down' : 'badge-neutral'
                  }`}>
                    {r.variation > 0 ? <ArrowUpRight className="w-3 h-3" /> : r.variation < 0 ? <ArrowDownRight className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                    {r.variation > 0 ? '+' : ''}{r.variation.toFixed(2)}%
                  </span>
                </td>
                <td className="py-2 px-3 text-right font-mono text-brvm-fg-muted text-xs">
                  {r.volumeTitres.toLocaleString('fr-FR')}
                </td>
                <td className="py-2 px-3 text-right font-mono text-brvm-fg-muted text-xs">
                  {r.volumeXOF >= 1_000_000_000 ? `${(r.volumeXOF / 1_000_000_000).toFixed(2)} Md` :
                   r.volumeXOF >= 1_000_000 ? `${(r.volumeXOF / 1_000_000).toFixed(1)} M` :
                   r.volumeXOF >= 1000 ? `${(r.volumeXOF / 1000).toFixed(0)} k` :
                   r.volumeXOF.toFixed(0)}
                </td>
                <td className="py-2 px-3 text-center">
                  {r.inTopBRVM30 ? (
                    <Star className="w-4 h-4 fill-brvm-accent text-brvm-accent inline" />
                  ) : (
                    <span className="text-brvm-fg-dim text-xs">—</span>
                  )}
                </td>
                <td className="py-2 px-3 text-center">
                  <span className="text-xs text-brvm-info hover:underline">Analyser →</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
