'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  TrendingUp, ArrowLeft, Loader2, CheckCircle2, AlertCircle,
  Smartphone, CreditCard, ShieldCheck, Star,
} from 'lucide-react';
import { getPlanById, formatXOF, type SubscriptionPlan } from '@/lib/payment/plans';
import { ORANGE_MONEY_COUNTRIES } from '@/lib/payment/orange-money';
import { useAuth } from '@/hooks/use-auth';

type PaymentMethod = 'orange_money' | 'visa_3ds';
type Step = 'select' | 'orange_money_form' | 'visa_form' | 'processing' | 'success' | 'error';

export default function CheckoutPage() {
  const params = useParams<{ planId: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [plan, setPlan] = useState<SubscriptionPlan | null>(null);
  const [step, setStep] = useState<Step>('select');
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{ endDate: string; planName: string } | null>(null);

  // Orange Money form state
  const [omCountry, setOmCountry] = useState('CI');
  const [omMsisdn, setOmMsisdn] = useState('');
  const [omOtp, setOmOtp] = useState('');
  const [omReference, setOmReference] = useState('');
  const [omOtpSent, setOmOtpSent] = useState(false);
  const [sandboxOtp, setSandboxOtp] = useState<string | null>(null);

  // VISA form state
  const [visaCard, setVisaCard] = useState('');
  const [visaExp, setVisaExp] = useState('');
  const [visaCvc, setVisaCvc] = useState('');
  const [visaPaymentId, setVisaPaymentId] = useState('');
  const [visaIntentId, setVisaIntentId] = useState('');
  const [visaDemoMode, setVisaDemoMode] = useState(false);

  useEffect(() => {
    const p = getPlanById(params.planId);
    if (!p) {
      router.push('/pricing');
      return;
    }
    setPlan(p);
  }, [params.planId, router]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push(`/login?redirect=/checkout/${params.planId}`);
    }
  }, [authLoading, user, router, params.planId]);

  if (authLoading || !plan) {
    return (
      <div className="min-h-screen bg-brvm-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-brvm-accent animate-spin" />
      </div>
    );
  }

  // === ORANGE MONEY ===
  const handleOrangeMoneyInitiate = async () => {
    setStep('processing');
    setError(null);
    try {
      const res = await fetch('/api/payments/orange-money/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: plan.id,
          country: omCountry,
          customerMsisdn: omMsisdn || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setOmReference(data.reference);
      if (data.otpCode) {
        setSandboxOtp(data.otpCode);
      }
      setOmOtpSent(true);
      setStep('orange_money_form');
    } catch (err: any) {
      setError(err.message);
      setStep('error');
    }
  };

  const handleOrangeMoneyConfirm = async () => {
    setStep('processing');
    setError(null);
    try {
      const res = await fetch('/api/payments/orange-money/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reference: omReference,
          otpCode: omOtp,
          planId: plan.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setSuccessData({
        endDate: data.subscription?.endDate || '',
        planName: plan.name,
      });
      setStep('success');
    } catch (err: any) {
      setError(err.message);
      setStep('error');
    }
  };

  // === VISA 3DS ===
  const handleVisaPay = async () => {
    setStep('processing');
    setError(null);
    try {
      // Crée le PaymentIntent
      const initRes = await fetch('/api/payments/visa/create-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: plan.id }),
      });
      const initData = await initRes.json();
      if (!initRes.ok) throw new Error(initData.error);

      setVisaPaymentId(initData.paymentId);
      setVisaIntentId(initData.paymentIntentId);
      setVisaDemoMode(initData.demoMode || false);

      // Confirme le paiement
      const confirmRes = await fetch('/api/payments/visa/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId: initData.paymentId,
          paymentIntentId: initData.paymentIntentId,
          planId: plan.id,
        }),
      });
      const confirmData = await confirmRes.json();
      if (!confirmRes.ok) throw new Error(confirmData.error);

      setSuccessData({
        endDate: confirmData.subscription?.endDate || '',
        planName: plan.name,
      });
      setStep('success');
    } catch (err: any) {
      setError(err.message);
      setStep('error');
    }
  };

  // Formatage carte VISA
  const formatCardNumber = (val: string) => {
    return val.replace(/\s/g, '').replace(/(\d{4})/g, '$1 ').trim().slice(0, 19);
  };

  return (
    <div className="min-h-screen bg-brvm-bg py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <a href="/pricing" className="text-brvm-fg-muted hover:text-brvm-fg">
            <ArrowLeft className="w-5 h-5" />
          </a>
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Logo" className="w-8 h-8 rounded-md object-cover border border-brvm-border" />
            <div className="font-bold text-brvm-fg">BRVM Analyzer</div>
          </div>
        </div>

        {/* Récap plan */}
        <div className="brvm-card rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-brvm-fg-muted uppercase tracking-wider">Abonnement</div>
              <div className="text-xl font-bold text-brvm-fg">{plan.name}</div>
              <div className="text-sm text-brvm-fg-muted">
                {plan.durationMonths} mois d'accès premium
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold" style={{ color: plan.color }}>
                {formatXOF(plan.priceXOF)}
              </div>
              {plan.discountPct > 0 && (
                <div className="text-xs text-brvm-up">-{plan.discountPct}%</div>
              )}
            </div>
          </div>
        </div>

        {/* Step: select method */}
        {step === 'select' && (
          <div className="brvm-card rounded-lg p-6">
            <h2 className="text-lg font-bold text-brvm-fg mb-4">Choisissez votre moyen de paiement</h2>
            <div className="space-y-3">
              <button
                onClick={() => { setMethod('orange_money'); setStep('orange_money_form'); }}
                className="w-full p-4 bg-brvm-bg-soft hover:bg-brvm-card-hover border border-brvm-border hover:border-orange-500/50 rounded-lg text-left transition-all flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded bg-orange-500/20 flex items-center justify-center">
                  <Smartphone className="w-5 h-5 text-orange-500" />
                </div>
                <div className="flex-1">
                  <div className="font-bold text-brvm-fg">Orange Money</div>
                  <div className="text-xs text-brvm-fg-muted">🇨🇮 🇸🇳 🇧🇫 🇲🇱 🇧🇯 — Paiement instantané</div>
                </div>
                <div className="text-orange-500 font-bold">→</div>
              </button>

              <button
                onClick={() => { setMethod('visa_3ds'); setStep('visa_form'); }}
                className="w-full p-4 bg-brvm-bg-soft hover:bg-brvm-card-hover border border-brvm-border hover:border-blue-500/50 rounded-lg text-left transition-all flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded bg-blue-500/20 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-blue-400" />
                </div>
                <div className="flex-1">
                  <div className="font-bold text-brvm-fg">Carte VISA / Mastercard</div>
                  <div className="text-xs text-brvm-fg-muted flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Sécurisé 3D Secure
                  </div>
                </div>
                <div className="text-blue-400 font-bold">→</div>
              </button>
            </div>
          </div>
        )}

        {/* Step: Orange Money form */}
        {step === 'orange_money_form' && !omOtpSent && (
          <div className="brvm-card rounded-lg p-6">
            <button onClick={() => setStep('select')} className="text-xs text-brvm-fg-muted hover:text-brvm-fg mb-3 flex items-center gap-1">
              <ArrowLeft className="w-3 h-3" /> Changer de méthode
            </button>
            <h2 className="text-lg font-bold text-brvm-fg mb-4">Paiement Orange Money</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-brvm-fg-muted uppercase tracking-wider mb-1.5">Pays</label>
                <select
                  value={omCountry}
                  onChange={e => setOmCountry(e.target.value)}
                  className="w-full px-3 py-2.5 bg-brvm-bg-soft border border-brvm-border rounded text-brvm-fg focus:outline-none focus:border-brvm-accent"
                >
                  {ORANGE_MONEY_COUNTRIES.map(c => (
                    <option key={c.code} value={c.code}>{c.flag} {c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-brvm-fg-muted uppercase tracking-wider mb-1.5">
                  Votre numéro Orange Money (optionnel)
                </label>
                <input
                  type="tel"
                  value={omMsisdn}
                  onChange={e => setOmMsisdn(e.target.value)}
                  className="w-full px-3 py-2.5 bg-brvm-bg-soft border border-brvm-border rounded text-brvm-fg placeholder-brvm-fg-dim focus:outline-none focus:border-brvm-accent"
                  placeholder="+225 07 00 00 00 00"
                />
                <p className="text-xs text-brvm-fg-dim mt-1">Laissez vide si vous payez depuis un autre numéro</p>
              </div>
              <button
                onClick={handleOrangeMoneyInitiate}
                className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded transition-colors flex items-center justify-center gap-2"
              >
                <Smartphone className="w-4 h-4" />
                Initier le paiement de {formatXOF(plan.priceXOF)}
              </button>
            </div>
          </div>
        )}

        {/* Step: Orange Money OTP */}
        {step === 'orange_money_form' && omOtpSent && (
          <div className="brvm-card rounded-lg p-6">
            <h2 className="text-lg font-bold text-brvm-fg mb-2">Validation du paiement</h2>
            <p className="text-sm text-brvm-fg-muted mb-4">
              Une demande de paiement de <strong className="text-brvm-fg">{formatXOF(plan.priceXOF)}</strong> a été initiée.
              {sandboxOtp ? (
                <>
                  <br />
                  <span className="inline-block mt-2 px-3 py-1 bg-brvm-info/10 border border-brvm-info/30 rounded text-xs text-brvm-info">
                    MODE DÉMO: Utilisez le code <strong>{sandboxOtp}</strong> (ou n'importe quel code à 6 chiffres)
                  </span>
                </>
              ) : (
                <> Saisissez le code OTP reçu par SMS sur votre téléphone.</>
              )}
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-brvm-fg-muted uppercase tracking-wider mb-1.5">Code OTP (6 chiffres)</label>
                <input
                  type="text"
                  value={omOtp}
                  onChange={e => setOmOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full px-3 py-3 bg-brvm-bg-soft border border-brvm-border rounded text-brvm-fg text-center text-2xl font-mono tracking-[0.5em] focus:outline-none focus:border-brvm-accent"
                  placeholder="000000"
                  maxLength={6}
                />
              </div>
              <button
                onClick={handleOrangeMoneyConfirm}
                disabled={omOtp.length !== 6}
                className="w-full py-2.5 bg-brvm-accent hover:bg-brvm-accent-soft text-brvm-bg font-bold rounded transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" />
                Valider le paiement
              </button>
              <div className="text-xs text-brvm-fg-dim text-center">
                Référence: <span className="font-mono">{omReference}</span>
              </div>
            </div>
          </div>
        )}

        {/* Step: VISA form */}
        {step === 'visa_form' && (
          <div className="brvm-card rounded-lg p-6">
            <button onClick={() => setStep('select')} className="text-xs text-brvm-fg-muted hover:text-brvm-fg mb-3 flex items-center gap-1">
              <ArrowLeft className="w-3 h-3" /> Changer de méthode
            </button>
            <h2 className="text-lg font-bold text-brvm-fg mb-1">Paiement par carte</h2>
            <p className="text-sm text-brvm-fg-muted mb-4 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-brvm-up" />
              Authentification 3D Secure — Vos données sont chiffrées
            </p>

            {/* Note démo */}
            <div className="bg-brvm-info/10 border border-brvm-info/30 rounded p-3 mb-4">
              <div className="text-xs text-brvm-info font-semibold mb-1">MODE DÉMO</div>
              <p className="text-xs text-brvm-fg-muted">
                Stripe n'est pas configuré. Le paiement sera simulé comme réussi.
                En production, l'authentification 3DS serait gérée par Stripe Elements.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-brvm-fg-muted uppercase tracking-wider mb-1.5">Numéro de carte</label>
                <input
                  type="text"
                  value={visaCard}
                  onChange={e => setVisaCard(formatCardNumber(e.target.value))}
                  className="w-full px-3 py-2.5 bg-brvm-bg-soft border border-brvm-border rounded text-brvm-fg font-mono focus:outline-none focus:border-brvm-accent"
                  placeholder="4242 4242 4242 4242"
                  maxLength={19}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-brvm-fg-muted uppercase tracking-wider mb-1.5">Expiration</label>
                  <input
                    type="text"
                    value={visaExp}
                    onChange={e => {
                      let v = e.target.value.replace(/\D/g, '').slice(0, 4);
                      if (v.length >= 3) v = v.slice(0, 2) + '/' + v.slice(2);
                      setVisaExp(v);
                    }}
                    className="w-full px-3 py-2.5 bg-brvm-bg-soft border border-brvm-border rounded text-brvm-fg font-mono focus:outline-none focus:border-brvm-accent"
                    placeholder="MM/AA"
                    maxLength={5}
                  />
                </div>
                <div>
                  <label className="block text-xs text-brvm-fg-muted uppercase tracking-wider mb-1.5">CVC</label>
                  <input
                    type="text"
                    value={visaCvc}
                    onChange={e => setVisaCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    className="w-full px-3 py-2.5 bg-brvm-bg-soft border border-brvm-border rounded text-brvm-fg font-mono focus:outline-none focus:border-brvm-accent"
                    placeholder="123"
                    maxLength={4}
                  />
                </div>
              </div>
              <button
                onClick={handleVisaPay}
                className="w-full py-2.5 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded transition-colors flex items-center justify-center gap-2"
              >
                <CreditCard className="w-4 h-4" />
                Payer {formatXOF(plan.priceXOF)}
              </button>
              <div className="text-xs text-brvm-fg-dim text-center flex items-center justify-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                Paiement sécurisé · 3D Secure
              </div>
            </div>
          </div>
        )}

        {/* Step: processing */}
        {step === 'processing' && (
          <div className="brvm-card rounded-lg p-8 text-center">
            <Loader2 className="w-12 h-12 text-brvm-accent animate-spin mx-auto mb-4" />
            <h2 className="text-lg font-bold text-brvm-fg mb-2">Traitement du paiement...</h2>
            <p className="text-sm text-brvm-fg-muted">Veuillez patienter, ne fermez pas cette page</p>
          </div>
        )}

        {/* Step: success */}
        {step === 'success' && successData && (
          <div className="brvm-card rounded-lg p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-brvm-up/20 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-brvm-up" />
            </div>
            <h2 className="text-2xl font-bold text-brvm-fg mb-2">Paiement réussi ! ✓</h2>
            <p className="text-brvm-fg-muted mb-4">
              Votre abonnement <strong className="text-brvm-accent">{successData.planName}</strong> est maintenant actif.
            </p>
            <div className="bg-brvm-bg-soft rounded p-3 mb-4 text-sm">
              <div className="text-brvm-fg-muted">Expire le</div>
              <div className="font-mono text-brvm-fg font-bold">
                {new Date(successData.endDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
              </div>
            </div>
            <p className="text-xs text-brvm-fg-dim mb-4">Un email de confirmation vous a été envoyé.</p>
            <a
              href="/"
              className="inline-block px-6 py-2.5 bg-brvm-accent hover:bg-brvm-accent-soft text-brvm-bg font-bold rounded transition-colors"
            >
              Accéder au tableau de bord →
            </a>
          </div>
        )}

        {/* Step: error */}
        {step === 'error' && (
          <div className="brvm-card rounded-lg p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-brvm-down/20 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-brvm-down" />
            </div>
            <h2 className="text-2xl font-bold text-brvm-fg mb-2">Échec du paiement</h2>
            <p className="text-brvm-fg-muted mb-4">{error}</p>
            <button
              onClick={() => { setStep('select'); setError(null); }}
              className="px-6 py-2.5 bg-brvm-card border border-brvm-border hover:border-brvm-accent text-brvm-fg rounded transition-colors"
            >
              Réessayer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
