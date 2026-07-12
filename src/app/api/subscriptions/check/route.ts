import { NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/auth';
import { checkSubscriptionStatus } from '@/lib/payment/subscription';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const status = await checkSubscriptionStatus(user.id);
  return NextResponse.json({ status });
}
