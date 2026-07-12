import { NextResponse } from 'next/server';
import { authenticateUser } from '@/lib/auth/auth';
import { rateLimit, resetRateLimit } from '@/lib/auth/rate-limiter';

export const dynamic = 'force-dynamic';

interface LoginBody {
  email: string;
  password: string;
}

export async function POST(request: Request) {
  // ── Rate Limiting : max 5 tentatives par IP sur 15 minutes ─────────────────
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';
  const rlKey = `login:${ip}`;
  const rl = rateLimit(rlKey, { maxAttempts: 5, windowMs: 15 * 60 * 1000 });

  if (!rl.allowed) {
    return NextResponse.json(
      { error: rl.message },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) },
      }
    );
  }

  let body: LoginBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 });
  }

  if (!body.email || !body.password) {
    return NextResponse.json({ error: 'Email et mot de passe requis' }, { status: 400 });
  }

  try {
    const { user, token } = await authenticateUser(body.email, body.password);

    // Connexion réussie → réinitialise le compteur de tentatives
    resetRateLimit(rlKey);

    const response = NextResponse.json({
      success: true,
      user,
      token,
    });

    // Cookie httpOnly pour les requêtes ultérieures
    response.cookies.set('brvm_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60, // 30 jours
      path: '/',
    });

    return response;
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erreur de connexion' }, { status: 401 });
  }
}

