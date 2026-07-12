'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { TrendingUp, Mail, KeyRound, AlertCircle, CheckCircle2, Loader2, RotateCw } from 'lucide-react';

function ValidateForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillEmail = searchParams.get('email') || '';

  const [email, setEmail] = useState(prefillEmail);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [demoOtp, setDemoOtp] = useState<string | null>(null);

  const handleValidate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/auth/validate-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setSuccess(data.message);
      setTimeout(() => {
        router.push('/login?validated=1');
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email) {
      setError('Saisissez d\'abord votre email');
      return;
    }
    setResendLoading(true);
    setError(null);
    setDemoOtp(null);

    try {
      const res = await fetch('/api/auth/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setSuccess(data.message);
      if (data.demoOtp) {
        setDemoOtp(data.demoOtp);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setResendLoading(false);
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
          <h1 className="text-xl font-bold text-brvm-fg mb-1">Validation du compte</h1>
          <p className="text-sm text-brvm-fg-muted mb-4">
            Saisissez votre email et le code OTP à 6 chiffres reçu par mail pour activer votre compte.
          </p>

          {error && (
            <div className="mb-4 p-3 rounded bg-brvm-down/10 border border-brvm-down/30 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-brvm-down flex-shrink-0" />
              <span className="text-sm text-brvm-down">{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 rounded bg-brvm-up/10 border border-brvm-up/30 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-brvm-up flex-shrink-0" />
              <span className="text-sm text-brvm-up">{success}</span>
            </div>
          )}

          {demoOtp && (
            <div className="mb-4 p-3 rounded bg-brvm-info/10 border border-brvm-info/30">
              <div className="text-xs text-brvm-info font-semibold mb-1">📧 MODE DÉMO</div>
              <p className="text-xs text-brvm-fg-muted mb-2">
                SMTP non configuré. Voici le code OTP qui aurait été envoyé par email :
              </p>
              <div className="text-2xl font-mono font-bold text-brvm-info tracking-widest text-center py-2 bg-brvm-bg-soft rounded">
                {demoOtp}
              </div>
            </div>
          )}

          <form onSubmit={handleValidate} className="space-y-4">
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
              <label className="block text-xs text-brvm-fg-muted uppercase tracking-wider mb-1.5">
                Code OTP (6 chiffres)
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brvm-fg-dim" />
                <input
                  type="text"
                  required
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full pl-10 pr-3 py-3 bg-brvm-bg-soft border border-brvm-border rounded text-brvm-fg text-center text-2xl font-mono tracking-[0.5em] focus:outline-none focus:border-brvm-accent"
                  placeholder="000000"
                  maxLength={6}
                  autoComplete="one-time-code"
                />
              </div>
              <p className="text-xs text-brvm-fg-dim mt-1">Code valable 24 heures</p>
            </div>

            <button
              type="submit"
              disabled={loading || otp.length !== 6}
              className="w-full py-2.5 bg-brvm-accent hover:bg-brvm-accent-soft text-brvm-bg font-bold rounded transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Validation...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Valider mon compte
                </>
              )}
            </button>
          </form>

          <div className="mt-4 pt-4 border-t border-brvm-border flex items-center justify-between text-sm">
            <button
              onClick={handleResend}
              disabled={resendLoading || !email}
              className="text-brvm-info hover:underline disabled:opacity-50 flex items-center gap-1.5"
            >
              {resendLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RotateCw className="w-3.5 h-3.5" />
              )}
              Renvoyer le code
            </button>
            <a href="/login" className="text-brvm-fg-muted hover:text-brvm-fg">
              ← Retour à la connexion
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ValidateFormPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-brvm-bg p-4">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-brvm-accent animate-spin mx-auto mb-3" />
          <p className="text-sm text-brvm-fg-muted">Chargement de la page de validation...</p>
        </div>
      </div>
    }>
      <ValidateForm />
    </Suspense>
  );
}

