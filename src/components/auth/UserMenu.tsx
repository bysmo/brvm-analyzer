'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { User, LogOut, Settings, ChevronDown, LogIn, Award, Calendar, Loader2, ShieldCheck } from 'lucide-react';

export function UserMenu() {
  const { user, loading, isAuthenticated, hasActiveSubscription, logout, refresh } = useAuth();
  const [open, setOpen] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setLogoutLoading(true);
    await logout();
    setLogoutLoading(false);
    setOpen(false);
    router.push('/login');
  };

  if (loading) {
    return <Loader2 className="w-4 h-4 text-brvm-fg-muted animate-spin" />;
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => router.push('/login')}
          className="px-3 py-1.5 text-sm text-brvm-fg-muted hover:text-brvm-fg transition-colors flex items-center gap-1.5"
        >
          <LogIn className="w-4 h-4" />
          Connexion
        </button>
        <button
          onClick={() => router.push('/pricing')}
          className="px-3 py-1.5 text-sm font-semibold bg-brvm-accent hover:bg-brvm-accent-soft text-brvm-bg rounded transition-colors"
        >
          S'abonner
        </button>
      </div>
    );
  }

  // Initiales pour l'avatar
  const initials = (user?.firstName?.[0] || '') + (user?.lastName?.[0] || '') || user?.email[0]?.toUpperCase() || 'U';
  const isAdmin = user?.role === 'admin';

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-brvm-card transition-colors"
      >
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
          isAdmin ? 'bg-brvm-info text-brvm-bg' : hasActiveSubscription ? 'bg-brvm-accent text-brvm-bg' : 'bg-brvm-warning text-brvm-bg'
        }`}>
          {initials}
        </div>
        <span className="text-sm text-brvm-fg hidden md:inline max-w-[120px] truncate">
          {user?.firstName || user?.email.split('@')[0]}
        </span>
        {isAdmin && (
          <span className="hidden md:inline-block px-1.5 py-0.5 bg-brvm-info/20 text-brvm-info text-[10px] font-bold rounded uppercase tracking-wider">
            ADMIN
          </span>
        )}
        <ChevronDown className={`w-3.5 h-3.5 text-brvm-fg-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 bg-brvm-card border border-brvm-border rounded-lg shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="p-3 border-b border-brvm-border">
            <div className="font-semibold text-brvm-fg text-sm truncate">
              {user?.firstName} {user?.lastName}
            </div>
            <div className="text-xs text-brvm-fg-muted truncate">{user?.email}</div>
          </div>

          {/* Statut abonnement */}
          <div className="p-3 border-b border-brvm-border">
            {isAdmin ? (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <ShieldCheck className="w-4 h-4 text-brvm-info" />
                  <span className="text-xs font-semibold text-brvm-info uppercase tracking-wider">
                    Administrateur
                  </span>
                </div>
                <div className="text-xs text-brvm-fg-muted">
                  Accès illimité à toutes les fonctionnalités
                </div>
              </>
            ) : hasActiveSubscription ? (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <Award className="w-4 h-4 text-brvm-accent" />
                  <span className="text-xs font-semibold text-brvm-accent uppercase tracking-wider">
                    Abonnement {user?.subscription?.planName}
                  </span>
                </div>
                {user?.subscription?.endDate && (
                  <div className="flex items-center gap-1 text-xs text-brvm-fg-muted">
                    <Calendar className="w-3 h-3" />
                    Expire le {new Date(user.subscription.endDate).toLocaleDateString('fr-FR')}
                    {' '}({user.subscription.daysRemaining}j restantes)
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="text-xs font-semibold text-brvm-warning uppercase tracking-wider mb-1">
                  Pas d'abonnement actif
                </div>
                <button
                  onClick={() => { router.push('/pricing'); setOpen(false); }}
                  className="w-full mt-1 px-3 py-1.5 bg-brvm-accent hover:bg-brvm-accent-soft text-brvm-bg text-xs font-bold rounded transition-colors"
                >
                  S'abonner maintenant
                </button>
              </>
            )}
          </div>

          {/* Menu actions */}
          <div className="p-1">
            <button
              onClick={() => { router.push('/account'); setOpen(false); }}
              className="w-full text-left px-3 py-2 hover:bg-brvm-card-hover rounded text-sm text-brvm-fg flex items-center gap-2"
            >
              <Settings className="w-4 h-4 text-brvm-fg-muted" />
              Mon compte
            </button>
            <button
              onClick={handleLogout}
              disabled={logoutLoading}
              className="w-full text-left px-3 py-2 hover:bg-brvm-card-hover rounded text-sm text-brvm-down flex items-center gap-2 disabled:opacity-50"
            >
              {logoutLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
              Déconnexion
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
