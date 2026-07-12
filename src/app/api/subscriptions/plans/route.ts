import { NextResponse } from 'next/server';
import { SUBSCRIPTION_PLANS } from '@/lib/payment/plans';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ plans: SUBSCRIPTION_PLANS });
}
