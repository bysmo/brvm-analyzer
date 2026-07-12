import { NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/auth';
import { db } from '@/lib/db';
import { computeFinancialPlan } from '@/lib/portfolio/yield-calculator';

export const dynamic = 'force-dynamic';

// GET /api/portfolio/config — retourne la configuration financière de l'utilisateur
export async function GET(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const config = await db.portfolioConfig.findUnique({ where: { userId: user.id } });
  return NextResponse.json({ config: config ?? null });
}

// POST /api/portfolio/config — crée ou met à jour la configuration financière
// L'utilisateur fournit : target, initial, years ET son versement mensuel.
// L'application calcule le rendement annuel requis (IRR) et l'enregistre.
export async function POST(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  let body: {
    targetAmountXOF: number;
    initialAmountXOF: number;
    targetYears: number;
    monthlyContribXOF: number;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 });
  }

  const { targetAmountXOF, initialAmountXOF, targetYears, monthlyContribXOF } = body;

  // Validations
  if (!targetAmountXOF || targetAmountXOF <= 0)
    return NextResponse.json({ error: 'Montant cible invalide' }, { status: 400 });
  if ((initialAmountXOF ?? 0) < 0)
    return NextResponse.json({ error: 'Montant initial invalide' }, { status: 400 });
  if (!targetYears || targetYears < 1 || targetYears > 50)
    return NextResponse.json({ error: 'Durée invalide (1-50 ans)' }, { status: 400 });
  if (!monthlyContribXOF || monthlyContribXOF <= 0)
    return NextResponse.json({ error: 'Versement mensuel invalide (doit être > 0)' }, { status: 400 });
  if ((initialAmountXOF ?? 0) >= targetAmountXOF)
    return NextResponse.json({ error: 'Le montant initial doit être inférieur à l\'objectif' }, { status: 400 });

  // L'application calcule automatiquement le rendement annuel requis via IRR
  const plan = computeFinancialPlan({
    targetAmountXOF,
    initialAmountXOF: initialAmountXOF ?? 0,
    targetYears,
    monthlyContribXOF,
  });

  const config = await db.portfolioConfig.upsert({
    where: { userId: user.id },
    update: {
      targetAmountXOF,
      initialAmountXOF: initialAmountXOF ?? 0,
      targetYears,
      yieldThresholdPct: plan.yieldThresholdPct,
      monthlyContribXOF,
    },
    create: {
      userId: user.id,
      targetAmountXOF,
      initialAmountXOF: initialAmountXOF ?? 0,
      targetYears,
      yieldThresholdPct: plan.yieldThresholdPct,
      monthlyContribXOF,
    },
  });

  return NextResponse.json({ config, plan });
}

// PUT — alias de POST
export { POST as PUT };
