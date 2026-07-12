'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TrendingUp, Check, Star, Loader2, Award } from 'lucide-react';
import { SUBSCRIPTION_PLANS, formatXOF } from '@/lib/payment/plans';
import { useAuth } from '@/hooks/use-auth';

export default function PricingPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-brvm-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-brvm-accent animate-spin" />
      </div>
    );
  }

  const handleSelectPlan = (planId: string) => {
    if (!user) {
      router.push(`/login?redirect=/checkout/${planId}`);
    } else {
      router.push(`/checkout/${planId}`);
    }
  };

  return (
    <div className="min-h-screen bg-brvm-bg py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-2 mb-3">
            <img src="/logo.png" alt="Logo" className="w-10 h-10 rounded-md object-cover border border-brvm-border" />
            <div className="font-bold text-brvm-fg text-lg">BRVM Analyzer</div>
          </div>
          <h1 className="text-3xl font-bold text-brvm-fg mb-2">Choisissez votre abonnement</h1>
          <p className="text-brvm-fg-muted">Accédez aux analyses premium de la Bourse Régionale des Valeurs Mobilières</p>
        </div>

        {/* Plans */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {SUBSCRIPTION_PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`brvm-card rounded-lg p-6 relative flex flex-col ${
                plan.popular ? 'border-2' : ''
              }`}
              style={plan.popular ? { borderColor: plan.color } : {}}
            >
              {plan.popular && (
                <div
                  className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold text-brvm-bg"
                  style={{ backgroundColor: plan.color }}
                >
                  ⭐ POPULAIRE
                </div>
              )}

              <div className="mb-4">
                <h3 className="text-2xl font-bold text-brvm-fg">{plan.name}</h3>
                <div className="mt-2">
                  <span className="text-3xl font-bold" style={{ color: plan.color }}>
                    {formatXOF(plan.priceXOF)}
                  </span>
                  {plan.discountPct > 0 && (
                    <span className="ml-2 text-sm text-brvm-fg-muted line-through">
                      {formatXOF(5000 * plan.durationMonths)}
                    </span>
                  )}
                </div>
                <div className="text-xs text-brvm-fg-muted mt-1">
                  {formatXOF(plan.monthlyEquivalent)}/mois
                  {plan.discountPct > 0 && (
                    <span className="ml-2 text-brvm-up font-semibold">-{plan.discountPct}%</span>
                  )}
                </div>
              </div>

              <ul className="space-y-2 mb-6 flex-1">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-brvm-fg">
                    <Check className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: plan.color }} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSelectPlan(plan.id)}
                className="w-full py-2.5 rounded font-bold transition-colors"
                style={{
                  backgroundColor: plan.color,
                  color: '#0A0E1A',
                }}
              >
                {user?.subscription?.isActive ? 'Changer de plan' : 'Choisir ce plan'}
              </button>
            </div>
          ))}
        </div>

        {/* Features communes */}
        <div className="brvm-card rounded-lg p-6 mb-6">
          <h2 className="text-lg font-bold text-brvm-fg mb-4 flex items-center gap-2">
            <Award className="w-5 h-5 text-brvm-accent" />
            Tous les abonnements incluent
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              'Tableau de bord Top 5 Recommandations (Achats/Ventes)',
              'Analyse détaillée des 48 actions BRVM',
              'Comparaison sectorielle temps réel (BNPA, PER, Dividendes)',
              'Comparaison côte à côte de 4 actions',
              'Palmarès complet avec tri et filtres',
              'Scores de liquidité, fondamentaux et dynamisme',
              'Verdict global ACHAT/CONSERVER/OBSERVER/VENDRE',
              'Données mises à jour toutes les 30 minutes',
            ].map((f, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-brvm-fg-muted">
                <Check className="w-4 h-4 text-brvm-up flex-shrink-0 mt-0.5" />
                <span>{f}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Moyens de paiement */}
        <div className="text-center">
          <p className="text-sm text-brvm-fg-muted mb-3">Moyens de paiement acceptés</p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <div className="flex items-center gap-2 px-4 py-2 bg-brvm-card border border-brvm-border rounded">
              <span className="text-orange-500 font-bold text-sm">Orange Money</span>
              <span className="text-xs text-brvm-fg-muted">5 pays UEMOA</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-brvm-card border border-brvm-border rounded">
              <span className="font-bold text-sm">💳 VISA</span>
              <span className="text-xs text-brvm-fg-muted">3D Secure</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-brvm-card border border-brvm-border rounded">
              <span className="font-bold text-sm">💳 Mastercard</span>
              <span className="text-xs text-brvm-fg-muted">3D Secure</span>
            </div>
          </div>
        </div>

        {!user && (
          <div className="text-center mt-6 text-sm text-brvm-fg-muted">
            Pas encore de compte ?{' '}
            <a href="/register" className="text-brvm-accent hover:underline font-semibold">
              Créer un compte gratuit
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
