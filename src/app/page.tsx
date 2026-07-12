'use client';

import { useState, useEffect } from 'react';
import { StockDashboard } from '@/components/brvm/StockDashboard';
import { RankingsTable } from '@/components/brvm/RankingsTable';
import { CompareModal } from '@/components/brvm/CompareModal';
import { RecommendationsDashboard } from '@/components/brvm/RecommendationsDashboard';
import { AuthGate } from '@/components/auth/AuthGate';
import { UserMenu } from '@/components/auth/UserMenu';
import { TrendingUp, BarChart3, Info, GitCompare, Award } from 'lucide-react';

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

type View = 'dashboard' | 'rankings' | 'recommendations';

const VIEW_FEATURE_NAMES: Record<View, string> = {
  recommendations: 'aux recommandations (Top Achats / Ventes)',
  dashboard: "à l'analyse détaillée des actions",
  rankings: 'au palmarès complet',
};

export default function Home() {
  const [view, setView] = useState<View>('recommendations');
  const [stocks, setStocks] = useState<StockMeta[]>([]);
  const [rankings, setRankings] = useState<RankingRow[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selectedTicker, setSelectedTicker] = useState('BOAB.bj');
  const [compareOpen, setCompareOpen] = useState(false);

  useEffect(() => {
    fetch('/api/brvm/list')
      .then(r => r.json())
      .then(d => {
        if (d.stocks) setStocks(d.stocks);
        setLoadingList(false);
      })
      .catch(() => setLoadingList(false));
    
    fetch('/api/brvm/rankings')
      .then(r => r.json())
      .then(d => {
        if (d.rows) setRankings(d.rows);
      })
      .catch(console.error);
  }, []);

  const handleSelectStock = (ticker: string) => {
    setSelectedTicker(ticker);
    setView('dashboard');
  };

  return (
    <div className="min-h-screen flex flex-col bg-brvm-bg">
      {/* Header */}
      <header className="border-b border-brvm-border bg-brvm-bg-soft/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4 flex-wrap">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Logo" className="w-9 h-9 rounded-md object-cover border border-brvm-border" />
            <div>
              <div className="font-bold text-brvm-fg leading-tight">BRVM Analyzer</div>
              <div className="text-xs text-brvm-fg-muted leading-tight">Analyse boursière temps réel</div>
            </div>
          </div>
          
          {/* Nav */}
          <nav className="flex items-center gap-1 ml-auto">
            <button
              onClick={() => setView('recommendations')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                view === 'recommendations'
                  ? 'bg-brvm-card text-brvm-accent border border-brvm-border'
                  : 'text-brvm-fg-muted hover:text-brvm-fg'
              }`}
            >
              <Award className="w-4 h-4 inline mr-1.5" />
              Recommandations
            </button>
            <button
              onClick={() => setView('dashboard')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                view === 'dashboard'
                  ? 'bg-brvm-card text-brvm-accent border border-brvm-border'
                  : 'text-brvm-fg-muted hover:text-brvm-fg'
              }`}
            >
              <TrendingUp className="w-4 h-4 inline mr-1.5" />
              Dashboard
            </button>
            <button
              onClick={() => setView('rankings')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                view === 'rankings'
                  ? 'bg-brvm-card text-brvm-accent border border-brvm-border'
                  : 'text-brvm-fg-muted hover:text-brvm-fg'
              }`}
            >
              <BarChart3 className="w-4 h-4 inline mr-1.5" />
              Palmarès {rankings.length > 0 && `(${rankings.length})`}
            </button>
            <button
              onClick={() => setCompareOpen(true)}
              className="px-3 py-1.5 rounded text-sm font-medium text-brvm-fg-muted hover:text-brvm-accent hover:bg-brvm-card transition-colors border border-transparent hover:border-brvm-border"
            >
              <GitCompare className="w-4 h-4 inline mr-1.5" />
              Comparer
            </button>
          </nav>
          
          {/* User menu */}
          <UserMenu />

          {/* Live indicator */}
          <div className="flex items-center gap-1.5 text-xs text-brvm-fg-muted">
            <span className="w-2 h-2 rounded-full bg-brvm-accent pulse-live" />
            <span className="font-mono">BRVM LIVE</span>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-5">
        <AuthGate featureName={VIEW_FEATURE_NAMES[view]}>
          {view === 'recommendations' ? (
            <RecommendationsDashboard onSelectStock={handleSelectStock} />
          ) : view === 'dashboard' ? (
            loadingList ? (
              <div className="brvm-card rounded-lg p-8 shimmer h-20" />
            ) : (
              <StockDashboard stocks={stocks} initialTicker={selectedTicker} />
            )
          ) : (
            <RankingsTable rows={rankings} onSelectStock={handleSelectStock} />
          )}
        </AuthGate>
      </main>

      {/* Compare modal */}
      <CompareModal stocks={stocks} open={compareOpen} onClose={() => setCompareOpen(false)} />

      {/* Footer */}
      <footer className="border-t border-brvm-border bg-brvm-bg-soft py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between flex-wrap gap-2 text-xs text-brvm-fg-muted">
          <div className="flex items-center gap-2">
            <Info className="w-3.5 h-3.5" />
            <span>
              Données fournies par <a href="https://www.sikafinance.com" target="_blank" rel="noopener" className="text-brvm-info hover:underline">sikafinance.com</a> • Cache 30 min
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span>{stocks.length} actions BRVM suivies</span>
            <span>•</span>
            <span>BRVM Composite / 8 pays UEMOA</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
