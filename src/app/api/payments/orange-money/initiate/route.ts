import { NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/auth';
import { db } from '@/lib/db';
import { getPlanById } from '@/lib/payment/plans';
import { initiatePayment, ORANGE_MONEY_COUNTRIES } from '@/lib/payment/orange-money';

export const dynamic = 'force-dynamic';

interface InitiateBody {
  planId: string;
  country: string;       // CI, SN, BF, ML, BJ
  customerMsisdn?: string;
}

export async function POST(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  let body: InitiateBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 });
  }

  const plan = getPlanById(body.planId);
  if (!plan) {
    return NextResponse.json({ error: 'Plan invalide' }, { status: 400 });
  }

  const country = ORANGE_MONEY_COUNTRIES.find(c => c.code === body.country);
  if (!country) {
    return NextResponse.json({ error: 'Pays non supporté' }, { status: 400 });
  }

  try {
    // Crée l'entrée de paiement en base
    const payment = await db.payment.create({
      data: {
        userId: user.id,
        amountXOF: plan.priceXOF,
        currency: 'XOF',
        method: 'orange_money',
        provider: `orange_money_${body.country.toLowerCase()}`,
        status: 'pending',
        providerRef: `OM-${body.country}-${Date.now()}`,
        metadata: JSON.stringify({ planId: plan.id, country: body.country }),
      },
    });

    // Initie le paiement Orange Money
    const result = await initiatePayment({
      paymentId: payment.id,
      country: body.country,
      amount: plan.priceXOF,
      customerMsisdn: body.customerMsisdn,
      description: `Abonnement BRVM Analyzer ${plan.name}`,
    });

    if (!result.success) {
      await db.payment.update({
        where: { id: payment.id },
        data: { status: 'failed', failureReason: result.message },
      });
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    // Met à jour la référence provider
    await db.payment.update({
      where: { id: payment.id },
      data: {
        providerRef: result.reference,
        providerPaymentId: result.providerPaymentId,
      },
    });

    return NextResponse.json({
      success: true,
      paymentId: payment.id,
      reference: result.reference,
      otpCode: result.otpCode,    // mode sandbox seulement
      paymentUrl: result.paymentUrl,  // mode production
      message: result.message,
      sandboxMode: !result.paymentUrl,
    });
  } catch (err: any) {
    console.error('[payments/orange-money/initiate] error:', err);
    return NextResponse.json({ error: err?.message || 'Erreur serveur' }, { status: 500 });
  }
}
