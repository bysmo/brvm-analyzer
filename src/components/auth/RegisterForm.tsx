'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TrendingUp, Mail, Lock, User, Phone, Globe, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

const COUNTRIES = [
  { code: 'CI', name: "Côte d'Ivoire", flag: '🇨🇮' },
  { code: 'SN', name: 'Sénégal', flag: '🇸🇳' },
  { code: 'BF', name: 'Burkina Faso', flag: '🇧🇫' },
  { code: 'ML', name: 'Mali', flag: '🇲🇱' },
  { code: 'BJ', name: 'Bénin', flag: '🇧🇯' },
];

export function RegisterForm() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    passwordConfirm: '',
    firstName: '',
    lastName: '',
    phone: '',
    country: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    message: string;
    demoMode: boolean;
    email: string;
    demoOtp?: string;
  } | null>(null);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (formData.password !== formData.passwordConfirm) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }
    if (formData.password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          firstName: formData.firstName || undefined,
          lastName: formData.lastName || undefined,
          phone: formData.phone || undefined,
          country: formData.country || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur lors de l'inscription");

      setSuccess({
        message: data.message,
        demoMode: data.emailDemoMode,
        email: data.email,
        demoOtp: data.demoOtp,
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brvm-bg p-4">
        <div className="w-full max-w-md">
          <div className="brvm-card rounded-lg p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-brvm-up/20 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-brvm-up" />
            </div>
            <h1 className="text-xl font-bold text-brvm-fg mb-2">Compte créé !</h1>
            <p className="text-sm text-brvm-fg-muted mb-4">{success.message}</p>

            {success.demoMode && success.demoOtp && (
              <div className="bg-brvm-info/10 border border-brvm-info/30 rounded p-3 mb-4 text-left">
                <div className="text-xs text-brvm-info font-semibold mb-1">📧 MODE DÉMO</div>
                <p className="text-xs text-brvm-fg-muted mb-2">
                  SMTP non configuré. Voici le code OTP qui aurait été envoyé par email :
                </p>
                <div className="text-3xl font-mono font-bold text-brvm-info tracking-widest text-center py-2 bg-brvm-bg-soft rounded">
                  {success.demoOtp}
                </div>
              </div>
            )}

            <a
              href={`/validate?email=${encodeURIComponent(success.email)}`}
              className="inline-block px-6 py-2.5 bg-brvm-accent hover:bg-brvm-accent-soft text-brvm-bg font-bold rounded transition-colors"
            >
              Saisir mon code OTP →
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-brvm-bg p-4 py-8">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-6">
          <img src="/logo.png" alt="Logo" className="w-10 h-10 rounded-md object-cover border border-brvm-border" />
          <div>
            <div className="font-bold text-brvm-fg">BRVM Analyzer</div>
            <div className="text-xs text-brvm-fg-muted">Analyse boursière temps réel</div>
          </div>
        </div>

        <div className="brvm-card rounded-lg p-6">
          <h1 className="text-xl font-bold text-brvm-fg mb-1">Créer un compte</h1>
          <p className="text-sm text-brvm-fg-muted mb-4">Accédez aux analyses premium de la BRVM</p>

          {error && (
            <div className="mb-4 p-3 rounded bg-brvm-down/10 border border-brvm-down/30 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-brvm-down flex-shrink-0" />
              <span className="text-sm text-brvm-down">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-brvm-fg-muted uppercase tracking-wider mb-1">Prénom</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brvm-fg-dim" />
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={e => handleChange('firstName', e.target.value)}
                    className="w-full pl-10 pr-3 py-2 bg-brvm-bg-soft border border-brvm-border rounded text-brvm-fg placeholder-brvm-fg-dim focus:outline-none focus:border-brvm-accent"
                    placeholder="Prénom"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-brvm-fg-muted uppercase tracking-wider mb-1">Nom</label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={e => handleChange('lastName', e.target.value)}
                  className="w-full px-3 py-2 bg-brvm-bg-soft border border-brvm-border rounded text-brvm-fg placeholder-brvm-fg-dim focus:outline-none focus:border-brvm-accent"
                  placeholder="Nom"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-brvm-fg-muted uppercase tracking-wider mb-1">Email *</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brvm-fg-dim" />
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={e => handleChange('email', e.target.value)}
                  className="w-full pl-10 pr-3 py-2 bg-brvm-bg-soft border border-brvm-border rounded text-brvm-fg placeholder-brvm-fg-dim focus:outline-none focus:border-brvm-accent"
                  placeholder="vous@exemple.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-brvm-fg-muted uppercase tracking-wider mb-1">Téléphone</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brvm-fg-dim" />
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={e => handleChange('phone', e.target.value)}
                  className="w-full pl-10 pr-3 py-2 bg-brvm-bg-soft border border-brvm-border rounded text-brvm-fg placeholder-brvm-fg-dim focus:outline-none focus:border-brvm-accent"
                  placeholder="+225 07 00 00 00 00"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-brvm-fg-muted uppercase tracking-wider mb-1">Pays</label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brvm-fg-dim" />
                <select
                  value={formData.country}
                  onChange={e => handleChange('country', e.target.value)}
                  className="w-full pl-10 pr-3 py-2 bg-brvm-bg-soft border border-brvm-border rounded text-brvm-fg focus:outline-none focus:border-brvm-accent"
                >
                  <option value="">Sélectionnez votre pays</option>
                  {COUNTRIES.map(c => (
                    <option key={c.code} value={c.code}>{c.flag} {c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs text-brvm-fg-muted uppercase tracking-wider mb-1">Mot de passe *</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brvm-fg-dim" />
                <input
                  type="password"
                  required
                  value={formData.password}
                  onChange={e => handleChange('password', e.target.value)}
                  className="w-full pl-10 pr-3 py-2 bg-brvm-bg-soft border border-brvm-border rounded text-brvm-fg placeholder-brvm-fg-dim focus:outline-none focus:border-brvm-accent"
                  placeholder="Min. 8 caractères"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-brvm-fg-muted uppercase tracking-wider mb-1">Confirmer le mot de passe *</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brvm-fg-dim" />
                <input
                  type="password"
                  required
                  value={formData.passwordConfirm}
                  onChange={e => handleChange('passwordConfirm', e.target.value)}
                  className="w-full pl-10 pr-3 py-2 bg-brvm-bg-soft border border-brvm-border rounded text-brvm-fg placeholder-brvm-fg-dim focus:outline-none focus:border-brvm-accent"
                  placeholder="Confirmez"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-brvm-accent hover:bg-brvm-accent-soft text-brvm-bg font-bold rounded transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Création...
                </>
              ) : (
                'Créer mon compte'
              )}
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-brvm-border text-center text-sm text-brvm-fg-muted">
            Déjà un compte ?{' '}
            <a href="/login" className="text-brvm-accent hover:underline font-semibold">
              Se connecter
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
