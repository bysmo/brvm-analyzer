import { NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/auth';
import { db } from '@/lib/db';
import { checkPaymentStatus, isStripeConfigured } from '@/lib/payment/stripe';
import { activateSubscription } from '@/lib/payment/subscription';

export const dynamic = 'force-dynamic';

interface ConfirmBody {
  paymentId: string;
  paymentIntentId: string;
  planId: string;
}

export async function POST(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  let body: ConfirmBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 });
  }

  const payment = await db.payment.findFirst({
    where: { id: body.paymentId, userId: user.id },
  });
  if (!payment) {
    return NextResponse.json({ error: 'Paiement introuvable' }, { status: 404 });
  }

  // Mode démo sans Stripe: considère comme réussi
  if (!isStripeConfigured()) {
    const activateResult = await activateSubscription({
      userId: user.id,
      planId: body.planId,
      paymentId: payment.id,
      paymentMethod: 'visa_3ds',
      providerPaymentId: body.paymentIntentId,
    });

    if (!activateResult.success) {
      return NextResponse.json({ error: activateResult.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      demoMode: true,
      message: activateResult.message,
      subscription: {
        startDate: activateResult.startDate,
        endDate: activateResult.endDate,
      },
    });
  }

  // Vérifie le statut du paiement Stripe
  const statusResult = await checkPaymentStatus(body.paymentIntentId);

  if (statusResult.status === 'requires_action') {
    return NextResponse.json({
      success: false,
      requiresAction: true,
      redirectUrl: statusResult.redirectUrl,
      message: 'Authentification 3DS requise',
    });
  }

  if (statusResult.status !== 'succeeded') {
    await db.payment.update({
      where: { id: payment.id },
      data: { status: 'failed', failureReason: statusResult.message },
    });
    return NextResponse.json({ error: statusResult.message }, { status: 400 });
  }

  // Active l'abonnement
  const activateResult = await activateSubscription({
    userId: user.id,
    planId: body.planId,
    paymentId: payment.id,
    paymentMethod: 'visa_3ds',
    providerPaymentId: body.paymentIntentId,
  });

  if (!activateResult.success) {
    return NextResponse.json({ error: activateResult.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    demoMode: false,
    message: activateResult.message,
    subscription: {
      startDate: activateResult.startDate,
      endDate: activateResult.endDate,
    },
  });
}
