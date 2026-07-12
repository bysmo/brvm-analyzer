'use client';

import { useState, useMemo } from 'react';
import { Search, ChevronDown, Star } from 'lucide-react';

export interface StockListItem {
  ticker: string;
  name: string;
  sector: string;
  country: string;
  countryName: string;
  flag: string;
  inTopBRVM30: boolean;
}

interface Props {
  stocks: StockListItem[];
  value: string;
  onChange: (ticker: string) => void;
}

export function StockSelector({ stocks, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [filterTop30, setFilterTop30] = useState(false);
  const [filterSector, setFilterSector] = useState<string>('');

  const selected = stocks.find(s => s.ticker === value);

  const sectors = useMemo(() => {
    return Array.from(new Set(stocks.map(s => s.sector))).sort();
  }, [stocks]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return stocks.filter(s => {
      if (filterTop30 && !s.inTopBRVM30) return false;
      if (filterSector && s.sector !== filterSector) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.ticker.toLowerCase().includes(q) ||
        s.countryName.toLowerCase().includes(q) ||
        s.sector.toLowerCase().includes(q)
      );
    });
  }, [stocks, query, filterTop30, filterSector]);

  return (
    <div className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-2.5 bg-brvm-card border border-brvm-border hover:border-brvm-border-soft transition-colors rounded-md text-left"
      >
        <Search className="w-4 h-4 text-brvm-fg-muted flex-shrink-0" />
        <div className="flex-1 min-w-0">
          {selected ? (
            <div className="flex items-center gap-2">
              <span className="text-lg">{selected.flag}</span>
              <span className="font-semibold text-brvm-fg truncate">{selected.name}</span>
              <span className="font-mono text-xs text-brvm-fg-muted">{selected.ticker}</span>
              {selected.inTopBRVM30 && (
                <Star className="w-3 h-3 fill-brvm-accent text-brvm-accent" />
              )}
            </div>
          ) : (
            <span className="text-brvm-fg-muted">Choisir une valeur...</span>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-brvm-fg-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute top-full mt-1 left-0 right-0 z-50 bg-brvm-card border border-brvm-border rounded-md shadow-2xl max-h-[70vh] flex flex-col">
            {/* Recherche */}
            <div className="p-3 border-b border-brvm-border">
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Rechercher par nom, ticker, pays, secteur..."
                autoFocus
                className="w-full px-3 py-2 bg-brvm-bg-soft border border-brvm-border rounded text-sm text-brvm-fg placeholder-brvm-fg-dim focus:outline-none focus:border-brvm-accent"
              />
              <div className="flex gap-2 mt-2 flex-wrap">
                <button
                  onClick={() => setFilterTop30(f => !f)}
                  className={`px-2 py-1 text-xs rounded border transition-colors ${
                    filterTop30
                      ? 'bg-brvm-accent/20 border-brvm-accent text-brvm-accent'
                      : 'bg-transparent border-brvm-border text-brvm-fg-muted hover:text-brvm-fg'
                  }`}
                >
                  ★ Top 30 BRVM
                </button>
                <select
                  value={filterSector}
                  onChange={e => setFilterSector(e.target.value)}
                  className="px-2 py-1 text-xs rounded border border-brvm-border bg-brvm-bg-soft text-brvm-fg focus:outline-none focus:border-brvm-accent"
                >
                  <option value="">Tous secteurs</option>
                  {sectors.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <span className="px-2 py-1 text-xs text-brvm-fg-dim">
                  {filtered.length} / {stocks.length}
                </span>
              </div>
            </div>
            {/* Liste */}
            <div className="overflow-y-auto flex-1">
              {filtered.length === 0 ? (
                <div className="p-8 text-center text-brvm-fg-muted text-sm">
                  Aucune valeur trouvée
                </div>
              ) : (
                filtered.map(s => (
                  <button
                    key={s.ticker}
                    onClick={() => {
                      onChange(s.ticker);
                      setOpen(false);
                      setQuery('');
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-brvm-card-hover transition-colors text-left border-b border-brvm-border/50 ${
                      s.ticker === value ? 'bg-brvm-card-hover' : ''
                    }`}
                  >
                    <span className="text-lg">{s.flag}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-brvm-fg truncate">{s.name}</span>
                        {s.inTopBRVM30 && (
                          <Star className="w-3 h-3 fill-brvm-accent text-brvm-accent flex-shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-brvm-fg-muted">
                        <span className="font-mono">{s.ticker}</span>
                        <span>•</span>
                        <span>{s.sector}</span>
                        <span>•</span>
                        <span>{s.countryName}</span>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
