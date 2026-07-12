import { NextResponse } from 'next/server';
import { logout } from '@/lib/auth/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const authHeader = request.headers.get('Authorization');
  let token: string | null = null;
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else {
    const cookieHeader = request.headers.get('Cookie') || '';
    const match = cookieHeader.match(/brvm_session=([^;]+)/);
    if (match) token = match[1];
  }

  if (token) {
    await logout(token);
  }

  const response = NextResponse.json({ success: true, message: 'Déconnexion réussie' });
  response.cookies.delete('brvm_session');
  return response;
}
