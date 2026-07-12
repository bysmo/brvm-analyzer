// Service Stripe VISA 3DS - Intégration hybride sandbox/production
// Sandbox: Stripe en mode test (clés sk_test_ et pk_test_)
// Production: Stripe en mode live (clés sk_live_ et pk_live_)

import Stripe from 'stripe';

let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe | null {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return null;
  if (stripeInstance) return stripeInstance;
  stripeInstance = new Stripe(secretKey, { apiVersion: '2024-06-20' as any });
  return stripeInstance;
}

export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

export function isStripeTestMode(): boolean {
  const key = process.env.STRIPE_SECRET_KEY || '';
  return key.startsWith('sk_test_') || key.startsWith('pk_test_');
}

export function getStripePublishableKey(): string | null {
  return process.env.STRIPE_PUBLISHABLE_KEY || null;
}

// === CRÉATION DE PAYMENT INTENT (avec 3DS) ===

export interface CreateIntentParams {
  paymentId: string;       // ID interne
  amountXOF: number;
  description: string;
  customerEmail: string;
  customerName?: string;
}

export interface CreateIntentResult {
  success: boolean;
  clientSecret?: string;
  paymentIntentId?: string;
  requiresAction?: boolean;     // 3DS requis
  redirectUrl?: string;
  message: string;
}

export async function createPaymentIntent(params: CreateIntentParams): Promise<CreateIntentResult> {
  const stripe = getStripe();
  if (!stripe) {
    return {
      success: false,
      message: 'Stripe non configuré. Mode démo: paiement simulé comme réussi.',
    };
  }

  try {
    const intent = await stripe.paymentIntents.create({
      amount: params.amountXOF,  // XOF ne nécessite pas de conversion (pas de décimales)
      currency: 'xof',
      description: params.description,
      receipt_email: params.customerEmail,
      metadata: {
        internalPaymentId: params.paymentId,
        customerEmail: params.customerEmail,
        customerName: params.customerName || '',
      },
      // Force 3DS pour toutes les cartes
      payment_method_options: {
        card: {
          request_three_d_secure: 'automatic',  // ou 'any' pour forcer 3DS
        },
      },
      automatic_payment_methods: { enabled: true },
    });

    return {
      success: true,
      clientSecret: intent.client_secret || undefined,
      paymentIntentId: intent.id,
      requiresAction: intent.status === 'requires_action',
      message: 'PaymentIntent créé',
    };
  } catch (err: any) {
    console.error('[stripe.createPaymentIntent] error:', err);
    return { success: false, message: err?.message || 'Erreur création PaymentIntent' };
  }
}

// === CONFIRMATION DE PAIEMENT ===

export interface ConfirmIntentResult {
  success: boolean;
  status: 'succeeded' | 'failed' | 'pending' | 'requires_action';
  message: string;
  redirectUrl?: string;  // pour 3DS
}

export async function checkPaymentStatus(paymentIntentId: string): Promise<ConfirmIntentResult> {
  const stripe = getStripe();
  if (!stripe) {
    return { success: false, status: 'failed', message: 'Stripe non configuré' };
  }

  try {
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (intent.status === 'succeeded') {
      return { success: true, status: 'succeeded', message: 'Paiement réussi' };
    }
    if (intent.status === 'requires_action') {
      return {
        success: false,
        status: 'requires_action',
        message: 'Authentification 3DS requise',
        redirectUrl: intent.next_action?.redirect_to_url?.url,
      };
    }
    if (intent.status === 'processing') {
      return { success: false, status: 'pending', message: 'Paiement en cours' };
    }
    if (intent.status === 'canceled') {
      return { success: false, status: 'failed', message: 'Paiement annulé' };
    }
    return {
      success: false,
      status: 'failed',
      message: `Paiement échoué: ${intent.status}`,
    };
  } catch (err: any) {
    return { success: false, status: 'failed', message: err?.message || 'Erreur vérification' };
  }
}

// === MODE DÉMO (sandbox sans Stripe) ===

export function simulateStripePaymentSuccess(paymentId: string): {
  paymentIntentId: string;
  clientSecret: string;
} {
  return {
    paymentIntentId: `demo_pi_${paymentId}_${Date.now()}`,
    clientSecret: `demo_secret_${paymentId}_${Date.now()}`,
  };
}
