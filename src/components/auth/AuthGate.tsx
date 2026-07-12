'use client';

import { useAuth } from '@/hooks/use-auth';
import { Loader2, Lock, TrendingUp } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  featureName?: string;
}

// Affiche un écran de chargement pendant la vérification d'auth
// Si non connecté: propose de se connecter
// Si connecté mais sans abonnement actif: propose de s'abonner (sauf admin qui a accès illimité)
export function AuthGate({ children, featureName = 'cette fonctionnalité' }: Props) {
  const { user, loading, isAuthenticated, hasActiveSubscription } = useAuth();

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-brvm-accent animate-spin mx-auto mb-3" />
          <p className="text-sm text-brvm-fg-muted">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-[400px] flex items-center justify-center px-4">
        <div className="brvm-card rounded-lg p-8 max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-brvm-accent/20 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-brvm-accent" />
          </div>
          <h2 className="text-xl font-bold text-brvm-fg mb-2">Connexion requise</h2>
          <p className="text-sm text-brvm-fg-muted mb-4">
            Pour accéder à {featureName}, vous devez être connecté avec un abonnement actif.
          </p>
          <div className="space-y-2">
            <a
              href={`/login?redirect=${encodeURIComponent(typeof window !== 'undefined' ? window.location.pathname : '/')}`}
              className="block w-full py-2.5 bg-brvm-accent hover:bg-brvm-accent-soft text-brvm-bg font-bold rounded transition-colors"
            >
              Se connecter
            </a>
            <a
              href="/register"
              className="block w-full py-2.5 bg-brvm-card border border-brvm-border hover:border-brvm-accent text-brvm-fg rounded transition-colors text-sm"
            >
              Créer un compte
            </a>
          </div>
        </div>
      </div>
    );
  }

  // L'admin a accès à tout sans abonnement
  const isAdmin = user?.role === 'admin';
  if (!isAdmin && !hasActiveSubscription) {
    return (
      <div className="min-h-[400px] flex items-center justify-center px-4">
        <div className="brvm-card rounded-lg p-8 max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-brvm-warning/20 flex items-center justify-center mx-auto mb-4">
            <TrendingUp className="w-8 h-8 text-brvm-warning" />
          </div>
          <h2 className="text-xl font-bold text-brvm-fg mb-2">Abonnement requis</h2>
          <p className="text-sm text-brvm-fg-muted mb-2">
            Bonjour {user?.firstName || user?.email} ! 👋
          </p>
          <p className="text-sm text-brvm-fg-muted mb-4">
            Pour accéder à {featureName}, vous devez souscrire un abonnement.
            À partir de <strong className="text-brvm-fg">5 000 XOF/mois</strong>.
          </p>
          <div className="space-y-2">
            <a
              href="/pricing"
              className="block w-full py-2.5 bg-brvm-accent hover:bg-brvm-accent-soft text-brvm-bg font-bold rounded transition-colors"
            >
              Voir les tarifs
            </a>
            <button
              onClick={() => window.location.reload()}
              className="block w-full py-2 text-brvm-fg-muted hover:text-brvm-fg text-xs"
            >
              Rafraîchir
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
