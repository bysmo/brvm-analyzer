// Définition des plans d'abonnement (tarifs échelle agressive)
// 1 mois: 5 000 XOF
// 3 mois: 12 000 XOF (-20%)
// 6 mois: 22 000 XOF (-27%)
// 12 mois: 40 000 XOF (-33%)

export interface SubscriptionPlan {
  id: string;
  name: string;
  durationMonths: number;
  priceXOF: number;
  monthlyEquivalent: number;  // prix par mois équivalent
  discountPct: number;  // remise vs plein tarif
  popular?: boolean;
  features: string[];
  color: string;
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: '1mois',
    name: '1 mois',
    durationMonths: 1,
    priceXOF: 5000,
    monthlyEquivalent: 5000,
    discountPct: 0,
    color: '#4DA3FF',
    features: [
      'Accès complet aux recommandations',
      'Analyse détaillée de 48 actions BRVM',
      'Comparaison sectorielle temps réel',
      'Palmarès complet et triable',
    ],
  },
  {
    id: '3mois',
    name: '3 mois',
    durationMonths: 3,
    priceXOF: 12000,
    monthlyEquivalent: 4000,
    discountPct: 20,
    color: '#00D678',
    features: [
      'Toutes les fonctionnalités du plan 1 mois',
      'Économie de 3 000 XOF vs plein tarif',
      'Idéal pour tester sur un trimestre',
      'Support email prioritaire',
    ],
  },
  {
    id: '6mois',
    name: '6 mois',
    durationMonths: 6,
    priceXOF: 22000,
    monthlyEquivalent: 3667,
    discountPct: 27,
    popular: true,
    color: '#FFA500',
    features: [
      'Toutes les fonctionnalités du plan 3 mois',
      'Économie de 8 000 XOF vs plein tarif',
      'Accès anticipé aux nouvelles fonctionnalités',
      "Webinaires mensuels d'analyse",
      'Support email + WhatsApp prioritaire',
    ],
  },
  {
    id: '12mois',
    name: '12 mois',
    durationMonths: 12,
    priceXOF: 40000,
    monthlyEquivalent: 3333,
    discountPct: 33,
    color: '#B47CFF',
    features: [
      'Toutes les fonctionnalités du plan 6 mois',
      'Économie de 20 000 XOF vs plein tarif',
      'Rapport trimestriel personnalisé',
      'Alertes email sur les opportunités',
      'Coaching investissement 1-on-1 (1 session)',
      'Support VIP 7j/7',
    ],
  },
];

export function getPlanById(id: string): SubscriptionPlan | undefined {
  return SUBSCRIPTION_PLANS.find(p => p.id === id);
}

export function formatXOF(n: number): string {
  return n.toLocaleString('fr-FR') + ' XOF';
}
