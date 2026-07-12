'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  TrendingUp, User, Mail, Phone, Globe, Calendar, Award,
  Loader2, LogOut, CreditCard, AlertCircle, CheckCircle2, ArrowLeft,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { SUBSCRIPTION_PLANS, formatXOF } from '@/lib/payment/plans';

export default function AccountPage() {
  const router = useRouter();
  const { user, loading, isAuthenticated, logout } = useAuth();
  const [payments, setPayments] = useState<any[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login?redirect=/account');
    }
  }, [loading, isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated) {
      // Dans une vraie app: fetch /api/account/payments
      // Pour la démo, on laisse vide
    }
  }, [isAuthenticated]);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-brvm-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-brvm-accent animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-brvm-bg py-6 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <a href="/" className="text-brvm-fg-muted hover:text-brvm-fg">
            <ArrowLeft className="w-5 h-5" />
          </a>
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Logo" className="w-8 h-8 rounded-md object-cover border border-brvm-border" />
            <div className="font-bold text-brvm-fg">Mon compte</div>
          </div>
        </div>

        {/* Profil */}
        <div className="brvm-card rounded-lg p-5 mb-4">
          <h2 className="text-sm font-semibold text-brvm-fg uppercase tracking-wider mb-3 flex items-center gap-2">
            <User className="w-4 h-4 text-brvm-fg-muted" />
            Profil
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <InfoRow icon={<User />} label="Nom" value={`${user.firstName || ''} ${user.lastName || ''}`.trim() || '—'} />
            <InfoRow icon={<Mail />} label="Email" value={user.email} />
            <InfoRow icon={<Phone />} label="Téléphone" value={user.phone || '—'} />
            <InfoRow icon={<Globe />} label="Pays" value={user.country || '—'} />
          </div>
        </div>

        {/* Abonnement */}
        <div className="brvm-card rounded-lg p-5 mb-4">
          <h2 className="text-sm font-semibold text-brvm-fg uppercase tracking-wider mb-3 flex items-center gap-2">
            <Award className="w-4 h-4 text-brvm-fg-muted" />
            Abonnement
          </h2>
          {user.subscription?.isActive ? (
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-full bg-brvm-accent/20 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-brvm-accent" />
                </div>
                <div>
                  <div className="font-bold text-brvm-fg text-lg">Abonnement {user.subscription.planName}</div>
                  <div className="text-sm text-brvm-up">Actif</div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <InfoRow
                  icon={<Calendar />}
                  label="Date d'expiration"
                  value={user.subscription.endDate
                    ? new Date(user.subscription.endDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
                    : '—'}
                />
                <InfoRow
                  icon={<Calendar />}
                  label="Jours restants"
                  value={`${user.subscription.daysRemaining} jour${user.subscription.daysRemaining > 1 ? 's' : ''}`}
                  highlight={user.subscription.daysRemaining < 7 ? 'warning' : 'success'}
                />
              </div>
              {user.subscription.daysRemaining < 7 && (
                <div className="mt-3 p-3 bg-brvm-warning/10 border border-brvm-warning/30 rounded text-sm text-brvm-warning flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Votre abonnement expire bientôt ! Renouvelez pour conserver l'accès.
                </div>
              )}
              <a
                href="/pricing"
                className="mt-3 inline-block px-4 py-2 bg-brvm-card border border-brvm-border hover:border-brvm-accent text-brvm-fg text-sm rounded transition-colors"
              >
                Renouveler / Changer de plan
              </a>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-full bg-brvm-warning/20 flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-brvm-warning" />
                </div>
                <div>
                  <div className="font-bold text-brvm-fg text-lg">Aucun abonnement actif</div>
                  <div className="text-sm text-brvm-fg-muted">Souscrivez pour accéder aux analyses premium</div>
                </div>
              </div>
              <a
                href="/pricing"
                className="inline-block px-4 py-2 bg-brvm-accent hover:bg-brvm-accent-soft text-brvm-bg font-bold text-sm rounded transition-colors"
              >
                Voir les tarifs
              </a>
            </div>
          )}
        </div>

        {/* Plans disponibles */}
        {!user.subscription?.isActive && (
          <div className="brvm-card rounded-lg p-5 mb-4">
            <h2 className="text-sm font-semibold text-brvm-fg uppercase tracking-wider mb-3 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-brvm-fg-muted" />
              Plans disponibles
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {SUBSCRIPTION_PLANS.map(plan => (
                <div key={plan.id} className="bg-brvm-bg-soft border border-brvm-border rounded p-3">
                  <div className="font-bold text-brvm-fg">{plan.name}</div>
                  <div className="text-2xl font-bold mt-1" style={{ color: plan.color }}>
                    {formatXOF(plan.priceXOF)}
                  </div>
                  <div className="text-xs text-brvm-fg-muted">
                    {formatXOF(plan.monthlyEquivalent)}/mois
                    {plan.discountPct > 0 && <span className="ml-1 text-brvm-up">-{plan.discountPct}%</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Déconnexion */}
        <div className="brvm-card rounded-lg p-5">
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-brvm-card border border-brvm-down/30 hover:border-brvm-down text-brvm-down text-sm rounded transition-colors flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Se déconnecter
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value, highlight }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: 'success' | 'warning' | 'danger';
}) {
  const color = highlight === 'success' ? 'text-brvm-up'
              : highlight === 'warning' ? 'text-brvm-warning'
              : highlight === 'danger' ? 'text-brvm-down'
              : 'text-brvm-fg';
  return (
    <div className="flex items-center gap-2 bg-brvm-bg-soft rounded p-2.5 border border-brvm-border">
      <div className="text-brvm-fg-dim w-4 h-4">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-brvm-fg-muted uppercase tracking-wider">{label}</div>
        <div className={`text-sm font-medium truncate ${color}`}>{value}</div>
      </div>
    </div>
  );
}
