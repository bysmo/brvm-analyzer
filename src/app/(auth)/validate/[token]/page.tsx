'use client';

import { useEffect, useState, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { TrendingUp, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

function ValidateTokenContent() {
  const params = useParams<{ token: string }>();
  const searchParams = useSearchParams();
  const hasError = searchParams.get('error') === '1';
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = params?.token;
    if (!token) return;

    // Appel à l'API pour valider le token (lien direct depuis l'email)
    fetch(`/api/auth/validate/${token}`)
      .then(async res => {
        // L'API redirige en cas de succès/erreur, mais on capture le statut
        if (res.redirected) {
          const url = new URL(res.url);
          if (url.searchParams.get('validated') === '1') {
            setStatus('success');
            setMessage('Votre email a été validé avec succès !');
            setTimeout(() => {
              window.location.href = '/login?validated=1';
            }, 2000);
          } else {
            setStatus('error');
            setMessage('Lien de validation invalide ou expiré');
          }
        } else {
          const data = await res.json();
          if (data.error) {
            setStatus('error');
            setMessage(data.error);
          } else {
            setStatus('success');
            setMessage('Votre email a été validé avec succès !');
            setTimeout(() => {
              window.location.href = '/login?validated=1';
            }, 2000);
          }
        }
      })
      .catch(() => {
        setStatus('error');
        setMessage('Erreur lors de la validation');
      });
  }, [params?.token]);

  if (hasError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brvm-bg p-4">
        <div className="brvm-card rounded-lg p-8 text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-brvm-down/20 flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-8 h-8 text-brvm-down" />
          </div>
          <h1 className="text-xl font-bold text-brvm-fg mb-2">Lien invalide</h1>
          <p className="text-sm text-brvm-fg-muted mb-4">
            Ce lien de validation est invalide ou a expiré. Les liens sont valables 24 heures.
          </p>
          <a href="/validate" className="text-brvm-accent hover:underline font-semibold">
            Saisir mon code OTP manuellement →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-brvm-bg p-4">
      <div className="brvm-card rounded-lg p-8 text-center max-w-md">
        <div className="flex items-center justify-center gap-2 mb-6">
          <img src="/logo.png" alt="Logo" className="w-10 h-10 rounded-md object-cover border border-brvm-border" />
          <div className="font-bold text-brvm-fg">BRVM Analyzer</div>
        </div>

        {status === 'loading' && (
          <>
            <Loader2 className="w-12 h-12 text-brvm-accent animate-spin mx-auto mb-4" />
            <h1 className="text-lg font-bold text-brvm-fg mb-2">Validation en cours...</h1>
            <p className="text-sm text-brvm-fg-muted">Veuillez patienter</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-16 h-16 rounded-full bg-brvm-up/20 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-brvm-up" />
            </div>
            <h1 className="text-xl font-bold text-brvm-fg mb-2">Email validé ! ✓</h1>
            <p className="text-sm text-brvm-fg-muted mb-4">{message}</p>
            <p className="text-xs text-brvm-fg-dim">Redirection vers la page de connexion...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-16 h-16 rounded-full bg-brvm-down/20 flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-8 h-8 text-brvm-down" />
            </div>
            <h1 className="text-xl font-bold text-brvm-fg mb-2">Erreur</h1>
            <p className="text-sm text-brvm-fg-muted mb-4">{message}</p>
            <a href="/validate" className="text-brvm-accent hover:underline font-semibold">
              Saisir mon code OTP manuellement →
            </a>
          </>
        )}
      </div>
    </div>
  );
}

export default function ValidateTokenPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-brvm-bg p-4">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-brvm-accent animate-spin mx-auto mb-3" />
          <p className="text-sm text-brvm-fg-muted">Chargement de la page de validation...</p>
        </div>
      </div>
    }>
      <ValidateTokenContent />
    </Suspense>
  );
}

