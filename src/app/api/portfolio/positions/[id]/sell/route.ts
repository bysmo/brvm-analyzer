import { NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// POST /api/portfolio/positions/[id]/sell — enregistrer la vente d'une position
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const { id } = await params;

  const position = await db.portfolioPosition.findFirst({ where: { id, userId: user.id } });
  if (!position) return NextResponse.json({ error: 'Position introuvable' }, { status: 404 });
  if (position.status === 'sold') return NextResponse.json({ error: 'Position déjà vendue' }, { status: 400 });

  let body: { saleDate: string; salePrice: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 });
  }

  const { saleDate, salePrice } = body;

  if (!saleDate) return NextResponse.json({ error: 'Date de vente requise' }, { status: 400 });
  if (!salePrice || salePrice <= 0)
    return NextResponse.json({ error: 'Prix de vente invalide' }, { status: 400 });

  const saleDateObj = new Date(saleDate);
  if (saleDateObj < new Date(position.acquisitionDate))
    return NextResponse.json({ error: 'La date de vente ne peut pas être avant l\'acquisition' }, { status: 400 });

  const saleTotalXOF = salePrice * position.quantity;
  const realizedGainXOF = saleTotalXOF - position.totalCostXOF;

  const updated = await db.portfolioPosition.update({
    where: { id },
    data: {
      status: 'sold',
      saleDate: saleDateObj,
      salePrice,
      saleTotalXOF,
      realizedGainXOF,
    },
  });

  return NextResponse.json({
    position: updated,
    summary: {
      totalCostXOF: position.totalCostXOF,
      saleTotalXOF,
      realizedGainXOF,
      realizedGainPct: parseFloat(((realizedGainXOF / position.totalCostXOF) * 100).toFixed(2)),
    },
  });
}
