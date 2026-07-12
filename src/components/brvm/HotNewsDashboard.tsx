'use client';

import { useEffect, useState } from 'react';
import { 
  Newspaper, Loader2, RefreshCw, Search, ExternalLink, Calendar, 
  Tag, AlertTriangle, BookOpen 
} from 'lucide-react';

interface BRVMNews {
  title: string;
  summary: string;
  url: string;
  date: string;
  source: string;
  category: string;
}

export function HotNewsDashboard() {
  const [news, setNews] = useState<BRVMNews[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Tout');
  const [refreshing, setRefreshing] = useState(false);

  const loadNews = async (forceRefresh = false) => {
    if (forceRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const url = `/api/brvm/news${forceRefresh ? '?refresh=1' : ''}`;
      const res = await fetch(url);
      if (!res.ok) {
        if (res.status === 403) {
          throw new Error("Abonnement actif requis pour accéder aux actualités.");
        }
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setNews(data.news || []);
    } catch (e: any) {
      setError(e.message || 'Une erreur est survenue lors de la récupération des actualités.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadNews();
  }, []);

  // Catégories uniques présentes dans les actualités récupérées
  const categories = ['Tout', ...Array.from(new Set(news.map(item => item.category)))].sort();

  // Filtrer les actualités selon la recherche et la catégorie
  const filteredNews = news.filter(item => {
    const matchesSearch = 
      item.title.toLowerCase().includes(search.toLowerCase()) || 
      item.summary.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === 'Tout' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex items-center justify-between flex-wrap gap-4 border-b border-brvm-border pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-brvm-accent/15 rounded-lg text-brvm-accent">
            <Newspaper className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-brvm-fg uppercase tracking-wider">Hot News BRVM</h1>
            <p className="text-xs text-brvm-fg-muted">Actualités boursières en temps réel et informations sur les sociétés cotées</p>
          </div>
        </div>

        <button
          onClick={() => loadNews(true)}
          disabled={loading || refreshing}
          className="px-4 py-2 bg-brvm-card border border-brvm-border hover:border-brvm-accent rounded-md flex items-center gap-2 text-sm text-brvm-fg-muted hover:text-brvm-fg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing || loading ? 'animate-spin' : ''}`} />
          {refreshing ? 'Actualisation...' : 'Actualiser'}
        </button>
      </div>

      {/* Barre de recherche et catégories */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
        {/* Recherche */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-brvm-fg-dim" />
          <input
            type="text"
            placeholder="Rechercher une actualité..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-brvm-bg-soft border border-brvm-border rounded-md pl-9 pr-4 py-2 text-sm text-brvm-fg placeholder:text-brvm-fg-dim focus:outline-none focus:border-brvm-accent focus:ring-1 focus:ring-brvm-accent"
          />
        </div>

        {/* Catégories */}
        <div className="flex flex-wrap gap-1.5 max-w-full overflow-x-auto pb-1">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded text-xs font-semibold uppercase tracking-wider transition-colors ${
                selectedCategory === cat
                  ? 'bg-brvm-accent text-brvm-bg border border-brvm-accent'
                  : 'bg-brvm-card text-brvm-fg-muted border border-brvm-border hover:text-brvm-fg hover:border-brvm-fg-muted'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="brvm-card rounded-lg p-5 shimmer h-40" />
          ))}
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="brvm-card rounded-lg p-6 border-l-4 border-brvm-danger">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-brvm-danger" />
            <div>
              <div className="font-semibold text-brvm-fg">Erreur lors de la récupération des actualités</div>
              <div className="text-sm text-brvm-fg-muted">{error}</div>
            </div>
          </div>
        </div>
      )}

      {/* Actualités List */}
      {!loading && !error && (
        <>
          {filteredNews.length === 0 ? (
            <div className="brvm-card rounded-lg p-12 text-center">
              <BookOpen className="w-12 h-12 text-brvm-fg-dim mx-auto mb-3" />
              <div className="text-brvm-fg font-semibold mb-1">Aucune actualité trouvée</div>
              <p className="text-sm text-brvm-fg-muted">Essayez de modifier vos critères de recherche ou de filtre.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredNews.map((item, idx) => (
                <div 
                  key={idx} 
                  className="brvm-card brvm-card-hover rounded-lg p-5 flex flex-col justify-between transition-all duration-200"
                >
                  <div className="space-y-3">
                    {/* Metadata line */}
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1 text-brvm-accent font-semibold uppercase tracking-wider">
                        <Tag className="w-3.5 h-3.5" />
                        {item.category}
                      </span>
                      <span className="flex items-center gap-1 text-brvm-fg-dim font-mono">
                        <Calendar className="w-3.5 h-3.5" />
                        {item.date}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className="font-bold text-brvm-fg text-base line-clamp-2 hover:text-brvm-accent leading-snug">
                      <a href={item.url} target="_blank" rel="noopener noreferrer">
                        {item.title}
                      </a>
                    </h3>

                    {/* Summary */}
                    <p className="text-sm text-brvm-fg-muted line-clamp-3 leading-relaxed">
                      {item.summary}
                    </p>
                  </div>

                  {/* Actions line */}
                  <div className="mt-4 pt-3 border-t border-brvm-border flex items-center justify-between text-xs">
                    <span className="text-brvm-fg-dim">
                      Source: <span className="font-mono text-brvm-fg-muted">{item.source}</span>
                    </span>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-brvm-info hover:text-brvm-accent transition-colors font-medium"
                    >
                      Lire l'article complet
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
