import { NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/auth';
import { db } from '@/lib/db';
import { getPlanById } from '@/lib/payment/plans';
import { createPaymentIntent, isStripeConfigured, simulateStripePaymentSuccess, getStripePublishableKey } from '@/lib/payment/stripe';

export const dynamic = 'force-dynamic';

interface CreateIntentBody {
  planId: string;
}

export async function POST(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  let body: CreateIntentBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 });
  }

  const plan = getPlanById(body.planId);
  if (!plan) {
    return NextResponse.json({ error: 'Plan invalide' }, { status: 400 });
  }

  try {
    // Crée l'entrée de paiement
    const payment = await db.payment.create({
      data: {
        userId: user.id,
        amountXOF: plan.priceXOF,
        currency: 'XOF',
        method: 'visa_3ds',
        provider: 'stripe',
        status: 'pending',
        providerRef: `VISA-${Date.now()}`,
        metadata: JSON.stringify({ planId: plan.id }),
      },
    });

    // Vérifie si Stripe est configuré
    if (!isStripeConfigured()) {
      // Mode démo: simule un paiement réussi avec activation immédiate
      const simulated = simulateStripePaymentSuccess(payment.id);
      return NextResponse.json({
        success: true,
        demoMode: true,
        paymentId: payment.id,
        clientSecret: simulated.clientSecret,
        paymentIntentId: simulated.paymentIntentId,
        publishableKey: null,
        message: 'Mode démo: paiement VISA 3DS simulé. Cliquez sur "Payer maintenant" pour finaliser.',
      });
    }

    // Crée le PaymentIntent Stripe
    const result = await createPaymentIntent({
      paymentId: payment.id,
      amountXOF: plan.priceXOF,
      description: `Abonnement BRVM Analyzer ${plan.name}`,
      customerEmail: user.email,
      customerName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
    });

    if (!result.success) {
      await db.payment.update({
        where: { id: payment.id },
        data: { status: 'failed', failureReason: result.message },
      });
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    // Met à jour le paiement avec l'ID PaymentIntent
    await db.payment.update({
      where: { id: payment.id },
      data: { providerPaymentId: result.paymentIntentId },
    });

    return NextResponse.json({
      success: true,
      demoMode: false,
      paymentId: payment.id,
      clientSecret: result.clientSecret,
      paymentIntentId: result.paymentIntentId,
      publishableKey: getStripePublishableKey(),
      requiresAction: result.requiresAction,
      message: result.message,
    });
  } catch (err: any) {
    console.error('[payments/visa/create-intent] error:', err);
    return NextResponse.json({ error: err?.message || 'Erreur serveur' }, { status: 500 });
  }
}
