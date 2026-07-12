'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { TrendingUp, Mail, Lock, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const validated = searchParams.get('validated') === '1';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur de connexion');

      // Redirige vers la page d'où on venait, ou vers la page d'accueil
      // (les vues Recommandations/Dashboard/Palmarès sont des états internes de la page /)
      const redirect = searchParams.get('redirect') || '/';
      router.push(redirect);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-brvm-bg p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <img src="/logo.png" alt="Logo" className="w-10 h-10 rounded-md object-cover border border-brvm-border" />
          <div>
            <div className="font-bold text-brvm-fg">BRVM Analyzer</div>
            <div className="text-xs text-brvm-fg-muted">Analyse boursière temps réel</div>
          </div>
        </div>

        <div className="brvm-card rounded-lg p-6">
          <h1 className="text-xl font-bold text-brvm-fg mb-1">Connexion</h1>
          <p className="text-sm text-brvm-fg-muted mb-4">Accédez à votre espace premium</p>

          {validated && (
            <div className="mb-4 p-3 rounded bg-brvm-up/10 border border-brvm-up/30 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-brvm-up flex-shrink-0" />
              <span className="text-sm text-brvm-up">Email validé ! Vous pouvez vous connecter.</span>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 rounded bg-brvm-down/10 border border-brvm-down/30 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-brvm-down flex-shrink-0" />
              <span className="text-sm text-brvm-down">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-brvm-fg-muted uppercase tracking-wider mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brvm-fg-dim" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 bg-brvm-bg-soft border border-brvm-border rounded text-brvm-fg placeholder-brvm-fg-dim focus:outline-none focus:border-brvm-accent transition-colors"
                  placeholder="vous@exemple.com"
                  autoComplete="email"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-brvm-fg-muted uppercase tracking-wider mb-1.5">Mot de passe</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brvm-fg-dim" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 bg-brvm-bg-soft border border-brvm-border rounded text-brvm-fg placeholder-brvm-fg-dim focus:outline-none focus:border-brvm-accent transition-colors"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-brvm-accent hover:bg-brvm-accent-soft text-brvm-bg font-bold rounded transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Connexion...
                </>
              ) : (
                'Se connecter'
              )}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-brvm-border text-center text-sm text-brvm-fg-muted">
            Pas encore de compte ?{' '}
            <a href="/register" className="text-brvm-accent hover:underline font-semibold">
              Créer un compte
            </a>
          </div>

          <div className="mt-3 text-center text-xs">
            <a href="/pricing" className="text-brvm-fg-muted hover:text-brvm-fg">
              Voir les tarifs →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
