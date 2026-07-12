import { NextResponse } from 'next/server';
import { validateEmail } from '@/lib/auth/auth';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const result = await validateEmail(token);

  if (result.success) {
    return NextResponse.redirect(
      new URL('/login?validated=1', process.env.APP_URL || 'http://localhost:3000')
    );
  }
  return NextResponse.redirect(
    new URL(`/validate/${token}?error=1`, process.env.APP_URL || 'http://localhost:3000')
  );
}
