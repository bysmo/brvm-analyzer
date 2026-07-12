import { NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/portfolio/positions/[id]
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const { id } = await params;
  const position = await db.portfolioPosition.findFirst({
    where: { id, userId: user.id },
  });

  if (!position) return NextResponse.json({ error: 'Position introuvable' }, { status: 404 });
  return NextResponse.json({ position });
}

// PUT /api/portfolio/positions/[id] — mettre à jour une position (notes, etc.)
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const { id } = await params;

  const existing = await db.portfolioPosition.findFirst({ where: { id, userId: user.id } });
  if (!existing) return NextResponse.json({ error: 'Position introuvable' }, { status: 404 });
  if (existing.status === 'sold') return NextResponse.json({ error: 'Position déjà vendue' }, { status: 400 });

  let body: { notes?: string; quantity?: number; acquisitionPrice?: number; acquisitionDate?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 });
  }

  const updatedData: Record<string, unknown> = {};
  if (body.notes !== undefined) updatedData.notes = body.notes;
  if (body.quantity && body.quantity > 0) {
    updatedData.quantity = body.quantity;
    updatedData.totalCostXOF = (body.quantity) * (body.acquisitionPrice ?? existing.acquisitionPrice);
  }
  if (body.acquisitionPrice && body.acquisitionPrice > 0) {
    updatedData.acquisitionPrice = body.acquisitionPrice;
    updatedData.totalCostXOF = (body.quantity ?? existing.quantity) * body.acquisitionPrice;
  }
  if (body.acquisitionDate) updatedData.acquisitionDate = new Date(body.acquisitionDate);

  const position = await db.portfolioPosition.update({
    where: { id },
    data: updatedData,
  });

  return NextResponse.json({ position });
}

// DELETE /api/portfolio/positions/[id] — supprimer une position
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const { id } = await params;
  const existing = await db.portfolioPosition.findFirst({ where: { id, userId: user.id } });
  if (!existing) return NextResponse.json({ error: 'Position introuvable' }, { status: 404 });

  await db.portfolioPosition.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
