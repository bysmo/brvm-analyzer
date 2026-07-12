import { NextResponse } from 'next/server';
import { expireOldSubscriptions } from '@/lib/payment/subscription';

export const dynamic = 'force-dynamic';

// Endpoint appelé par cron job (toutes les heures)
// Sécurisé par un secret partagé en header X-Cron-Secret
export async function GET(request: Request) {
  const cronSecret = request.headers.get('X-Cron-Secret');
  const expectedSecret = process.env.CRON_SECRET;

  // En dev: pas de secret requis, en prod: secret obligatoire
  if (expectedSecret && cronSecret !== expectedSecret) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  try {
    const result = await expireOldSubscriptions();
    return NextResponse.json({
      success: true,
      expiredCount: result.count,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
