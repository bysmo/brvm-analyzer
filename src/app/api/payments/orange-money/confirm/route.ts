import { NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/auth';
import { db } from '@/lib/db';
import { confirmPayment } from '@/lib/payment/orange-money';
import { activateSubscription } from '@/lib/payment/subscription';

export const dynamic = 'force-dynamic';

interface ConfirmBody {
  reference: string;
  otpCode?: string;
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

  // Récupère le paiement associé
  const payment = await db.payment.findFirst({
    where: { providerRef: body.reference, userId: user.id },
  });
  if (!payment) {
    return NextResponse.json({ error: 'Paiement introuvable' }, { status: 404 });
  }

  // Confirme le paiement Orange Money
  const confirmResult = await confirmPayment({
    reference: body.reference,
    otpCode: body.otpCode,
  });

  if (!confirmResult.success) {
    await db.payment.update({
      where: { id: payment.id },
      data: { status: 'failed', failureReason: confirmResult.message },
    });
    return NextResponse.json({ error: confirmResult.message }, { status: 400 });
  }

  // Active l'abonnement
  const activateResult = await activateSubscription({
    userId: user.id,
    planId: body.planId,
    paymentId: payment.id,
    paymentMethod: 'orange_money',
    providerPaymentId: confirmResult.txnId || payment.providerPaymentId || '',
  });

  if (!activateResult.success) {
    return NextResponse.json({ error: activateResult.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: activateResult.message,
    subscription: {
      planName: body.planId,
      startDate: activateResult.startDate,
      endDate: activateResult.endDate,
    },
  });
}
