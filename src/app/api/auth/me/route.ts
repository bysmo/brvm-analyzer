import { NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ user: null, authenticated: false }, { status: 200 });
  }

  return NextResponse.json({
    user,
    authenticated: true,
  });
}
