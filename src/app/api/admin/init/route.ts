import { NextResponse } from 'next/server';
import { ensureAdminUserExists } from '@/lib/auth/init-admin';

export const dynamic = 'force-dynamic';

// Endpoint pour initialiser le compte admin manuellement
// En développement : accessible librement
// En production    : nécessite le paramètre ?secret=ADMIN_INIT_SECRET défini dans .env
export async function GET(request: Request) {
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    const expectedSecret = process.env.ADMIN_INIT_SECRET;

    if (!expectedSecret) {
      return NextResponse.json(
        { error: 'ADMIN_INIT_SECRET non configuré. Endpoint désactivé en production.' },
        { status: 403 }
      );
    }

    if (secret !== expectedSecret) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }
  }

  try {
    await ensureAdminUserExists();
    return NextResponse.json({
      success: true,
      message: "Compte admin initialisé depuis les variables d'environnement (.env).",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Erreur initialisation admin' },
      { status: 500 }
    );
  }
}

